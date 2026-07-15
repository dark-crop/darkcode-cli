import { createMemo, For, Show } from "solid-js"
import type { AssistantMessage } from "@opencode-ai/sdk/v2"
import { TextAttributes, type RGBA } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useSync } from "../context/sync"
import { useRoute } from "../context/route"
import { useLocal } from "../context/local"

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m"
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k"
  return String(n)
}

const BAR_CELLS = 40

/** /context — context-window usage: a segmented bar + per-category token breakdown. */
export function DialogContext() {
  const { theme } = useTheme()
  const sync = useSync()
  const route = useRoute()
  const local = useLocal()

  const sessionID = createMemo(() => (route.data.type === "session" ? route.data.sessionID : undefined))

  const info = createMemo(() => {
    const parsed = local.model.parsed()
    const current = local.model.current()
    const provider = current ? sync.data.provider.find((p) => p.id === current.providerID) : undefined
    const model = current ? provider?.models[current.modelID] : undefined
    const limit = model?.limit?.context ?? 0

    let br = { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 }
    let cost = 0
    const sid = sessionID()
    if (sid) {
      const msgs = (sync.data.message[sid] ?? []) as AssistantMessage[]
      const last = msgs.findLast(
        (m): m is AssistantMessage => m.role === "assistant" && (m.tokens?.output ?? 0) > 0,
      )
      if (last) {
        br = {
          input: last.tokens.input,
          output: last.tokens.output,
          reasoning: last.tokens.reasoning,
          cacheRead: last.tokens.cache.read,
          cacheWrite: last.tokens.cache.write,
        }
      }
      cost = sync.session.get(sid)?.cost ?? 0
    }
    const used = br.input + br.output + br.reasoning + br.cacheRead + br.cacheWrite
    const percent = limit ? Math.round((used / limit) * 100) : 0
    return { model: parsed.model, provider: parsed.provider, limit, used, percent, free: Math.max(0, limit - used), cost, br }
  })

  const categories = createMemo<{ label: string; tokens: number; color: RGBA }[]>(() => {
    const i = info()
    return [
      { label: "Input", tokens: i.br.input, color: theme.primary },
      { label: "Output", tokens: i.br.output, color: theme.accent },
      { label: "Reasoning", tokens: i.br.reasoning, color: theme.warning },
      { label: "Cache read", tokens: i.br.cacheRead, color: theme.secondary },
      { label: "Cache write", tokens: i.br.cacheWrite, color: theme.info },
    ]
  })

  // Build the segmented bar: cells colored by category proportion, remainder is free space.
  const bar = createMemo<RGBA[]>(() => {
    const i = info()
    const cells: RGBA[] = []
    if (i.limit > 0 && i.used > 0) {
      for (const c of categories()) {
        const n = Math.round((c.tokens / i.limit) * BAR_CELLS)
        for (let k = 0; k < n && cells.length < BAR_CELLS; k++) cells.push(c.color)
      }
    }
    while (cells.length < BAR_CELLS) cells.push(theme.backgroundElement)
    return cells.slice(0, BAR_CELLS)
  })

  return (
    <box paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Context Usage
        </text>
        <text fg={theme.textMuted}>esc</text>
      </box>

      <box flexDirection="row" gap={1}>
        <text fg={theme.text}>{info().model}</text>
        <text fg={theme.textMuted}>{info().provider}</text>
        <Show when={info().limit > 0}>
          <text fg={theme.textMuted}>· {fmt(info().limit)} context</text>
        </Show>
      </box>

      <box flexDirection="row">
        <For each={bar()}>{(c) => <text fg={c}>█</text>}</For>
        <text fg={theme.text}> {info().percent}%</text>
      </box>

      <box>
        <For each={categories()}>
          {(c) => (
            <box flexDirection="row" gap={1}>
              <text fg={c.color}>█</text>
              <text fg={theme.text} width={12}>
                {c.label}
              </text>
              <text fg={theme.textMuted}>{fmt(c.tokens)} tokens</text>
            </box>
          )}
        </For>
        <box flexDirection="row" gap={1}>
          <text fg={theme.backgroundElement}>█</text>
          <text fg={theme.text} width={12}>
            Free
          </text>
          <text fg={theme.textMuted}>
            {fmt(info().free)} tokens ({100 - info().percent}%)
          </text>
        </box>
      </box>

      <box flexDirection="row" gap={1}>
        <text fg={theme.text}>Used</text>
        <text fg={theme.textMuted}>
          {fmt(info().used)} / {fmt(info().limit)} · {money.format(info().cost)}
        </text>
      </box>
    </box>
  )
}
