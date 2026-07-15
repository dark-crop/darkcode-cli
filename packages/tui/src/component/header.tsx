import { createMemo, Show } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useLocal } from "../context/local"
import { useDirectory } from "../context/directory"
import { InstallationVersion } from "@opencode-ai/core/installation/version"

/**
 * Compact top-left header shared by the home and session screens so the launch
 * view and the working view are the same layout: brand + version, current
 * model, and working directory. Claude Code-style.
 */
export function Header() {
  const { theme } = useTheme()
  const local = useLocal()
  const directory = useDirectory()
  const model = createMemo(() => local.model.parsed())
  // Hide the placeholder version used when running from source (dev).
  const version = createMemo(() => {
    const v = InstallationVersion
    return v && v !== "local" && v !== "dev" && v !== "0.0.0" ? `v${v}` : undefined
  })

  return (
    <box flexDirection="column" flexShrink={0} paddingTop={1} paddingBottom={1}>
      <box flexDirection="row" gap={1}>
        <text fg={theme.primary} attributes={TextAttributes.BOLD}>
          darkcode
        </text>
        <Show when={version()}>
          <text fg={theme.textMuted}>{version()}</text>
        </Show>
      </box>
      <box flexDirection="row" gap={1}>
        <text fg={theme.text}>{model().model}</text>
        <text fg={theme.textMuted}>{model().provider}</text>
      </box>
      <text fg={theme.textMuted}>{directory()}</text>
    </box>
  )
}
