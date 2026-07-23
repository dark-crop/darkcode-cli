# Writing a new tool

A "tool" is a function the model can call (read, write, bash, image, memory, ...). Adding one is
**4 edits + 2 new files**. Do the steps below IN ORDER and exactly. Do not skip the registration
step - a tool file that is not registered does nothing.

Everything lives in `packages/opencode/src/tool/`.

> Effect v4 (beta) names: use `Effect.catch` (NOT `catchAll`), `Schema.Literals([...])` (NOT
> `Schema.Literal(a,b)`), `Effect.tryPromise`. Do not use `try/catch`.

---

## FAST PATH: copy this, rename, register

We will add a tool called **`wordcount`**. To make your own tool, copy these two files, replace
`wordcount` / `WordCount` with your name everywhere, and change the `execute` body. Then do the
4 registry edits. Keep the pattern identical.

### Step 1 - create `packages/opencode/src/tool/wordcount.txt`

This file is the description the model reads. Write it AS INSTRUCTIONS to the model. Always include a
"WHEN NOT TO USE" line.

```
Count the words in a file.

WHEN TO USE: the user asks how long a file is, its word count, or a size summary.

WHEN NOT TO USE: do NOT use this to read or show file contents - use the read tool for that.
```

### Step 2 - create `packages/opencode/src/tool/wordcount.ts`

Copy this WHOLE file. It compiles as-is. Change only the id string, the `Parameters`, the `Metadata`,
and the `execute` body.

```ts
import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import DESCRIPTION from "./wordcount.txt"

// The arguments the model fills in. Put a clear `description` on EVERY field.
const Parameters = Schema.Struct({
  path: Schema.String.annotate({ description: "Absolute path to the file to count words in." }),
})

// Anything you want to keep on the tool call for the UI. Can be an empty object.
type Metadata = { path: string; count: number }

export const WordCountTool = Tool.define(
  "wordcount", // <- the id the model calls. short, lowercase, no spaces.
  Effect.succeed({
    description: DESCRIPTION,
    parameters: Parameters,
    execute: (params: Schema.Schema.Type<typeof Parameters>, _ctx: Tool.Context<Metadata>) =>
      Effect.gen(function* () {
        const text = yield* Effect.tryPromise(() => Bun.file(params.path).text())
        const count = text.split(/\s+/).filter(Boolean).length
        return {
          title: params.path, // short label shown in the transcript
          metadata: { path: params.path, count },
          output: `${count} words in ${params.path}`, // <- what the MODEL receives back
        }
      }),
  } satisfies Tool.DefWithoutID<typeof Parameters, Metadata>),
)
```

The three keys `execute` must return: **`title`** (short label), **`metadata`** (your object),
**`output`** (the string the model reads back - keep it the useful result, summarise big output like
`Wrote foo.ts (42 lines)`).

### Step 3 - register it in `packages/opencode/src/tool/registry.ts` (4 edits)

This is the step that is easy to get wrong. There are **4 places**, and the existing **`memory`** tool
appears in ALL 4. So: find where `memory` is wired, and add your tool right next to it each time. Same
order every time.

**Edit 3a - the import** (top of file). Find this line:
```ts
import { MemoryTool } from "./memory"
```
Add right after it:
```ts
import { WordCountTool } from "./wordcount"
```

**Edit 3b - the bind** (inside the big `Effect.gen`). Find:
```ts
    const memorytool = yield* MemoryTool
```
Add right after it:
```ts
    const wordcount = yield* WordCountTool
```

**Edit 3c - the tool map** (inside `Effect.all({ ... })`). Find:
```ts
          memory: Tool.init(memorytool),
```
Add right after it:
```ts
          wordcount: Tool.init(wordcount),
```

**Edit 3d - the builtin array** (turns it on by default). Find:
```ts
            tool.memory,
```
Add right after it:
```ts
            tool.wordcount,
```

That is all 4. If you skip 3d the tool exists but is off. If you skip any of 3a-3c it will not compile.

### Step 4 - typecheck

```
cd packages/opencode && bun run typecheck
```

Must be clean. If it says "Missing dependencies", your tool used a service - see "Services" below.

You are done. The model can now call `wordcount`.

---

## Reference (only if the fast path is not enough)

### Services (config, database, subprocess spawner, ...)

If your tool needs a service, bind it in the SECOND argument of `Tool.define` (an `Effect.gen` instead
of `Effect.succeed`), and the `execute` closure can use it:

```ts
import { Config } from "@/config/config"

export const MyTool = Tool.define(
  "mytool",
  Effect.gen(function* () {
    const config = yield* Config.Service // bind services here, first, as named vars
    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params, _ctx) =>
        Effect.gen(function* () {
          const cfg = yield* config.get()
          return { title: "...", metadata: {}, output: "..." }
        }),
    } satisfies Tool.DefWithoutID<typeof Parameters, Metadata>
  }),
)
```

If typecheck then says **"Missing dependencies"**, that service's node is not provided to the tool
layer yet. Add it to the `deps` array of the `node` at the BOTTOM of `registry.ts`:
```ts
export const node = LayerNode.make({ service: Service, layer, deps: [ /* ..., */ Config.node ] })
```

### The `ctx` argument

`execute(params, ctx)` gets a context object:

| field | use |
|---|---|
| `ctx.abort` | an `AbortSignal`. For long/streaming work, stop when it fires so Esc cancels. |
| `ctx.metadata({ metadata })` | push a live update mid-run (streaming output/progress). Returns an `Effect`, so `yield*` it. |
| `ctx.ask({ permission, patterns, always, metadata })` | ask permission before a risky action. Blocks until allowed. |
| `ctx.sessionID`, `ctx.callID` | ids for this call. |

Working directory is NOT on `ctx`. Read it from the instance context:
```ts
import { InstanceState } from "@/effect/instance-state"
const instanceCtx = yield* InstanceState.context
const cwd = instanceCtx.directory // and instanceCtx.worktree
```

### Streaming live output

Call `ctx.metadata` repeatedly (the shell tool does this and the TUI renders it live):
```ts
yield* ctx.metadata({ metadata: { output: "" } })
// ...as more arrives:
yield* ctx.metadata({ metadata: { output: accumulatedSoFar } })
```

### Permissions (for anything with side effects)

Gate writes/commands/network behind `ctx.ask` before doing them:
```ts
yield* ctx.ask({
  permission: "mytool", // the permission key
  patterns: [params.path], // what is being acted on (used for allow-once / always)
  always: ["*"],
  metadata: {},
})
```

### Optional: gate a tool behind a flag

In the `builtin` array you can make a tool conditional:
```ts
...(flags.experimentalX ? [tool.x] : []),
```

### Optional: custom TUI rendering

By default a tool call renders generically. For a custom look, add a component to `PART_MAPPING` in
`packages/tui/src/routes/session/index.tsx` keyed by your tool id, and read your `metadata` there. Only
do this if the default is not enough.

### Optional: a test

```ts
const layer = Layer.mergeAll(
  LayerNode.compile(LayerNode.group([Config.node /* ...your deps */])),
  testInstanceStoreLayer,
)
const it = testEffect(layer) // it.live(...) for real timers/subprocesses

it.live("counts words", () =>
  Effect.gen(function* () {
    const tool = yield* (yield* WordCountTool).init()
    const res = yield* tool.execute({ path: "/tmp/x.txt" }, ctx).pipe(provideInstance(process.cwd()))
    expect(res.output).toContain("words")
  }))
```
Run from the package dir, never the repo root: `cd packages/opencode && bun test test/tool/wordcount.test.ts`.

---

## Rules the local model MUST follow (common failures)

- **Register in all 4 places** (3a-3d). The #1 reason a new tool "does nothing" is a missing registry edit.
- **`output` is for the model, not the human.** Return the result/data. Summarise big output.
- **The description does the steering.** Always include "WHEN NOT TO USE" - the model over-calls without it.
- **No `try/catch`.** Use `Effect.tryPromise` for promises and `Effect.catch` for recovery.
- **Bind services first** as named vars. Never `yield* (yield* Foo.Service).bar()`.
- **id = short, lowercase, no spaces** (`wordcount`, `bash_kill`). It is the name the model types.

## Final checklist

- [ ] `tool/<name>.txt` written, with a WHEN NOT TO USE line
- [ ] `tool/<name>.ts` created from the template, `execute` returns `{ title, metadata, output }`
- [ ] registry.ts edit 3a (import) done
- [ ] registry.ts edit 3b (bind) done
- [ ] registry.ts edit 3c (map entry) done
- [ ] registry.ts edit 3d (builtin array) done
- [ ] `cd packages/opencode && bun run typecheck` is clean
