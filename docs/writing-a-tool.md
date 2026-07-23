# Writing a new tool

A "tool" is a function the model can call (read, write, bash, image, memory, ...). Adding one is three
steps: **define** it, **register** it, and (optionally) give it **custom rendering** in the TUI. Tools
live in `packages/opencode/src/tool/`. Read `todo.ts` for the smallest real example and
`background-shell.ts` for a fuller one (services, live output, a companion tool).

> This codebase uses **Effect v4 (beta)**. A few names differ from Effect 3: `Effect.catch` (not
> `catchAll`), `Schema.Literals([...])` (not `Schema.Literal(a, b)`), `Effect.tryPromise`. Prefer Effect
> combinators over `try/catch`.

---

## 1. The shape of a tool

```ts
import { Effect, Schema } from "effect"
import * as Tool from "./tool"

// The model-facing arguments. Every field's `description` is what the model reads to fill it in.
const Parameters = Schema.Struct({
  path: Schema.String.annotate({ description: "Absolute path to the file to inspect." }),
  lines: Schema.optional(Schema.Number).annotate({ description: "Max lines to return (default 50)." }),
})

// Whatever you want to attach to the tool call for the TUI / later inspection.
type Metadata = { path: string; count: number }

export const WordCountTool = Tool.define(
  "wordcount", // the tool id = the name the model calls. keep it short + verb-ish.
  Effect.succeed({
    description:
      "Count the words in a file. Use when the user asks how long a file is or wants a size summary. " +
      "Do NOT use to read file contents - use the read tool for that.",
    parameters: Parameters,
    execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context<Metadata>) =>
      Effect.gen(function* () {
        const text = yield* Effect.tryPromise(() => Bun.file(params.path).text())
        const count = text.split(/\s+/).filter(Boolean).length
        return {
          title: params.path,          // short label shown in the transcript header
          metadata: { path: params.path, count },
          output: `${count} words in ${params.path}`, // <- THIS is what the model sees back
        }
      }),
  } satisfies Tool.DefWithoutID<typeof Parameters, Metadata>),
)
```

That is a complete, working tool. Two things to internalize:

- **`output` is the tool's return value to the model** - keep it the useful result, not a human message.
  For a big result, summarise (e.g. `Wrote foo.ts (42 lines)`), don't dump the whole thing.
- **`description` + parameter `annotate({description})` are the only guidance the model gets.** Say what
  the tool does, *when to use it*, and *when NOT to* (the local model needs the negative case spelled out).

---

## 2. When the tool needs services (config, db, spawner, ...)

`Tool.define`'s second arg is an `Effect` that runs **once** at init. Bind services there and the
`execute` closure captures them:

```ts
import { Config } from "@/config/config"
import { BackgroundJob } from "@/background/job"

export const MyTool = Tool.define(
  "mytool",
  Effect.gen(function* () {
    const config = yield* Config.Service          // bind services first (house style: no nested yields)
    const background = yield* BackgroundJob.Service
    return {
      description: "...",
      parameters: Parameters,
      execute: (params, ctx) =>
        Effect.gen(function* () {
          const cfg = yield* config.get()
          // ... use cfg, background, etc.
          return { title: "...", metadata: {}, output: "..." }
        }),
    } satisfies Tool.DefWithoutID<typeof Parameters, Metadata>
  }),
)
```

If a service you yield isn't already provided to the tool layer, you must add its node to the registry
deps (step 3) or the layer won't compile ("Missing dependencies").

---

## 3. The context (`ctx: Tool.Context<Metadata>`)

`execute` receives the params and a context object:

| field | use |
|---|---|
| `ctx.sessionID`, `ctx.callID` | ids for the current call |
| `ctx.abort` | an `AbortSignal` - honour it for long/streaming work so Esc actually cancels |
| `ctx.metadata({ metadata })` | **push a live update** mid-run (streaming output, progress). Returns an `Effect`. |
| `ctx.ask({ permission, patterns, always, metadata })` | **request permission** before a risky action (see below) |
| `ctx.messages` | the conversation so far (rarely needed) |

For the working directory / worktree, read the instance context (NOT `ctx`):

```ts
import { InstanceState } from "@/effect/instance-state"
const instanceCtx = yield* InstanceState.context
const cwd = instanceCtx.directory     // and instanceCtx.worktree
```

### Live progress / streaming output

Call `ctx.metadata` repeatedly to stream. The shell tool streams command output this way, and the TUI
renders it live:

```ts
yield* ctx.metadata({ metadata: { output: "" } })
// ... as chunks arrive:
yield* ctx.metadata({ metadata: { output: accumulatedSoFar } })
```

### Permissions

Gate anything with side effects behind `ctx.ask`. It throws/blocks until the user allows:

```ts
yield* ctx.ask({
  permission: "mytool",        // the permission key (also used in agent permission rulesets)
  patterns: ["*"],             // what is being acted on (e.g. a path); used for allow-once/always rules
  always: ["*"],               // patterns eligible for "always allow"
  metadata: {},
})
```

---

## 4. Register the tool (`tool/registry.ts`)

Three edits in `packages/opencode/src/tool/registry.ts`:

```ts
// a) import
import { WordCountTool } from "./wordcount"

// b) bind it (near the other `const x = yield* XTool`)
const wordcount = yield* WordCountTool

// c) add to the tool map...
wordcount: Tool.init(wordcount),

// ...and to the `builtin: [...]` array so it's on by default
tool.wordcount,
```

If your tool yields a service that isn't already a dep, add its node to the layer at the bottom of the
file:

```ts
export const node = LayerNode.make({ service: Service, layer, deps: [ /* ..., */ BackgroundJob.node ] })
```

Optional gating: a tool can be conditional on a flag (`...(flags.experimentalX ? [tool.x] : [])`) or a
provider (see how `webSearchEnabled` filters `tool.search` in `tools()`).

---

## 5. Test it

Tools are testable in isolation - compile a small layer with just the services the tool needs, init it,
and call `execute`. Pattern (see `test/tool/background-shell.test.ts`):

```ts
const layer = Layer.mergeAll(
  LayerNode.compile(LayerNode.group([Config.node, Truncate.node, Agent.node, /* ...your deps */])),
  testInstanceStoreLayer,
)
const it = testEffect(layer)               // use it.live(...) for real timers / subprocesses

it.live("counts words", () =>
  Effect.gen(function* () {
    const tool = yield* (yield* WordCountTool).init()
    const res = yield* tool.execute({ path: "/tmp/x.txt" }, ctx).pipe(provideInstance(process.cwd()))
    expect(res.output).toContain("words")
  }))
```

Run from the package dir (never the repo root): `cd packages/opencode && bun test test/tool/mytool.test.ts`.
Typecheck: `bun run typecheck` in `packages/opencode`.

---

## 6. (Optional) custom rendering in the TUI

By default a tool call renders generically. For a bespoke look (like the write diff or shell output),
add a component to `PART_MAPPING` in `packages/tui/src/routes/session/index.tsx` keyed by your tool id,
and read your `metadata` there. Only do this if the default rendering is not enough.

---

## Conventions & gotchas

- **`output` is for the model, not the human.** Return the result/data; summarise big outputs.
- **Descriptions carry the weight.** Spell out when to use and when NOT to - the local model over/under-calls
  without it. (See the gateway `chat_tool_gate` for how tool intent is nudged server-side too.)
- **Honour `ctx.abort`** for long work, and stream via `ctx.metadata` so Esc and the live UI work.
- **Fail safe.** A tool that can partially fail should degrade, not crash the turn. Use Effect error
  handling (`Effect.catch`), not `try/catch`.
- **Effect v4:** `Effect.catch`, `Schema.Literals([...])`, `Effect.tryPromise`. Bind services to named
  vars first; avoid nested `yield* (yield* Foo.Service).bar()`.
- **Naming:** the tool `id` is the name the model sees - short, lowercase, verb-ish (`read`, `bash_kill`,
  `wordcount`).

## Checklist

- [ ] `tool/<name>.ts` with `Tool.define(id, ...)` returning `{ description, parameters, execute }`
- [ ] `parameters` = `Schema.Struct` with a `description` on every field
- [ ] `execute` returns `{ title, metadata, output }`; `output` is the model-facing result
- [ ] registered in `registry.ts` (import, bind, map entry, `builtin` array) + any new dep node added
- [ ] `bun run typecheck` clean in `packages/opencode`
- [ ] a `test/tool/<name>.test.ts` covering the happy path (+ a failure/edge if it has side effects)
