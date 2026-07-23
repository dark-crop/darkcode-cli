import { createMemo, createSignal, createEffect, onCleanup, For, Show } from "solid-js"
import { useRoute, useRouteData } from "../../context/route"
import { useSync } from "../../context/sync"
import { useTheme } from "../../context/theme"
import type { AssistantMessage } from "@opencode-ai/sdk/v2"
import { Locale } from "../../util/locale"

/** Claude-style agent panel: a persistent footer list of the main session plus every subagent,
 * each with live elapsed time and streamed output tokens. The active session is marked, and
 * clicking any row jumps the view into that agent's own chat screen (where you can prompt it).
 * Shown while a fan-out is active or while viewing a subagent; hidden once everything is idle
 * on the main view so the footer stays clean. */
export function AgentPanel() {
  const route = useRouteData("session")
  const { navigate } = useRoute()
  const sync = useSync()
  const { theme } = useTheme()

  const current = createMemo(() => sync.session.get(route.sessionID))
  const mainID = createMemo(() => current()?.parentID ?? current()?.id)

  const rows = createMemo(() => {
    const main = mainID()
    if (!main) return []
    return sync.data.session
      .filter((x) => x.id === main || x.parentID === main)
      .toSorted((a, b) => a.time.created - b.time.created)
  })
  const subs = createMemo(() => rows().filter((x) => x.id !== mainID()))
  const anyBusy = createMemo(() => rows().some((x) => sync.data.session_status[x.id]?.type === "busy"))
  const visible = createMemo(() => subs().length > 0 && (anyBusy() || !!current()?.parentID))

  const [now, setNow] = createSignal(Date.now())
  createEffect(() => {
    if (!anyBusy()) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    onCleanup(() => clearInterval(timer))
  })

  function stat(id: string) {
    const msgs = sync.data.message[id] ?? []
    const out = msgs.reduce(
      (sum, m) => sum + (m.role === "assistant" ? ((m as AssistantMessage).tokens?.output ?? 0) : 0),
      0,
    )
    const busy = sync.data.session_status[id]?.type === "busy"
    const start = sync.session.get(id)?.time.created ?? now()
    const lastEnd = msgs.reduce(
      (mx, m) => Math.max(mx, m.role === "assistant" ? ((m as AssistantMessage).time?.completed ?? 0) : 0),
      0,
    )
    const end = busy ? now() : lastEnd || start
    const secs = Math.max(0, Math.floor((end - start) / 1000))
    const elapsed = secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`
    const tk = out >= 1000 ? (out / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(out)
    return { elapsed, tokens: out > 0 ? `↓ ${tk} tokens` : undefined }
  }

  return (
    <Show when={visible()}>
      <box flexShrink={0} paddingTop={1} paddingLeft={2} paddingRight={2}>
        <For each={rows()}>
          {(s) => {
            const active = createMemo(() => s.id === route.sessionID)
            const isMain = s.id === mainID()
            const agent = s.title.match(/@(\w+) subagent/)?.[1] ?? "agent"
            const task = s.title.replace(/\s*\(@\w+ subagent\)\s*$/, "").trim()
            const st = createMemo(() => stat(s.id))
            return (
              <box
                flexDirection="row"
                justifyContent="space-between"
                gap={2}
                onMouseUp={() => navigate({ type: "session", sessionID: s.id })}
              >
                <box flexDirection="row" gap={1}>
                  <text fg={active() ? theme.primary : theme.textMuted}>{active() ? "●" : "○"}</text>
                  <Show
                    when={!isMain}
                    fallback={
                      <text fg={theme.text}>
                        <b>main</b>
                      </text>
                    }
                  >
                    <text fg={theme.text}>
                      <b>{Locale.titlecase(agent)}</b>
                    </text>
                    <text fg={theme.textMuted} wrapMode="none">
                      {task}
                    </text>
                  </Show>
                </box>
                <Show when={!isMain}>
                  <text fg={theme.textMuted} wrapMode="none">
                    {[st().elapsed, st().tokens].filter(Boolean).join(" · ")}
                  </text>
                </Show>
              </box>
            )
          }}
        </For>
      </box>
    </Show>
  )
}
