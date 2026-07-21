import { describe, expect } from "bun:test"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Effect, Layer } from "effect"
import { Config } from "@/config/config"
import { BashBackgroundTool, BashOutputTool, BashKillTool } from "../../src/tool/background-shell"
import { provideInstance, testInstanceStoreLayer } from "../fixture/fixture"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "@/tool/truncate"
import { SessionID, MessageID } from "../../src/session/schema"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Plugin } from "../../src/plugin"
import { testEffect } from "../lib/effect"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { BackgroundJob } from "@/background/job"

const layer = Layer.mergeAll(
  LayerNode.compile(
    LayerNode.group([
      CrossSpawnSpawner.node,
      FSUtil.node,
      Plugin.node,
      Truncate.node,
      Config.node,
      Agent.node,
      RuntimeFlags.node,
      BackgroundJob.node,
    ]),
  ),
  testInstanceStoreLayer,
)
const it = testEffect(layer)

const ctx = {
  sessionID: SessionID.make("ses_test"),
  messageID: MessageID.make("msg_test"),
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
  ask: () => Effect.void,
} as any

const startBg = Effect.fn(function* (command: string) {
  const tool = yield* (yield* BashBackgroundTool).init()
  return yield* tool.execute({ command }, ctx)
})
const readBg = Effect.fn(function* (id: string) {
  const tool = yield* (yield* BashOutputTool).init()
  return yield* tool.execute({ id }, ctx)
})
const killBg = Effect.fn(function* (id: string) {
  const tool = yield* (yield* BashKillTool).init()
  return yield* tool.execute({ id }, ctx)
})

const dir = process.cwd()

describe("background-shell", () => {
  it.live("captures output and reports exit", () =>
    Effect.gen(function* () {
      const started = yield* startBg("echo alpha; echo beta").pipe(provideInstance(dir))
      const id = (started.metadata as any).id as string
      expect(id).toMatch(/^bg-\d+$/)

      // Poll until the job exits (bounded).
      let last = ""
      let exited = false
      for (let i = 0; i < 40 && !exited; i++) {
        yield* Effect.sleep("100 millis")
        const out = yield* readBg(id).pipe(provideInstance(dir))
        last += out.output
        if ((out.metadata as any).status === "exited") exited = true
      }
      expect(exited).toBe(true)
      expect(last).toContain("alpha")
      expect(last).toContain("beta")
    }))

  it.live("kills a long-running job and the OS process is gone (no leak)", () =>
    Effect.gen(function* () {
      // The command prints its own PID, then blocks. detached => that PID leads the process group.
      const started = yield* startBg("echo PID=$$; sleep 60").pipe(provideInstance(dir))
      const id = (started.metadata as any).id as string

      let pid = 0
      for (let i = 0; i < 40 && !pid; i++) {
        yield* Effect.sleep("100 millis")
        const out = yield* readBg(id).pipe(provideInstance(dir))
        const m = out.output.match(/PID=(\d+)/)
        if (m) pid = Number(m[1])
      }
      expect(pid).toBeGreaterThan(0)
      // Alive before kill.
      expect(() => process.kill(pid, 0)).not.toThrow()

      const killed = yield* killBg(id).pipe(provideInstance(dir))
      expect((killed.metadata as any).status).toBe("killed")

      // The child (and its group) should be gone shortly after.
      let dead = false
      for (let i = 0; i < 40 && !dead; i++) {
        yield* Effect.sleep("100 millis")
        try {
          process.kill(pid, 0)
        } catch {
          dead = true
        }
      }
      expect(dead).toBe(true)

      const after = yield* readBg(id).pipe(provideInstance(dir))
      expect((after.metadata as any).status).toBe("killed")
    }))

  it.live("reports unknown ids without throwing", () =>
    Effect.gen(function* () {
      const out = yield* readBg("bg-does-not-exist").pipe(provideInstance(dir))
      expect(out.output).toContain("No background job")
    }))
})
