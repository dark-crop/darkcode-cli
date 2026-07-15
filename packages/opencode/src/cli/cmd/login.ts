import type { Argv } from "yargs"
import open from "open"
import { Auth } from "../../auth"
import { effectCmd, fail } from "../effect-cmd"
import { UI } from "../ui"
import * as Prompt from "../effect/prompt"
import { Effect, Option } from "effect"
import { DARK_LLM_PROVIDER_ID, DARK_LLM_BASE_URL } from "../../config/builtin-provider"

const promptValue = <Value>(value: Option.Option<Value>) => {
  if (Option.isNone(value)) return Effect.die(new UI.CancelledError())
  return Effect.succeed(value.value)
}

/** Root of the gateway (base URL minus the trailing /v1). */
function gatewayRoot(base: string) {
  return base.replace(/\/+$/, "").replace(/\/v1$/, "")
}

/** A key is valid iff the gateway accepts it for a cheap authenticated call. */
function validateKey(root: string, key: string) {
  return Effect.tryPromise({
    try: () =>
      fetch(`${root}/v1/models`, { headers: { Authorization: `Bearer ${key}` } }).then((r) => r.ok),
    catch: () => false as const,
  }).pipe(Effect.orElseSucceed(() => false))
}

function storeKey(key: string) {
  return Effect.fn("Cli.login.store")(function* () {
    const authSvc = yield* Auth.Service
    yield* Effect.orDie(authSvc.set(DARK_LLM_PROVIDER_ID, { type: "api", key }))
  })()
}

/** Method 1: paste an existing sk- key. Always works. */
const tokenFlow = Effect.fn("Cli.login.token")(function* (root: string) {
  const key = yield* promptValue(
    yield* Prompt.password({
      message: "Paste your Dark LLM key (sk-...)",
      validate: (x) => (x && x.trim().length > 0 ? undefined : "Required"),
    }),
  )
  const trimmed = key.trim()
  yield* Prompt.log.info("Validating key...")
  if (!(yield* validateKey(root, trimmed))) return yield* fail("The gateway rejected that key.")
  yield* storeKey(trimmed)
  yield* Prompt.log.success("Key accepted and saved.")
})

/**
 * Method 2: username / password. POST /login authenticates against LiteLLM
 * (admin UI_USERNAME/PASSWORD or an internal user's email+password) and returns
 * a UI session as a `token` cookie. On the current LiteLLM build that session
 * JWT is NOT accepted by /key/generate, so we can't headlessly mint an sk- key
 * for the user; we authenticate, then hand off to the browser to create/copy a
 * key. (When darkcode's own gateway replaces LiteLLM, this becomes a full mint.)
 */
const passwordFlow = Effect.fn("Cli.login.password")(function* (root: string) {
  const username = yield* promptValue(
    yield* Prompt.text({ message: "Username (or email)", validate: (x) => (x ? undefined : "Required") }),
  )
  const password = yield* promptValue(
    yield* Prompt.password({ message: "Password", validate: (x) => (x ? undefined : "Required") }),
  )
  yield* Prompt.log.info("Authenticating...")
  const res = yield* Effect.tryPromise({
    try: () =>
      fetch(`${root}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username, password }),
        redirect: "manual",
      }),
    catch: (e) => e,
  }).pipe(Effect.orElseSucceed(() => undefined))
  if (!res || (res.status !== 303 && res.status !== 302 && res.status !== 200)) {
    return yield* fail("Login failed - check your username and password.")
  }
  yield* Prompt.log.success("Signed in.")
  yield* Prompt.log.info(
    "This gateway can't hand a CLI key straight to the terminal, so opening the\n" +
      "key page in your browser - create a key there, then paste it back here.",
  )
  yield* browserPasteFlow(root)
})

/** Method 3: open link. Open the gateway UI, capture the pasted key on loopback. */
const browserPasteFlow = Effect.fn("Cli.login.browser")(function* (root: string) {
  const uiUrl = `${root}/ui`
  yield* Effect.promise(() => open(uiUrl).catch(() => undefined))
  yield* Prompt.log.info(`Opened ${uiUrl} - log in and create a Virtual Key.`)
  const key = yield* promptValue(
    yield* Prompt.password({
      message: "Paste the key you created (sk-...)",
      validate: (x) => (x && x.trim().length > 0 ? undefined : "Required"),
    }),
  )
  const trimmed = key.trim()
  yield* Prompt.log.info("Validating key...")
  if (!(yield* validateKey(root, trimmed))) return yield* fail("The gateway rejected that key.")
  yield* storeKey(trimmed)
  yield* Prompt.log.success("Key accepted and saved.")
})

export const LoginCommand = effectCmd({
  command: "login",
  describe: "sign in to the Dark LLM gateway",
  builder: (yargs: Argv) =>
    yargs
      .option("method", {
        type: "string",
        choices: ["token", "password", "browser"],
        describe: "sign-in method (skips the picker)",
      })
      .option("url", { type: "string", describe: "gateway base url (defaults to the built-in dark-llm)" }),
  handler: Effect.fn("Cli.login")(function* (args) {
    const root = gatewayRoot((args.url as string | undefined) ?? DARK_LLM_BASE_URL)

    UI.empty()
    yield* Prompt.intro("Sign in to Dark LLM")

    let method = args.method as string | undefined
    if (!method) {
      method = yield* promptValue(
        yield* Prompt.select({
          message: "How do you want to sign in?",
          options: [
            { value: "token", label: "Paste a token", hint: "you already have an sk- key" },
            { value: "password", label: "Username & password", hint: "LiteLLM login" },
            { value: "browser", label: "Open in browser", hint: "log in on the web, paste the key" },
          ],
        }),
      )
    }

    if (method === "token") yield* tokenFlow(root)
    else if (method === "password") yield* passwordFlow(root)
    else yield* browserPasteFlow(root)

    yield* Prompt.outro("Done")
  }),
})
