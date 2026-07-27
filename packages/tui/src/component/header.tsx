import { createMemo } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useLocal } from "../context/local"
import { useDirectory } from "../context/directory"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
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
  const model = createMemo(() => local.model.parsed())
  const tier = createMemo(() => local.model.variant.current())
  const version = createMemo(() => {
    const v = InstallationVersion
    return v && v !== "local" && v !== "dev" && v !== "0.0.0" ? `v${v}` : undefined
  })

  return (
    <box
      flexShrink={0}
      flexDirection="row"
      border={true}
      borderStyle="rounded"
      borderColor={theme.primary}
      title={version() ? `darkcode ${version()}` : "darkcode"}
      titleColor={theme.primary}
      titleAlignment="left"
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
            <span style={{ fg: theme.text }}>{model().model}</span>
            {tier() ? <span style={{ fg: theme.textMuted }}> · {tier()}</span> : null}
          </text>
          <text>
            <span style={{ fg: theme.textMuted }}>
              {model().provider} · {directory()}
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
