import { createMemo } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useLocal } from "../context/local"
import { useDirectory } from "../context/directory"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { Mascot } from "./mascot"

/**
 * Compact top-left header shared by the home and session screens: the small purple-blob mascot
 * plus brand + version, current model, and working directory.
 */
export function Header() {
  const { theme } = useTheme()
  const local = useLocal()
  const directory = useDirectory()
  const model = createMemo(() => local.model.parsed())
  const version = createMemo(() => {
    const v = InstallationVersion
    return v && v !== "local" && v !== "dev" && v !== "0.0.0" ? `v${v}` : undefined
  })

  return (
    <box flexDirection="row" gap={2} flexShrink={0} paddingTop={1} paddingBottom={1}>
      <Mascot mini />

      <box>
        <box flexDirection="row" gap={1}>
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            darkcode
          </text>
          {version() ? <text fg={theme.textMuted}>{version()}</text> : null}
        </box>
        <box flexDirection="row" gap={1}>
          <text fg={theme.text}>{model().model}</text>
          <text fg={theme.textMuted}>{model().provider}</text>
        </box>
        <text fg={theme.textMuted}>{directory()}</text>
      </box>
    </box>
  )
}
