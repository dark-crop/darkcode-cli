# Models

darkcode is locked to a single provider: the built-in `dark-llm` provider that talks to
the self-hosted [Dark-LLM](https://dark-llm.cropbinary.com) gateway. No other providers
(opencode, openai, anthropic, etc.) ever appear - `enabled_providers` is forced to
`["dark-llm"]` after all config is merged, so a fresh install lists and uses only these
models.

The provider exposes **3 lanes** across **4 effort tiers**. A model id is always
`<family>-<tier>` (for example `chang-code-med`). The default model is
`dark-llm/chang-code-med`.

## The three lanes

Each lane is a different model on the gateway, picked for a different job.

| Lane | Family (`<family>`) | Backing model | Best for |
| --- | --- | --- | --- |
| **Singto** | `singto-fast` | 35B MoE | Fast lane - quick answers and cheap fan-out |
| **Chang** | `chang-code` | 27B dense | Coding + orchestrator - the default workhorse |
| **Talay** | `talay-agent` | 122B | Heavy agent - swaps in alone and unloads the other lanes |

Chang is the default lane. Singto trades depth for speed and low cost. Talay is the heavy
option: it is large enough that the gateway swaps it in on its own and unloads the other
lanes to make room.

## The four effort tiers

The tier (`<tier>`) sets the reasoning budget and the context/output window. Tiers apply
uniformly across every lane.

| Tier | Thinking | Context window | Max output | Notes |
| --- | --- | --- | --- | --- |
| `low` | off | 64k | 4,096 | Fastest, cleanest output |
| `med` | on | 128k | 8,192 | Small reasoning budget (default) |
| `high` | on | 200k | 16,384 | Large reasoning budget |
| `ultra` | on | 256k | 32,768 | Maximum reasoning budget |

For Chang and Talay, the `high` and `ultra` tiers are flagged as reasoning models, so their
"Thought: Xs" summaries show after a response. `low` runs with thinking off entirely.

## Composing a model id

A lane and a tier compose into one model id:

```
<family>-<tier>
```

So the twelve lane models are:

```
singto-fast-low    singto-fast-med    singto-fast-high    singto-fast-ultra
chang-code-low     chang-code-med     chang-code-high     chang-code-ultra
talay-agent-low    talay-agent-med    talay-agent-high    talay-agent-ultra
```

Fully qualified, the default is `dark-llm/chang-code-med`.

## Switching lane and tier

darkcode splits model selection into two commands so you can change one axis without
touching the other. Both are available as slash commands and in the command palette
(`Ctrl+P`).

### `/model` - pick the lane

Opens the lane picker (Singto / Chang / Talay). It switches only the family and **keeps
your current tier** (defaulting to `med` if none is set). There is no separate `/models`
command - `/model` is the single model command, and the hidden `model.list` action and the
`<leader>m` keybind both point at the same lane picker.

```
/model
```

### `/effort` - pick the tier

Opens the effort picker (low / med / high / ultra). It switches only the tier and **keeps
your current lane** (defaulting to `chang-code` if none is set).

```
/effort
```

Because the two are orthogonal, a typical flow is: `/model` to choose Talay, then `/effort`
to bump it to `ultra`, giving you `talay-agent-ultra`. The header and footer always show the
active `<lane> · <tier>` selection (for example `Chang · med · Dark LLM`).

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
image output); the embedding model `bge-m3-embed` is filtered out of the picker:

```
singto-fast-{low,med,high,ultra}
chang-code-{low,med,high,ultra}
talay-agent-{low,med,high,ultra}
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
