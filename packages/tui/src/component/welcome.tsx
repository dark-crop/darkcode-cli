import { createSignal, For } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { Mascot } from "./mascot"

/**
 * Welcome / sign-in takeover shown on the home screen when no Dark LLM key is present.
 * It owns the keyboard (up/down + enter, or number keys) via a global handler that stands down
 * whenever a dialog is open (e.g. the sign-in flow). The home prompt is hidden while this shows.
 */
export function Welcome(props: { onLogin: () => void; onExit: () => void }) {
  const { theme } = useTheme()
  const dialog = useDialog()
  const raw = InstallationVersion
  const version = raw && raw !== "local" && raw !== "dev" && raw !== "0.0.0" ? `v${raw}` : undefined

  const options = [
    { label: "Sign in with your Dark LLM gateway", run: () => props.onLogin() },
    { label: "Exit", run: () => props.onExit() },
  ]
  const [selected, setSelected] = createSignal(0)
  const move = (delta: number) => setSelected((prev) => (prev + delta + options.length) % options.length)

  useKeyboard((evt) => {
    // Stand down while a dialog (the sign-in flow) is open so it gets the keys.
    if (dialog.stack.length > 0) return
    if (evt.name === "up" || evt.name === "k") {
      evt.preventDefault()
      evt.stopPropagation()
      return move(-1)
    }
    if (evt.name === "down" || evt.name === "j" || evt.name === "tab") {
      evt.preventDefault()
      evt.stopPropagation()
      return move(evt.name === "tab" && evt.shift ? -1 : 1)
    }
    if (evt.name === "return") {
      evt.preventDefault()
      evt.stopPropagation()
      return options[selected()].run()
    }
    const n = Number(evt.name)
    if (Number.isInteger(n) && n >= 1 && n <= options.length) {
      evt.preventDefault()
      evt.stopPropagation()
      setSelected(n - 1)
      return options[n - 1].run()
    }
  })

  return (
    <box flexGrow={1} minHeight={0} flexDirection="column" justifyContent="center" paddingLeft={2} gap={1}>
      <Mascot />

      <box>
        <box flexDirection="row" gap={1}>
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            Welcome to darkcode
          </text>
          {version ? <text fg={theme.textMuted}>{version}</text> : null}
        </box>
        <text fg={theme.textMuted}>Your terminal coding agent, wired to your own private Dark LLM gateway.</text>
      </box>

      <box>
        <text fg={theme.text}>Sign in to get started:</text>
        <For each={options}>
          {(option, i) => {
            const active = () => selected() === i()
            return (
              <text
                fg={active() ? theme.primary : theme.textMuted}
                attributes={active() ? TextAttributes.BOLD : undefined}
                onMouseUp={() => {
                  setSelected(i())
                  option.run()
                }}
              >
                {`${active() ? "›" : " "} ${i() + 1}. ${option.label}`}
              </text>
            )
          }}
        </For>
        <text fg={theme.textMuted}>{"    up/down to move, enter to select (or press 1-2)"}</text>
      </box>
    </box>
  )
}
