import { onMount } from "solid-js"
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

  async function browserFlow() {
    // The gateway's /token page: sign in there and it mints + shows your token to copy back.
    const url = `${GATEWAY}/token`
    await open(url).catch(() => undefined)
    const key = await DialogPrompt.show(dialog, "Sign in in the browser, then paste your token below", {
      placeholder: "sk-...",
      description: () => (
        <box gap={1}>
          <text fg={theme.textMuted}>Open this page, sign in, and it shows your token (click to open, or copy):</text>
          <text fg={theme.primary} attributes={TextAttributes.BOLD} onMouseUp={() => void open(url).catch(() => {})}>
            {url}
          </text>
        </box>
      ),
    })
    if (!key || !key.trim()) return
    await storeKey(key.trim())
  }

  // Single sign-in path: open the gateway /token page in the browser.
  onMount(() => void browserFlow())
  return <box />
}
