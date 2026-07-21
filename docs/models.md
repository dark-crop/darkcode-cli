# Models

darkcode is locked to a single provider: the built-in `dark-llm` provider that talks to
the self-hosted [Dark-LLM](https://dark-llm.cropbinary.com) gateway. No other providers
(opencode, openai, anthropic, etc.) ever appear - `enabled_providers` is forced to
`["dark-llm"]` after all config is merged, so a fresh install lists and uses only these
models.

The provider exposes **1 chat lane** across **4 effort tiers**. A chat model id is always
`<family>-<tier>` (for example `president-high`). The default model is `dark-llm/president-high`.
The lane's display name is loaded **live from the gateway** (`GET /v1/models` + `/model/info`) and
is never hardcoded in the client, so renaming the model on the gateway flows through automatically.

## The lane

One native-vLLM lane, vision-capable (reads images directly via its own vision tower).

| Lane | Family (`<family>`) | Backing model | Best for |
| --- | --- | --- | --- |
| **Mr. President 1.1** | `president` | your own uncensored model, served natively on the gateway | Coding, tools, complex tasks - the workhorse |

Every tier gets the full native **262K** context window.

## The four effort tiers

The tier (`<tier>`) sets the reasoning budget. Every tier gets the full native **262K** context.

| Tier | Thinking | Context window | Reasoning budget | Notes |
| --- | --- | --- | --- | --- |
| `low` | off | 262K | none | Fastest, cleanest output |
| `med` | on | 262K | small | Small reasoning budget |
| `high` | on | 262K | large | Large reasoning budget (default) |
| `ultra` | on | 262K | max | Maximum reasoning budget |

For the chat lanes, the `high` and `ultra` tiers are flagged as reasoning models, so their
"Thought: Xs" summaries show after a response. `low` runs with thinking off entirely.

## Composing a model id

A lane and a tier compose into one model id:

```
<family>-<tier>
```

So the chat lane models are:

```
president-low    president-med    president-high    president-ultra
```

Fully qualified, the default is `dark-llm/president-high`.

## Switching lane and tier

darkcode splits model selection into two commands so you can change one axis without
touching the other. Both are available as slash commands and in the command palette
(`Ctrl+P`).

### `/model` - pick the lane

Opens the model lane picker. It switches only the family and **keeps
your current tier** (defaulting to `med` if none is set). There is no separate `/models`
command - `/model` is the single model command, and the hidden `model.list` action and the
`<leader>m` keybind both point at the same lane picker.

```
/model
```

### `/effort` - pick the tier

Opens the effort picker (low / med / high / ultra). It switches only the tier and **keeps
your current lane** (defaulting to `president` if none is set).

```
/effort
```

The header and footer always show the active `<lane> · <tier>` selection
(for example `Mr. President 1.1 · high · Dark LLM`).

## The live model list

The lane and tier definitions above are the static built-in set, seeded as the lowest
config layer so a fresh install works with zero configuration. On top of that, darkcode
refreshes the list **live from the gateway** so `/model` shows exactly what your signed-in
key is allowed to use.

When a credential (or the `DARK_LLM_KEY` environment variable) is present, darkcode calls:

```
GET https://dark-llm.cropbinary.com/v1/models
Authorization: Bearer <your-key>
```

It then reconciles the response against the static set:

- **Keeps** rich metadata for ids it already knows.
- **Drops** any static id the gateway does not return.
- **Adds** ids the gateway returns that darkcode does not statically define, deriving a
  reasonable entry (display name, family, reasoning flag from the `-high`/`-ultra` suffix).
- **Filters out** embedding models (any id containing `embed`).

The fetch has a 4-second timeout. On any failure - offline, no key, timeout, or a non-OK
response - darkcode **falls back to the static built-in list**, so the picker is never
empty.

The gateway currently serves these lane models (plus non-text models like `z-image` for
text-to-image and `qwen-image-edit` for image editing); the embedding model `bge-m3-embed`
is filtered out of the picker:

```
president-{low,med,high,ultra}
```

To see the live list, sign in first (see [auth.md](auth.md)), then open `/model`.

## Where this lives in the source

| Concern | File |
| --- | --- |
| Static lane/tier model set, default id, base URL | `packages/opencode/src/config/builtin-provider.ts` |
| Lane/tier helpers (`LANES`, `TIERS`, compose/parse) | `packages/tui/src/util/dark-llm.ts` |
| `/model` lane picker | `packages/tui/src/component/dialog-lane.tsx` |
| `/effort` tier picker | `packages/tui/src/component/dialog-effort.tsx` |
| Live gateway `/v1/models` fetch and reconcile | `packages/opencode/src/provider/provider.ts` |
| Provider lock (`enabled_providers`, default model) | `packages/opencode/src/config/config.ts` |
