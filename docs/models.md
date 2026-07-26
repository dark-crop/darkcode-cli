# Models

darkcode is locked to a single provider: the built-in `dark-llm` provider that talks to
the self-hosted [Dark-LLM](https://dark-llm.cropbinary.com) gateway. No other providers
(opencode, openai, anthropic, etc.) ever appear - `enabled_providers` is forced to
`["dark-llm"]` after all config is merged, so a fresh install lists and uses only these
models.

The provider exposes **2 chat lanes**, each across **4 effort tiers**. A chat model id is always
`<family>-<tier>` (for example `mr-president-2-0-high`). The default model is
`dark-llm/mr-president-2-0-high`. Display names AND descriptions are loaded **live from the gateway**
(`GET /v1/models` + `/model/info`) and are never hardcoded in the client, so renaming or re-pricing a
model on the gateway flows through automatically.

## The lanes

Two native-vLLM lanes, both your own uncensored, tool-capable models served on your GPU box.

| Lane | Family (`<family>`) | Backing model | Context | Best for |
| --- | --- | --- | --- | --- |
| **Mr.President Lv.284** | `mr-president-2-0` | DeepSeek-V4-Flash | **1M** (1,048,576) | Complex tasks, deep reasoning - the workhorse (default). **Sees images** (below). |
| **Mr.Agent Lv.35** | `mr-agent-1-0` | SuperQwen-AgentWorld-35B-A3B | **256K** (262,144) | Routine, agentic, tool-heavy work - fast and efficient. |

### Vision (Mr.President sees images)

Mr.President is a text model, but you can attach a screenshot and ask about it and it just works.
The gateway does the seeing: it quietly forwards the attached image to a dedicated vision model
(Qwen3-VL) behind the scenes, gets back a description, and feeds that to Mr.President to reason over.
So there is no separate "vision lane" to switch to - drop the image on Mr.President and it reads it.
(The old "vision tower / mmproj projector" mechanism is gone; vision is now gateway-side delegation.)

## The four effort tiers

The tier (`<tier>`) sets the reasoning budget. It does not change the context window (each lane keeps
its full window at every tier - 1M for President, 256K for Agent).

| Tier | Thinking | Reasoning budget | Notes |
| --- | --- | --- | --- |
| `low` | off | none | Fastest, cleanest output |
| `med` | on | small | Small reasoning budget |
| `high` | on | large | Large reasoning budget (default) |
| `ultra` | on | max | Maximum reasoning budget |

The `high` and `ultra` tiers are flagged as reasoning models, so their thinking streams live above the
answer (see [ui.md](ui.md)). `low` runs with thinking off entirely.

## Composing a model id

A lane and a tier compose into one model id:

```
<family>-<tier>
```

So the chat lane models are:

```
mr-president-2-0-low    mr-president-2-0-med    mr-president-2-0-high    mr-president-2-0-ultra
mr-agent-1-0-low        mr-agent-1-0-med        mr-agent-1-0-high        mr-agent-1-0-ultra
```

Fully qualified, the default is `dark-llm/mr-president-2-0-high`.

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
your current lane** (defaulting to `mr-president-2-0` if none is set).

```
/effort
```

The header and footer always show the active `<lane> · <tier>` selection
(for example `Mr.President Lv.284 · high · Dark LLM`).

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
text-to-image and `qwen-image-edit` for image editing). The embedding model `bge-m3-embed` and any
model the gateway flags `hidden` (for example the Qwen3-VL vision model that powers Mr.President's
image-seeing) are filtered out of the picker:

```
mr-president-2-0-{low,med,high,ultra}
mr-agent-1-0-{low,med,high,ultra}
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
