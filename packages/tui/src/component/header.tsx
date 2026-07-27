import { createMemo } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useLocal } from "../context/local"
import { useDirectory } from "../context/directory"
import { useRoute } from "../context/route"
import { useSync } from "../context/sync"
import { DARK_LLM_PROVIDER_ID } from "../util/dark-llm"
import { Mascot } from "./mascot"

/**
 * Claude-Code-style welcome header: a rounded, brand-purple bordered box titled "darkcode <version>".
 * Left column welcomes you with the mascot + current model/cwd; right column lists getting-started
 * tips. Rendered once at the top of the home + session screens (it scrolls away as you chat).
 */
export function Header() {
  const { theme } = useTheme()
  const local = useLocal()
  const directory = useDirectory()
  const route = useRoute()
  const sync = useSync()

  // The model actually being VIEWED. A subagent session runs on its own lane (e.g. Mr.Agent), so read
  // it from that session's latest assistant message; fall back to the globally-selected model on the
  // home screen / before any reply. Returns { model, tier, provider }.
  const shown = createMemo(() => {
    const data = route.data
    const sid = data.type === "session" ? data.sessionID : undefined
    const modelID = sid ? (sync.data.message[sid] ?? []).findLast((m) => m.role === "assistant")?.modelID : undefined
    const parsed = local.model.parsed()
    if (modelID) {
      const name = sync.data.provider.find((p) => p.id === DARK_LLM_PROVIDER_ID)?.models[modelID]?.name ?? modelID
      const m = name.match(/^(.*?)\s*·\s*(low|med|high|ultra)\s*$/i)
      if (m) return { model: m[1], tier: m[2], provider: parsed.provider }
      const idm = modelID.match(/^(.+)-(low|med|high|ultra)$/)
      return { model: idm ? idm[1] : name, tier: idm?.[2], provider: parsed.provider }
    }
    return { model: parsed.model, tier: local.model.variant.current(), provider: parsed.provider }
  })

  return (
    <box
      flexShrink={0}
      flexDirection="row"
      border={true}
      borderStyle="rounded"
      borderColor={theme.primary}
      paddingLeft={2}
      paddingRight={2}
      marginTop={1}
      marginBottom={1}
    >
      {/* Left: mascot beside welcome + model / provider / cwd (compact row) */}
      <box flexGrow={1} flexBasis={0} flexDirection="row" gap={2} alignItems="center">
        <Mascot mini />
        <box justifyContent="center">
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            Welcome back!
          </text>
          <text>
            <span style={{ fg: theme.text }}>{shown().model}</span>
            {shown().tier ? <span style={{ fg: theme.textMuted }}> · {shown().tier}</span> : null}
          </text>
          <text>
            <span style={{ fg: theme.textMuted }}>
              {shown().provider} · {directory()}
            </span>
          </text>
        </box>
      </box>

      {/* Vertical divider */}
      <box border={["left"]} borderColor={theme.border} marginLeft={2} marginRight={2} />

      {/* Right: getting-started tips */}
      <box flexGrow={1} flexBasis={0} justifyContent="center">
        <text fg={theme.primary} attributes={TextAttributes.BOLD}>
          Tips for getting started
        </text>
        <text>
          <span style={{ fg: theme.text }}>Tab</span>
          <span style={{ fg: theme.textMuted }}> cycle mode (manual / accept / plan / auto)</span>
        </text>
        <text>
          <span style={{ fg: theme.text }}>/model</span>
          <span style={{ fg: theme.textMuted }}> switch lane </span>
          <span style={{ fg: theme.text }}>/effort</span>
          <span style={{ fg: theme.textMuted }}> tier</span>
        </text>
        <text>
          <span style={{ fg: theme.text }}>@</span>
          <span style={{ fg: theme.textMuted }}> mention files </span>
          <span style={{ fg: theme.text }}>/init</span>
          <span style={{ fg: theme.textMuted }}> project memory</span>
        </text>
      </box>
    </box>
  )
}
