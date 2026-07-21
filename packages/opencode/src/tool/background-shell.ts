import { Effect, Schema, Stream } from "effect"
import * as Tool from "./tool"
import { Config } from "@/config/config"
import { BackgroundJob } from "@/background/job"
import { InstanceState } from "@/effect/instance-state"
import { Shell } from "@opencode-ai/core/shell"
import { ChildProcess } from "effect/unstable/process"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"

// A non-blocking shell: run a command in the background (dev servers, watchers, `tail -f`, long builds),
// read its accumulated output on demand, and kill it. The regular `bash` tool is synchronous and kills
// anything that outlives its timeout, so it can't run these.
//
// Lifecycle / leak-safety: each job runs as a BackgroundJob whose `run` effect spawns the process inside
// an `Effect.scoped`. Cancelling the job (bash_kill), the session ending (run-state `cancelBackgroundJobs`
// interrupts session jobs), or the app tearing down all interrupt that run -> the scope closes -> the
// child is killed. So a background child never outlives darkcode.

const MAX_OUTPUT_CHARS = 100_000 // rolling tail kept per job; older output is dropped

type Status = "running" | "exited" | "killed"

type LiveJob = {
  id: string
  command: string
  output: string
  cursor: number // chars already returned by bash_output
  status: Status
  exitCode: number | null
  startedAt: number
}

const jobs = new Map<string, LiveJob>()
let counter = 0
const nextId = () => `bg-${++counter}`

function append(id: string, text: string) {
  const job = jobs.get(id)
  if (!job) return
  job.output += text
  if (job.output.length > MAX_OUTPUT_CHARS) {
    const drop = job.output.length - MAX_OUTPUT_CHARS
    job.output = job.output.slice(drop)
    job.cursor = Math.max(0, job.cursor - drop) // keep the read cursor pointing at the same live text
  }
}

function finish(id: string, status: Exclude<Status, "running">, exitCode: number | null) {
  const job = jobs.get(id)
  if (job && job.status === "running") {
    job.status = status
    job.exitCode = exitCode
  }
}

function buildCmd(shell: string, command: string, cwd: string, env: NodeJS.ProcessEnv) {
  if (process.platform === "win32" && Shell.ps(shell)) {
    return ChildProcess.make(shell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command], {
      cwd,
      env,
      stdin: "ignore",
      detached: false,
    })
  }
  return ChildProcess.make(command, [], { shell, cwd, env, stdin: "ignore", detached: process.platform !== "win32" })
}

// --- bash_background: start a command, return its id immediately -------------------------------------

const BackgroundParameters = Schema.Struct({
  command: Schema.String.annotate({ description: "The shell command to run in the background." }),
  description: Schema.optional(Schema.String).annotate({
    description: "A short label for this job (e.g. 'dev server').",
  }),
})

type BackgroundMetadata = { id: string; command: string }

export const BashBackgroundTool = Tool.define(
  "bash_background",
  Effect.gen(function* () {
    const config = yield* Config.Service
    const spawner = yield* ChildProcessSpawner
    const background = yield* BackgroundJob.Service

    return {
      description: [
        "Run a shell command in the BACKGROUND (non-blocking). Use this for long-running or",
        "never-exiting commands you want to keep running and monitor: dev servers (npm run dev, vite,",
        "next dev), file watchers, `tail -f`, or long builds/tests. It returns a job id immediately",
        "instead of blocking. Read its accumulated output any time with `bash_output` (pass the id),",
        "and stop it with `bash_kill`. For ordinary commands that finish quickly, use the regular",
        "`bash` tool instead - not this one.",
      ].join(" "),
      parameters: BackgroundParameters,
      execute: (params: Schema.Schema.Type<typeof BackgroundParameters>, ctx: Tool.Context<BackgroundMetadata>) =>
        Effect.gen(function* () {
          const instanceCtx = yield* InstanceState.context
          const cwd = instanceCtx.directory
          const shell = Shell.acceptable((yield* config.get()).shell)
          const env = { ...process.env } as NodeJS.ProcessEnv
          const id = nextId()

          jobs.set(id, {
            id,
            command: params.command,
            output: "",
            cursor: 0,
            status: "running",
            exitCode: null,
            startedAt: Date.now(),
          })

          const run = Effect.scoped(
            Effect.gen(function* () {
              const handle = yield* spawner.spawn(buildCmd(shell, params.command, cwd, env))
              yield* Effect.forkScoped(
                Stream.runForEach(Stream.decodeText(handle.all), (chunk) => Effect.sync(() => append(id, chunk))),
              )
              const code = yield* handle.exitCode
              finish(id, "exited", code ?? null)
              return jobs.get(id)?.output ?? ""
            }),
          ).pipe(
            Effect.onInterrupt(() => Effect.sync(() => finish(id, "killed", null))),
            Effect.provideService(ChildProcessSpawner, spawner),
          )

          yield* background.start({ id, type: "bash_background", title: params.description ?? params.command, run })

          yield* ctx.metadata({ metadata: { id, command: params.command } })
          return {
            title: params.description ?? params.command,
            metadata: { id, command: params.command },
            output: [
              `Started background shell \`${id}\`: ${params.command}`,
              `It runs until it exits or you stop it. Read its output with the bash_output tool (id "${id}")`,
              `and stop it with bash_kill (id "${id}").`,
            ].join("\n"),
          }
        }),
    } satisfies Tool.DefWithoutID<typeof BackgroundParameters, BackgroundMetadata>
  }),
)

// --- bash_output: read new output since last read ----------------------------------------------------

const OutputParameters = Schema.Struct({
  id: Schema.String.annotate({ description: "The background job id returned by bash_background." }),
})

type OutputMetadata = { id: string; status: string }

function statusLine(job: LiveJob) {
  if (job.status === "running") return "[running]"
  if (job.status === "killed") return "[stopped]"
  return `[exited${job.exitCode === null ? "" : ` code ${job.exitCode}`}]`
}

export const BashOutputTool = Tool.define(
  "bash_output",
  Effect.succeed({
    description:
      "Read the NEW output a background shell job (from bash_background) has produced since you last " +
      "read it. Pass the job `id`. Also reports whether the job is still running or has exited (with " +
      "its exit code). Call it again later to see further output.",
    parameters: OutputParameters,
    execute: (params: Schema.Schema.Type<typeof OutputParameters>, _ctx: Tool.Context<OutputMetadata>) =>
      Effect.gen(function* () {
        const job = jobs.get(params.id)
        if (!job) {
          const known = [...jobs.keys()]
          return {
            title: params.id,
            metadata: { id: params.id, status: "unknown" },
            output: `No background job "${params.id}".${known.length ? ` Known jobs: ${known.join(", ")}.` : ""}`,
          }
        }
        const text = job.output.slice(job.cursor)
        job.cursor = job.output.length
        return {
          title: job.command,
          metadata: { id: job.id, status: job.status },
          output: `${statusLine(job)}\n${text || "(no new output)"}`,
        }
      }),
  } satisfies Tool.DefWithoutID<typeof OutputParameters, OutputMetadata>),
)

// --- bash_kill: stop a background job ----------------------------------------------------------------

const KillParameters = Schema.Struct({
  id: Schema.String.annotate({ description: "The background job id to stop." }),
})

type KillMetadata = { id: string; status: string }

export const BashKillTool = Tool.define(
  "bash_kill",
  Effect.gen(function* () {
    const background = yield* BackgroundJob.Service
    return {
      description: "Stop/terminate a background shell job started with bash_background, by its `id`.",
      parameters: KillParameters,
      execute: (params: Schema.Schema.Type<typeof KillParameters>, _ctx: Tool.Context<KillMetadata>) =>
        Effect.gen(function* () {
          const job = jobs.get(params.id)
          if (!job) {
            return {
              title: params.id,
              metadata: { id: params.id, status: "unknown" },
              output: `No background job "${params.id}".`,
            }
          }
          yield* background.cancel(params.id)
          finish(params.id, "killed", null)
          return {
            title: job.command,
            metadata: { id: params.id, status: "killed" },
            output: `Stopped background shell \`${params.id}\`.`,
          }
        }),
    } satisfies Tool.DefWithoutID<typeof KillParameters, KillMetadata>
  }),
)
