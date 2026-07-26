import { createStore } from "solid-js/store"
import { useArgs } from "./args"
import { createSimpleContext } from "./helper"

// The interaction mode, cycled with Tab / Shift+Tab (like Claude Code's shift+tab). Order matters:
// manual -> accept edits -> plan -> auto.
export type PermissionMode = "manual" | "acceptEdits" | "plan" | "auto"

export const PERMISSION_MODES: PermissionMode[] = ["manual", "acceptEdits", "plan", "auto"]

// Per-mode presentation for the indicator line under the prompt (mirrors Claude Code): a pause glyph
// for the "careful" modes (manual/plan) and a fast-forward glyph for the "go" modes (accept/auto),
// each in its own colour. `color` names a theme key the renderer resolves.
export const PERMISSION_MODE_META: Record<
  PermissionMode,
  { label: string; icon: string; color: "textMuted" | "primary" | "success" | "warning" }
> = {
  manual: { label: "manual mode on", icon: "II", color: "textMuted" },
  acceptEdits: { label: "accept edits on", icon: "▶▶", color: "primary" },
  plan: { label: "plan mode on", icon: "II", color: "success" },
  auto: { label: "auto mode on", icon: "▶▶", color: "warning" },
}

// The tool actions "accept edits" auto-approves (file edits only; everything else still asks).
const EDIT_ACTIONS = new Set(["edit", "write", "patch", "multiedit"])

export const { use: usePermission, provider: PermissionProvider } = createSimpleContext({
  name: "Permission",
  init: () => {
    const args = useArgs()
    const [store, setStore] = createStore<{ mode: PermissionMode }>({
      mode: args.auto ? "auto" : "manual",
    })
    return {
      get mode() {
        return store.mode
      },
      set(mode: PermissionMode) {
        setStore("mode", mode)
      },
      // Advance the mode; +1 = forward (Tab), -1 = back (Shift+Tab). Returns the new mode.
      cycle(direction: number = 1): PermissionMode {
        const i = PERMISSION_MODES.indexOf(store.mode)
        const next = PERMISSION_MODES[(i + direction + PERMISSION_MODES.length) % PERMISSION_MODES.length]
        setStore("mode", next)
        return next
      },
      // Kept for the "permission.mode" palette command: quick jump between manual and auto.
      toggle() {
        setStore("mode", (mode) => (mode === "auto" ? "manual" : "auto"))
      },
      // The reply to auto-send for a permission request, or undefined to fall through to the ask
      // dialog. auto = approve everything; accept edits = approve file edits only; the rest ask.
      autoReply(action: string): "once" | undefined {
        if (store.mode === "auto") return "once"
        if (store.mode === "acceptEdits" && EDIT_ACTIONS.has(action)) return "once"
        return undefined
      },
    }
  },
})
