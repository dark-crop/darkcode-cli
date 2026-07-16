# Architecture

darkcode is an MIT-licensed fork of [opencode](https://github.com/sst/opencode),
rebranded around a vivid "power purple" accent and locked into being a dedicated
terminal client for the self-hosted [Dark-LLM](https://dark-llm.cropbinary.com)
gateway. This document explains how it is put together: what changed versus
upstream, how the provider lock works, how config is isolated, the `packages/`
layout, and how darkcode relates to the gateway.

## Fork model: what changed vs upstream

darkcode keeps the entire opencode engine intact - the Effect-based runtime, the
SolidJS/OpenTUI terminal UI, the session and provider machinery - and layers a
small set of opinionated changes on top. The goal is that upstream stays
mergeable while the product behaves like one focused tool.

The substantive changes are:

| Area | Upstream opencode | darkcode |
| --- | --- | --- |
| Providers | Many providers, user picks and configures | Hard-locked to a single built-in `dark-llm` provider |
| Config dir | `~/.config/opencode` | `~/.config/darkcode` (fully isolated) |
| Default model | User/model.dev driven | `dark-llm/thor-med` |
| Model discovery | models.dev catalog | Live `GET /v1/models` from the gateway, static fallback |
| Brand/theme | opencode accent | "power purple" accent, default theme `darkcode` |
| UI | opencode chrome | Claude Code-style: scrolling mascot header, clean input rail, one live working indicator |
| Commands | opencode command set | `/model`, `/effort`, `/login`, `/logout`, `/context` (no `/models`) |
| Install | npm package / binary | From source only, via the committed `./darkcode` launcher |

Most of these are additive layers rather than rewrites. The provider lock and
the isolated config dir are the two changes that make darkcode a distinct
product rather than a re-skin, and both are small, well-contained edits in the
source (see below). Reviewing them is the fastest way to understand the fork -
`git log --oneline` shows the full sequence of branding, UI, and command
commits on top of the opencode base.

## The dark-llm provider lock

darkcode ships a built-in provider, `dark-llm`, and forces it to be the only one
the app will ever load. This happens in two places.

### 1. The provider is seeded as a built-in config layer

`packages/opencode/src/config/builtin-provider.ts` defines the provider and its
model catalog. It exposes three lanes; the two chat lanes span four effort tiers
and the vision lane is flat:

| Lane | Family id | Character | Reasoning tiers |
| --- | --- | --- | --- |
| Loki | `loki` | 35B-A3B MoE, fast + fan-out worker | med, high, ultra |
| Thor | `thor` | 27B HauhauCS dense, the default | med, high, ultra |
| Ta | `qwen-vl` | Qwen2.5-VL-7B vision | - |

The two chat lanes (Loki and Thor) each have `low`, `med`, `high`, and `ultra`
tiers, so a model id is composed as `<family>-<tier>`, e.g. `thor-med`. The tiers
set the reasoning budget: `low` turns thinking off, while `med`/`high`/`ultra`
allot 2048/8192/32768 reasoning-budget tokens. Thor also exposes a
`thor-1m-<tier>` variant (~1M context via YaRN, loaded exclusively on the
gateway). The Ta vision lane (`qwen-vl`) is flat - a single id with no effort
tiers. A `z-image` text-to-image model is also defined.

The provider is emitted by `darkLlmBuiltinConfig()` and points at the gateway:

```ts
// builtin-provider.ts
export const DARK_LLM_PROVIDER_ID = "dark-llm"
export const DARK_LLM_BASE_URL = "https://dark-llm.cropbinary.com/v1"
export const DARK_LLM_DEFAULT_MODEL_ID = "thor-med"
export const DARK_LLM_ENV_KEY = "DARK_LLM_KEY"
```

It uses the `@ai-sdk/openai-compatible` npm adapter and reads its key from the
`DARK_LLM_KEY` env var (or the stored credential, see [Gateway](#the-dark-llm-gateway)).

In `packages/opencode/src/config/config.ts` this built-in is merged in as the
**lowest-priority** layer, before any user config:

```ts
// config.ts, loadInstanceState
let result: Info = mergeConfig({}, darkLlmBuiltinConfig())
```

Seeding it as a base means a fresh install can list and use the dark-llm models
with zero config, while user config layered on top can still tweak details.

### 2. `enabled_providers` is forced after all merging

The actual lock is applied at the very end of config loading, after every layer
(built-in, global `opencode.json`, project `.opencode/opencode.json`, models.dev,
and auth) has been merged. Nothing can add another provider because the last word
overwrites `enabled_providers` unconditionally:

```ts
// config.ts, after ALL config merge
result.enabled_providers = [DARK_LLM_PROVIDER_ID]
if (!result.model || !result.model.startsWith(`${DARK_LLM_PROVIDER_ID}/`)) {
  result.model = `${DARK_LLM_PROVIDER_ID}/${DARK_LLM_DEFAULT_MODEL_ID}`
}
```

Downstream, `packages/opencode/src/provider/provider.ts` honors that list. Its
`isProviderAllowed()` gate drops any provider that is not in `enabled_providers`:

```ts
// provider.ts
const enabled = cfg.enabled_providers ? new Set(cfg.enabled_providers) : null
function isProviderAllowed(providerID) {
  if (enabled && !enabled.has(providerID)) return false
  if (disabled.has(providerID)) return false
  return true
}
```

So even if a user's config, a plugin, or the models.dev catalog tries to
introduce `openai`, `anthropic`, or an upstream `opencode` provider, it is
filtered out before it can appear in the `/model` picker or be selected. darkcode
is, by construction, a single-provider client.

### Live model discovery

The static catalog is a fallback. When a key is present, `provider.ts` refreshes
the dark-llm model list live from the gateway so the picker shows exactly what
the signed-in key is entitled to:

```ts
// provider.ts
const url = base.endsWith("/v1") ? `${base}/models` : `${base}/v1/models`
const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } })
```

The returned ids are reconciled against the static set: known ids keep their rich
metadata, ids the gateway does not expose are dropped, and unknown ids are
synthesized via `darkLlmModelFor()` / `darkLlmDisplayName()` (e.g.
`thor-med` renders as "Thor - med"). Any failure - offline, no key,
timeout (4s) - falls back to the static catalog. The `/model` and `/effort`
commands read from this reconciled list.

## Config isolation

darkcode never reads or writes the user's opencode configuration. The isolation
is a one-line change to the app name in `packages/core/src/global.ts`:

```ts
// global.ts
const app = "darkcode"
const data   = path.join(xdgData!,   app)  // ~/.local/share/darkcode
const cache  = path.join(xdgCache!,  app)  // ~/.cache/darkcode
const config = path.join(xdgConfig!, app)  // ~/.config/darkcode
const state  = path.join(xdgState!,  app)  // ~/.local/state/darkcode
```

Because every XDG base path is derived from that `app` string, darkcode's
config, state, data, cache, and stored auth all live under `darkcode`-named
directories. It cannot accidentally inherit a provider, model default, or gateway
key from an existing `~/.config/opencode` setup. The `OPENCODE_CONFIG_DIR` flag
can still override the config directory for advanced use.

## Package layout

darkcode is a Bun workspace under `packages/`. It carries the full opencode
package set, but only a few packages matter for understanding the client. The
three central ones:

| Package | npm name | Role |
| --- | --- | --- |
| `packages/opencode` | `opencode` | The CLI and app entry point. Owns the entry file `src/index.ts`, the command set (`/model`, `/effort`, `/login`, `/logout`, `/context`), config loading and the provider lock (`src/config/`), and the provider runtime (`src/provider/`). |
| `packages/tui` | `@opencode-ai/tui` | The SolidJS/OpenTUI terminal interface: the mascot header, input rail, working indicator, reasoning summaries, themes, and the exit epilogue. Reads `theme.primary` for the accent. |
| `packages/core` | `@opencode-ai/core` | Shared runtime and config schema. Owns `src/global.ts` (the isolated XDG paths / app name) and the config type model consumed by the built-in provider. |

The darkcode-specific logic is deliberately small and lives in a few files:

- `packages/opencode/src/config/builtin-provider.ts` - the dark-llm provider and catalog
- `packages/opencode/src/config/config.ts` - the `enabled_providers` lock and default model
- `packages/opencode/src/provider/provider.ts` - the allow-list filter and live model refresh
- `packages/core/src/global.ts` - the `~/.config/darkcode` isolation
- `packages/tui/src/theme/assets/darkcode.json` - the brand color SSOT (`brandDark` `#a855f7`, `brandLight` `#7c3aed`)
- `packages/tui/src/util/working-verb.tsx` - the rotating sassy working verbs

### Entry point and launcher

There is no build step. The `./darkcode` launcher at the repo root execs Bun
against the entry file with the required OpenTUI preload:

```bash
exec bun --preload "$preload" packages/opencode/src/index.ts "$@"
```

The `@opentui/solid/preload` is mandatory - it transforms the SolidJS JSX. Without
it the TUI throws `Cannot find module 'react/jsx-dev-runtime'`. See
[install.md](install.md) for the full launcher and PATH setup, including the
pre-push turbo typecheck hook.

## The Dark-LLM gateway

darkcode talks to one endpoint: `https://dark-llm.cropbinary.com`, a self-hosted
[LiteLLM](https://github.com/BerriAI/litellm) gateway. All model traffic is
OpenAI-compatible chat completions against `.../v1`, authenticated with a
per-user key sent as `Authorization: Bearer <key>`.

- **Base URL:** `https://dark-llm.cropbinary.com/v1` (`DARK_LLM_BASE_URL`)
- **Key:** stored in darkcode's isolated auth (the `dark-llm` credential) or read
  from the `DARK_LLM_KEY` env var
- **Model list:** `GET /v1/models` with the signed-in key drives live discovery
- **Auth flow:** `/login` is browser-only. It opens the gateway's `/token` page,
  which mints and displays a darkcode key for you to paste back. `/logout`
  removes the stored `dark-llm` credential. See [auth.md](auth.md).

The gateway is the single source of truth for which lanes and tiers a key may
use. darkcode's static catalog exists only so the picker still works offline or
before sign-in; once a key is present, the gateway's `/v1/models` response wins.

## How a request flows

1. **Startup** - `./darkcode` execs the entry file with the OpenTUI preload;
   `packages/core/src/global.ts` resolves the isolated `~/.config/darkcode` dirs.
2. **Config load** - `config.ts` seeds `darkLlmBuiltinConfig()`, merges any user
   config, then forces `enabled_providers = ["dark-llm"]` and a dark-llm default
   model.
3. **Provider resolution** - `provider.ts` filters to the allowed provider and,
   if a key is present, refreshes the model list from `GET /v1/models`.
4. **Model selection** - `/model` picks a lane (Loki/Thor/Ta) and `/effort`
   picks a tier (low/med/high/ultra); they compose into `<family>-<tier>` (the
   flat Ta vision lane ignores the tier).
5. **Inference** - the request goes to `https://dark-llm.cropbinary.com/v1` as an
   OpenAI-compatible completion with the `dark-llm` key, and the TUI renders the
   response with the single live working indicator and post-hoc reasoning summary.
