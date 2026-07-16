import { Schema, Effect } from "effect"
import * as path from "path"
import { fileURLToPath } from "node:url"
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
  mode: Schema.optional(Schema.Literals(["generate", "edit"])).annotate({
    description:
      'Set to "edit" to modify an existing image (image-to-image). If the user attached/gave an image in ' +
      'their message, it is used automatically - no path needed. Omit or "generate" to create a new image.',
  }),
  images: Schema.optional(Schema.Array(Schema.String)).annotate({
    description:
      "Optional 1-3 absolute paths to input image files to edit. Usually NOT needed - an image the user " +
      "attached is picked up automatically in edit mode. Only use this to edit specific files on disk.",
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

// Image file parts the user attached to their most recent message.
function attachedImages(messages: readonly unknown[]): { url: string; filename?: string }[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as { info?: { role?: string }; parts?: unknown[] } | undefined
    if (m?.info?.role !== "user") continue
    const parts = (m.parts ?? []) as Array<{ type?: string; mime?: string; url?: string; filename?: string }>
    return parts
      .filter((p) => p.type === "file" && typeof p.mime === "string" && p.mime.startsWith("image/") && !!p.url)
      .map((p) => ({ url: p.url as string, filename: p.filename }))
  }
  return []
}

// Resolve an image source (data: URL, http(s) URL, file:// URL, or a plain path) to bytes.
async function bytesFrom(src: string): Promise<{ bytes: Uint8Array; filename: string }> {
  if (src.startsWith("data:")) {
    const comma = src.indexOf(",")
    const ext = src.slice(5, comma).split(";")[0].split("/")[1] || "png"
    return { bytes: new Uint8Array(Buffer.from(src.slice(comma + 1), "base64")), filename: `input.${ext}` }
  }
  if (src.startsWith("http://") || src.startsWith("https://")) {
    const r = await fetch(src)
    if (!r.ok) throw new Error(`Could not fetch the attached image (${r.status}).`)
    return {
      bytes: new Uint8Array(await r.arrayBuffer()),
      filename: path.basename(new URL(src).pathname) || "input.png",
    }
  }
  const p = src.startsWith("file://") ? fileURLToPath(src) : src
  return { bytes: new Uint8Array(await readFile(p)), filename: path.basename(p) }
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
          const abs = (p: string) => (path.isAbsolute(p) ? p : path.join(instance.directory, p))
          const explicit = (params.images ?? []).slice(0, 3).map(abs)
          const outAbs = params.output ? abs(params.output) : undefined

          // Guard model-chosen file paths (reads + writes) outside the workspace.
          for (const p of explicit) yield* assertExternalDirectoryEffect(ctx, p)
          if (outAbs) yield* assertExternalDirectoryEffect(ctx, outAbs)

          // Edit inputs: explicit paths win; otherwise pick up the image the user attached this turn.
          const attached = explicit.length === 0 && params.mode === "edit" ? attachedImages(ctx.messages).slice(0, 3) : []
          const sources = explicit.length > 0 ? explicit : attached.map((a) => a.url)
          const wantEdit = params.mode === "edit" || explicit.length > 0
          const isEdit = sources.length > 0
          if (wantEdit && !isEdit)
            throw new Error("Edit mode needs an image - attach one to your message, or pass file paths in `images`.")

          yield* ctx.ask({
            permission: "image",
            patterns: [isEdit ? "edit" : "generate"],
            always: ["*"],
            metadata: { prompt: params.prompt, mode: isEdit ? "edit" : "generate", inputs: sources.length },
          })

          const info = yield* auth.get(DARK_LLM_PROVIDER_ID).pipe(Effect.orElseSucceed(() => undefined))
          const key = (info && info.type === "api" ? info.key : undefined) ?? process.env[DARK_LLM_ENV_KEY]
          if (!key) throw new Error("Not signed in to Dark LLM - run /login first (or set DARK_LLM_KEY).")

          const data = yield* Effect.promise(async () => {
            let resp: Response
            if (isEdit) {
              const form = new FormData()
              form.append("model", "qwen-image-edit")
              form.append("prompt", params.prompt)
              for (const s of sources) {
                const { bytes, filename } = await bytesFrom(s)
                form.append("image", new Blob([bytes]), filename)
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
                  : path.join(instance.directory, `image-${Date.now()}${items.length > 1 ? "-" + (i + 1) : ""}.png`)
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
