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

  // Log in with username/password and return a usable sk- key. LiteLLM's /login sets a
  // signed `token` cookie whose JWT payload embeds a real key; we extract it and (best
  // effort) mint a durable, named key from it. Returns null on failure.
  async function loginForKey(username: string, password: string): Promise<string | null> {
    try {
      const res = await fetch(`${GATEWAY}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username, password }),
        redirect: "manual",
      })
      if (![200, 302, 303].includes(res.status)) return null
      const cookies: string[] =
        typeof res.headers.getSetCookie === "function"
          ? res.headers.getSetCookie()
          : [res.headers.get("set-cookie") ?? ""].filter(Boolean)
      const jwt = cookies
        .find((c) => c.startsWith("token="))
        ?.split(";")[0]
        ?.slice("token=".length)
      if (!jwt) return null
      const payloadB64 = jwt.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/")
      if (!payloadB64) return null
      const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf-8")) as { key?: string }
      const sessionKey = payload.key
      if (!sessionKey) return null
      // Prefer a durable, named key minted from the session key; fall back to it directly.
      try {
        const gen = await fetch(`${GATEWAY}/key/generate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${sessionKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ key_alias: `darkcode-${username}-${Date.now()}` }),
        })
        if (gen.ok) {
          const data = (await gen.json()) as { key?: string }
          if (data.key) return data.key
        }
      } catch {}
      return sessionKey
    } catch {
      return null
    }
  }

  async function tokenFlow() {
    const key = await DialogPrompt.show(dialog, "Paste your Dark LLM key", { placeholder: "sk-..." })
    if (!key || !key.trim()) return
    await storeKey(key.trim())
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

  async function passwordFlow() {
    const username = await DialogPrompt.show(dialog, "Username (or email)", { placeholder: "username" })
    if (!username || !username.trim()) return
    const password = await DialogPrompt.show(dialog, "Password", { placeholder: "password" })
    if (!password) return

    const key = await loginForKey(username.trim(), password)
    if (!key) {
      toast.show({ variant: "warning", message: "Login failed - check your username and password." })
      return
    }
    await storeKey(key)
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
