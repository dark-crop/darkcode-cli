import { createMemo } from "solid-js"
import { DialogSelect } from "../ui/dialog-select"
import { DialogPrompt } from "../ui/dialog-prompt"
import { useDialog } from "../ui/dialog"
import { useSDK } from "../context/sdk"
import { useSync } from "../context/sync"
import { useToast } from "../ui/toast"
import { useTheme } from "../context/theme"
import { TextAttributes } from "@opentui/core"
import open from "open"

// darkcode only talks to the Dark LLM gateway; a LiteLLM key is the sole credential.
const GATEWAY = "https://dark-llm.cropbinary.com"
const MODELS_URL = `${GATEWAY}/v1/models`
const PROVIDER_ID = "dark-llm"

/** /login — sign in to the Dark LLM gateway via token, username/password, or browser. */
export function DialogLogin() {
  const dialog = useDialog()
  const sdk = useSDK()
  const sync = useSync()
  const toast = useToast()
  const { theme } = useTheme()

  async function validate(key: string): Promise<boolean> {
    try {
      const res = await fetch(MODELS_URL, { headers: { Authorization: `Bearer ${key}` } })
      return res.ok
    } catch {
      return false
    }
  }

  async function storeKey(key: string) {
    if (!(await validate(key))) {
      toast.show({ variant: "warning", message: "The gateway rejected that key." })
      return false
    }
    await sdk.client.auth.set({ providerID: PROVIDER_ID, auth: { type: "api", key } })
    await sdk.client.instance.dispose()
    await sync.bootstrap()
    toast.show({ variant: "info", message: "Signed in to Dark LLM." })
    dialog.clear()
    return true
  }

  async function tokenFlow() {
    const key = await DialogPrompt.show(dialog, "Paste your Dark LLM key", { placeholder: "sk-..." })
    if (!key || !key.trim()) return
    await storeKey(key.trim())
  }

  async function browserFlow() {
    const url = `${GATEWAY}/ui`
    // Try to open it, but always SHOW the URL so it can be copied (auto-open may fail
    // or land in the wrong browser profile).
    await open(url).catch(() => undefined)
    const key = await DialogPrompt.show(dialog, "Sign in, create a Virtual Key, then paste it below", {
      placeholder: "sk-...",
      description: () => (
        <box gap={1}>
          <text fg={theme.textMuted}>Open this page (click to open, or copy it):</text>
          <text fg={theme.primary} attributes={TextAttributes.BOLD} onMouseUp={() => void open(url).catch(() => {})}>
            {url}
          </text>
        </box>
      ),
    })
    if (!key || !key.trim()) return
    await storeKey(key.trim())
  }

  async function passwordFlow() {
    const username = await DialogPrompt.show(dialog, "Username (or email)", { placeholder: "username" })
    if (!username || !username.trim()) return
    const password = await DialogPrompt.show(dialog, "Password", { placeholder: "password" })
    if (!password) return
    let ok = false
    try {
      const res = await fetch(`${GATEWAY}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: username.trim(), password }),
        redirect: "manual",
      })
      ok = res.status === 303 || res.status === 302 || res.status === 200
    } catch {
      ok = false
    }
    if (!ok) {
      toast.show({ variant: "warning", message: "Login failed - check your username and password." })
      return
    }
    // This gateway can't hand a CLI key straight back, so finish in the browser.
    toast.show({ variant: "info", message: "Signed in - create a key in the browser and paste it back." })
    await browserFlow()
  }

  const options = createMemo(() => [
    {
      value: "token",
      title: "Paste a token",
      description: "you already have an sk- key",
      onSelect: () => void tokenFlow(),
    },
    {
      value: "password",
      title: "Username & password",
      description: "log in with your gateway account",
      onSelect: () => void passwordFlow(),
    },
    {
      value: "browser",
      title: "Open in browser",
      description: "log in on the web, paste the key back",
      onSelect: () => void browserFlow(),
    },
  ])

  return <DialogSelect<string> options={options()} title="Sign in to Dark LLM" flat={true} />
}
