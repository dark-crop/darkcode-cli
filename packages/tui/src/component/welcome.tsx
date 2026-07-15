import { createMemo } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useLocal } from "../context/local"
import { useDirectory } from "../context/directory"
import { Logo } from "./logo"
import { InstallationVersion } from "@opencode-ai/core/installation/version"

/**
 * Home-screen welcome card: the darkcode wordmark, a few getting-started tips, and
 * the current model + working directory — a bordered block, top-anchored.
 */
export function Welcome() {
  const { theme } = useTheme()
  const local = useLocal()
  const directory = useDirectory()
  const model = createMemo(() => local.model.parsed())
  const version = createMemo(() => {
    const v = InstallationVersion
    return v && v !== "local" && v !== "dev" && v !== "0.0.0" ? `v${v}` : undefined
  })

  return (
    <box
      border={true}
      borderStyle="rounded"
      borderColor={theme.border}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      gap={1}
      flexShrink={0}
    >
      <Logo />

      <box>
        <text fg={theme.primary} attributes={TextAttributes.BOLD}>
          Getting started
        </text>
        <text fg={theme.textMuted}>
          Type <span style={{ fg: theme.text }}>/</span> for commands ·{" "}
          <span style={{ fg: theme.text }}>@</span> to attach files
        </text>
        <text fg={theme.textMuted}>
          <span style={{ fg: theme.text }}>/model</span> switch lane ·{" "}
          <span style={{ fg: theme.text }}>/effort</span> reasoning tier ·{" "}
          <span style={{ fg: theme.text }}>/login</span> sign in
        </text>
      </box>

      <box>
        <box flexDirection="row" gap={1}>
          <text fg={theme.text}>{model().model}</text>
          <text fg={theme.textMuted}>{model().provider}</text>
          {version() ? <text fg={theme.textMuted}>· {version()}</text> : null}
        </box>
        <text fg={theme.textMuted}>{directory()}</text>
      </box>
    </box>
  )
}
