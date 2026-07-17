import { Prompt, type PromptRef } from "../component/prompt"
import { createEffect, createSignal, onMount, Show } from "solid-js"
import { Header } from "../component/header"
import { Welcome } from "../component/welcome"
import { DialogLogin } from "../component/dialog-login"
import { useDialog } from "../ui/dialog"
import { useExit } from "../context/exit"
import { DARK_LLM_PROVIDER_ID } from "../util/dark-llm"
import { useSync } from "../context/sync"
import { Toast } from "../ui/toast"
import { useArgs } from "../context/args"
import { useRouteData } from "../context/route"
import { usePromptRef } from "../context/prompt"
import { useLocal } from "../context/local"
import { usePluginRuntime } from "../plugin/runtime"
import { useEditorContext } from "../context/editor"
import { HomeSessionDestinationProvider } from "./home/session-destination"

let once = false
const placeholder = {
  normal: ["Fix a TODO in the codebase", "What is the tech stack of this project?", "Fix broken tests"],
  shell: ["ls -la", "git status", "pwd"],
}

export function Home() {
  const pluginRuntime = usePluginRuntime()
  const sync = useSync()
  const route = useRouteData("home")
  const promptRef = usePromptRef()
  const [ref, setRef] = createSignal<PromptRef | undefined>()
  const args = useArgs()
  const local = useLocal()
  const editor = useEditorContext()
  const dialog = useDialog()
  const exit = useExit()
  // Signed in = the gateway provider resolved an actual key. NOTE: `connected` is NOT usable here
  // because the built-in dark-llm provider is always "connected" so its models list offline. The
  // resolver only sets `key` on the provider when a credential exists (stored auth or DARK_LLM_KEY),
  // so that is the real signal. Reactive: /login -> sync.bootstrap() re-fetches and flips this.
  const loggedIn = () => {
    const dark = sync.data.provider_next.all.find((p) => p.id === DARK_LLM_PROVIDER_ID)
    return !!(dark as { key?: string } | undefined)?.key
  }
  const openLogin = () => dialog.replace(() => <DialogLogin />)
  let sent = false

  onMount(() => {
    editor.clearSelection()
  })

  const bind = (r: PromptRef | undefined) => {
    setRef(r)
    promptRef.set(r)
    if (once || !r) return
    if (route.prompt) {
      r.set(route.prompt)
      once = true
      return
    }
    if (!args.prompt) return
    r.set({ input: args.prompt, parts: [] })
    once = true
  }

  // Wait for sync and model store to be ready before auto-submitting --prompt
  createEffect(() => {
    const r = ref()
    if (sent) return
    if (!r) return
    if (!sync.ready || !local.model.ready) return
    if (!args.prompt) return
    if (r.current.input !== args.prompt) return
    sent = true
    r.submit()
  })

  return (
    <HomeSessionDestinationProvider>
      {/* Same skeleton as a session: header (top) · body (fills) · input · footer.
          On the launch screen the body is simply empty. */}
      <box flexGrow={1} flexDirection="column">
        {/* Signed out: a welcome takeover fills the body (the mascot header is hidden to avoid a
            double mascot). Signed in: the usual compact header + empty body. The prompt stays in
            both so `/login` can be typed. */}
        <Show
          when={loggedIn()}
          fallback={
            <pluginRuntime.Slot name="home_logo" mode="replace">
              <Welcome onLogin={openLogin} onExit={() => exit()} />
            </pluginRuntime.Slot>
          }
        >
          {/* Header content is padded; the input frame is full-width so its dividers span the screen. */}
          <box paddingLeft={2} paddingRight={2}>
            <pluginRuntime.Slot name="home_logo" mode="replace">
              <Header />
            </pluginRuntime.Slot>
          </box>
          <box flexGrow={1} minHeight={0} />
          {/* Prompt lives inside the signed-in branch: while the welcome shows, there is no input
              at all (it owns the keyboard), so nothing steals focus or shows a stray cursor. */}
          <box width="100%" zIndex={1000} flexShrink={0}>
            <pluginRuntime.Slot name="home_prompt" mode="replace" ref={bind}>
              <Prompt ref={bind} right={<pluginRuntime.Slot name="home_prompt_right" />} placeholders={placeholder} />
            </pluginRuntime.Slot>
          </box>
        </Show>
        <Toast />
      </box>
    </HomeSessionDestinationProvider>
  )
}
