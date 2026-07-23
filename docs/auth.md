# Authentication

darkcode is a dedicated client for the self-hosted **Dark LLM gateway**
(`https://dark-llm.cropbinary.com`, a LiteLLM deployment). It talks to exactly one
provider, the built-in `dark-llm` provider, and that provider needs one credential: a
gateway API key (a LiteLLM virtual key, `sk-...`).

This page covers how to sign in, where the key is stored, and the alternative of
supplying the key through an environment variable.

## Quick start

```
/login
```

That is the whole flow. Run `/login` inside darkcode, sign in on the page that opens in
your browser, and paste the key it shows you back into the prompt. Once the gateway
accepts the key you are signed in and can start chatting.

## `/login`

`/login` is a **browser-only** flow. It is registered as the `darkllm.login` command
(slash name `login`) and opens the `DialogLogin` dialog
(`packages/tui/src/component/dialog-login.tsx`).

What happens when you run it:

1. darkcode opens the gateway's **`/app/sign-in`** page in your default browser
   (`https://dark-llm.cropbinary.com/app/sign-in`).
2. That page is a self-contained login: a **username + password form**. On submit it
   POSTs to **`/app/token`**, which validates your credentials against the per-user
   store (PBKDF2) and returns **your Dark LLM key**, shown with a Copy button. Wrong
   credentials produce an inline error so you can retry in place.
3. Back in the TUI, a prompt is waiting: *"Sign in in the browser, then paste your
   token below."* Paste the `sk-...` key and press enter. The paste field is **masked**
   (shown as bullets) so the key never lands in your scrollback.
4. darkcode validates the key by calling `GET /v1/models` with it as a bearer token. If
   the gateway accepts it, the key is stored and you see *"Signed in to Dark LLM."* If
   the gateway rejects it, you see *"The gateway rejected that key."* and nothing is
   saved.

The `/app/sign-in` link is printed inside the dialog as well, so if the browser did not
open automatically you can click the link (or copy it) to reach the same page.

The page is served by the dedicated **`darkcode-auth`** service (`127.0.0.1:8190`),
exposed through the LiteLLM `/app/sign-in` passthrough (`auth: false`) - the `/app/*`
namespace is used because LiteLLM itself owns the top-level `/token` and `/login` routes.
The master key never leaves the box, and the CLI never handles your password: it is
entered in the browser and validated by darkcode-auth, which returns a scoped key.
(The same service also serves `/app/usage` and the admin `/app/monitor`.)

## `/logout`

```
/logout
```

`/logout` is the `darkllm.logout` command (slash name `logout`). It **removes the
stored `dark-llm` credential** and reloads the session so darkcode returns to a
signed-out state. You will see *"Signed out of Dark LLM."* on success.

To sign in again, run `/login`.

## Where the key is stored

Signing in writes the key to darkcode's **auth store**, handled by the auth service in
`packages/opencode/src/auth/index.ts`. The credential is saved as an `api`-type entry
under the provider id `dark-llm`:

```json
{
  "dark-llm": { "type": "api", "key": "sk-..." }
}
```

Storage details:

- The file is **`auth.json`** in darkcode's data directory. darkcode uses its own XDG
  directories (app name `darkcode`, set in `packages/core/src/global.ts`), so this is
  under `$XDG_DATA_HOME/darkcode/` (for example `~/.local/share/darkcode/auth.json`).
  darkcode never reads the user's opencode config or credentials.
- The file is written with **`0600` permissions** (owner read/write only).
- `/logout` deletes the `dark-llm` entry from this file.

Because the config and auth are isolated to the `darkcode` app namespace, having
opencode installed with its own keys does not affect darkcode, and vice versa.

## The `DARK_LLM_KEY` environment variable

Instead of (or in addition to) `/login`, you can supply the gateway key through the
**`DARK_LLM_KEY`** environment variable. The built-in provider declares this env var
(`DARK_LLM_ENV_KEY = "DARK_LLM_KEY"` in
`packages/opencode/src/config/builtin-provider.ts`), and the provider loader picks it up
generically alongside the stored auth key.

```sh
export DARK_LLM_KEY="sk-..."
darkcode
```

This is useful for CI, containers, or any non-interactive environment where the browser
flow is not available. A key resolved from `DARK_LLM_KEY` is used the same way as one
stored via `/login`.

## The built-in `dark-llm` provider

darkcode ships the `dark-llm` provider baked in as a zero-config default, so a fresh
install can list and use the gateway's models without writing any provider config. Key
points relevant to auth:

| Field | Value |
| --- | --- |
| Provider id | `dark-llm` |
| Display name | `Dark LLM` |
| Base URL | `https://dark-llm.cropbinary.com/v1` |
| Credential env var | `DARK_LLM_KEY` |
| Default model | `dark-llm/president-high` |

The provider is defined in `packages/opencode/src/config/builtin-provider.ts` and is
always autoloaded. darkcode is **hard-locked** to this single provider, so no other
providers appear in the picker regardless of what else is installed. The API key,
whether it came from the stored auth entry or `DARK_LLM_KEY`, is passed to the gateway
as the bearer token on every request.

The gateway also drives the live model list: `/model` and `/effort` populate their
choices from `GET /v1/models` using your signed-in key, falling back to the static
built-in list if the gateway is unreachable. If those pickers are empty or requests are
rejected, your key is most likely missing or invalid, so run `/login` again.
