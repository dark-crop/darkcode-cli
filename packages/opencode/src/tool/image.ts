import { Schema, Effect } from "effect"
import * as path from "path"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import * as Tool from "./tool"
import { Auth } from "@/auth"
import { InstanceState } from "@/effect/instance-state"
import { DARK_LLM_BASE_URL, DARK_LLM_PROVIDER_ID, DARK_LLM_ENV_KEY } from "@/config/builtin-provider"
import { assertExternalDirectoryEffect } from "./external-directory"
import DESCRIPTION from "./image.txt"

export const Parameters = Schema.Struct({
  prompt: Schema.String.annotate({
    description: "Description of the image to generate, or the change to apply when editing.",
  }),
  images: Schema.optional(Schema.Array(Schema.String)).annotate({
    description:
      "Optional 1-3 absolute paths to existing input images. If provided, edits them (image-to-image) instead of generating from scratch.",
  }),
  size: Schema.optional(Schema.String).annotate({
    description:
      'Optional pixel size "WxH" (generate mode only). Translate the user\'s requested ratio/orientation ' +
      "into pixels near ~1 megapixel: square/1:1 = 1024x1024, landscape/16:9 = 1344x768, portrait/9:16 = " +
      "768x1344, 3:2 = 1216x832, 2:3 = 832x1216, 4:3 = 1152x896, 3:4 = 896x1152. Default 1024x1024.",
  }),
  output: Schema.optional(Schema.String).annotate({
    description: "Optional output file path (.png). Defaults to a timestamped file in the workspace root.",
  }),
})

type Params = Schema.Schema.Type<typeof Parameters>

interface ImagesResponse {
  data?: Array<{ b64_json?: string; url?: string }>
}

export const ImageTool = Tool.define(
  "image",
  Effect.gen(function* () {
    const auth = yield* Auth.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Params, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const inputs = (params.images ?? []).slice(0, 3)
          const isEdit = inputs.length > 0
          const abs = (p: string) => (path.isAbsolute(p) ? p : path.join(instance.directory, p))
          const inputAbs = inputs.map(abs)
          const outAbs = params.output ? abs(params.output) : undefined

          yield* ctx.ask({
            permission: "image",
            patterns: [isEdit ? "edit" : "generate"],
            always: ["*"],
            metadata: { prompt: params.prompt, mode: isEdit ? "edit" : "generate", images: inputAbs, output: outAbs },
          })

          // The `images` and `output` paths are model-controlled. Gate any file read/write OUTSIDE
          // the workspace behind the external_directory permission - this stops a prompt-injected
          // model from reading e.g. ~/.ssh/id_rsa or the auth store and exfiltrating it through the
          // edit upload, or overwriting an arbitrary file via `output`. In-workspace paths pass silently.
          for (const p of inputAbs) yield* assertExternalDirectoryEffect(ctx, p)
          if (outAbs) yield* assertExternalDirectoryEffect(ctx, outAbs)

          // Resolve the signed-in dark-llm key (or the env fallback).
          const info = yield* auth.get(DARK_LLM_PROVIDER_ID).pipe(Effect.orElseSucceed(() => undefined))
          const key = (info && info.type === "api" ? info.key : undefined) ?? process.env[DARK_LLM_ENV_KEY]
          if (!key) throw new Error("Not signed in to Dark LLM - run /login first (or set DARK_LLM_KEY).")

          const data = yield* Effect.promise(async () => {
            let resp: Response
            if (isEdit) {
              const form = new FormData()
              form.append("model", "qwen-image-edit")
              form.append("prompt", params.prompt)
              for (const p of inputAbs) {
                const buf = await readFile(p)
                form.append("image", new Blob([new Uint8Array(buf)]), path.basename(p))
              }
              resp = await fetch(`${DARK_LLM_BASE_URL}/images/edits`, {
                method: "POST",
                headers: { Authorization: `Bearer ${key}` },
                body: form,
                signal: ctx.abort,
              })
            } else {
              resp = await fetch(`${DARK_LLM_BASE_URL}/images/generations`, {
                method: "POST",
                headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
                body: JSON.stringify({ model: "z-image", prompt: params.prompt, size: params.size ?? "1024x1024" }),
                signal: ctx.abort,
              })
            }
            if (!resp.ok) {
              const body = await resp.text().catch(() => "")
              throw new Error(`Image API returned ${resp.status}: ${body.slice(0, 300)}`)
            }
            return (await resp.json()) as ImagesResponse
          })

          const items = (data.data ?? []).filter((d) => d.b64_json)
          if (items.length === 0) throw new Error("Image API returned no inline image data (expected b64_json).")

          const saved = yield* Effect.promise(async () => {
            const out: string[] = []
            for (let i = 0; i < items.length; i++) {
              const dest =
                outAbs && items.length === 1
                  ? outAbs
                  : path.join(
                      instance.directory,
                      `image-${Date.now()}${items.length > 1 ? "-" + (i + 1) : ""}.png`,
                    )
              await mkdir(path.dirname(dest), { recursive: true })
              await writeFile(dest, Buffer.from(items[i].b64_json!, "base64"))
              out.push(dest)
            }
            return out
          })

          const rel = saved.map((s) => path.relative(instance.worktree, s))
          return {
            title: rel.join(", "),
            metadata: { mode: isEdit ? "edit" : "generate", saved, prompt: params.prompt },
            output:
              `${isEdit ? "Edited" : "Generated"} ${saved.length} image${saved.length > 1 ? "s" : ""} ` +
              `(${isEdit ? "qwen-image-edit" : "z-image"}):\n` +
              rel.map((r) => "- " + r).join("\n"),
          }
        }),
    }
  }),
)
