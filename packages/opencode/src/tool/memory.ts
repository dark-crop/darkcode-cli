import path from "path"
import * as fsp from "node:fs/promises"
import { Effect, Schema } from "effect"
import { InstanceState } from "@/effect/instance-state"
import { Global } from "@opencode-ai/core/global"
import DESCRIPTION from "./memory.txt"
import * as Tool from "./tool"

export const Parameters = Schema.Struct({
  action: Schema.Literals(["save", "recall", "delete"]).annotate({
    description: "save = create/update a memory; recall = read a memory's full body; delete = remove one",
  }),
  scope: Schema.Literals(["global", "project"]).annotate({
    description: "global = durable facts about the USER (all projects); project = facts about THIS repo",
  }),
  slug: Schema.String.annotate({
    description: "kebab-case id for the memory, e.g. 'prefers-bun' or 'deploy-schedule'",
  }),
  description: Schema.optional(Schema.String).annotate({
    description: "save only: a one-line hook shown in the memory index (what this memory is about)",
  }),
  body: Schema.optional(Schema.String).annotate({
    description: "save only: the fact itself (markdown) - the full content that gets recalled later",
  }),
})

const INDEX = "MEMORY.md"

// The MEMORY.md index holds one bullet per memory: `- [slug](slug.md) - description`. The index is
// injected into every session (see session/instruction.ts); the per-slug files are recalled on demand.
export const MemoryTool = Tool.define(
  "memory",
  Effect.gen(function* () {
    const global = yield* Global.Service
    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (
        params: {
          action: "save" | "recall" | "delete"
          scope: "global" | "project"
          slug: string
          description?: string
          body?: string
        },
        _ctx: Tool.Context,
      ) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const dir =
            params.scope === "global"
              ? path.join(global.config, "memory")
              : path.join(instance.worktree, ".darkcode", "memory")
          const slug = params.slug
            .trim()
            .replace(/[^a-zA-Z0-9-]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .toLowerCase()
          if (!slug) throw new Error("memory: a kebab-case slug is required")
          const file = path.join(dir, slug + ".md")
          const indexPath = path.join(dir, INDEX)
          const meta = { scope: params.scope, action: params.action }

          if (params.action === "recall") {
            const content = yield* Effect.tryPromise(() => fsp.readFile(file, "utf8")).pipe(
              Effect.catch(() => Effect.succeed("")),
            )
            return { title: slug, metadata: meta, output: content || `No ${params.scope} memory '${slug}'.` }
          }

          // read + rewrite the index (bullets only; the "# Memory index" header is added at injection time)
          const idx = yield* Effect.tryPromise(() => fsp.readFile(indexPath, "utf8")).pipe(
            Effect.catch(() => Effect.succeed("")),
          )
          const kept = idx
            .split("\n")
            .map((l) => l.trimEnd())
            .filter((l) => l.startsWith("- [") && !l.includes(`(${slug}.md)`))
          yield* Effect.tryPromise(() => fsp.mkdir(dir, { recursive: true })).pipe(
            Effect.catch(() => Effect.succeed(undefined)),
          )

          if (params.action === "delete") {
            yield* Effect.tryPromise(() => fsp.unlink(file)).pipe(Effect.catch(() => Effect.succeed(undefined)))
            yield* Effect.tryPromise(() => fsp.writeFile(indexPath, kept.join("\n") + (kept.length ? "\n" : "")))
            return { title: slug, metadata: meta, output: `Deleted ${params.scope} memory '${slug}'.` }
          }

          // save (create or update)
          const desc = (params.description ?? "").trim() || slug
          const body = (params.body ?? "").trim()
          yield* Effect.tryPromise(() => fsp.writeFile(file, `---\ndescription: ${desc}\n---\n\n${body}\n`))
          kept.push(`- [${slug}](${slug}.md) - ${desc}`)
          kept.sort()
          yield* Effect.tryPromise(() => fsp.writeFile(indexPath, kept.join("\n") + "\n"))
          return { title: slug, metadata: meta, output: `Saved ${params.scope} memory '${slug}'.` }
        }).pipe(Effect.orDie),
    }
  }),
)
