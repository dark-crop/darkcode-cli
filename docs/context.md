# /context

`/context` shows how much of the current model's context window the active session
is using, broken down by category, with a token breakdown and running cost.

It is a read-only dialog. Nothing is sent to the gateway and nothing is changed;
press `esc` to close.

## Opening it

Type the slash command in the input:

```
/context
```

Or open the command palette (`ctrl+p`) and pick **Show context usage** (listed
under the **Session** category). Internally this is the `context.show` command.

`/context` replaced the old session sidebar, which was removed. There is no
persistent panel now, you call `/context` when you want the numbers.

## What it shows

The dialog is titled **Context Usage** and has four parts.

### 1. Model line

The current model and provider, plus the context window size when known:

```
president-high   dark-llm   · 262K context
```

- The model id and provider name come from the currently selected model
  (see `/model` and `/effort`).
- `· <n> context` is the model's context limit (`model.limit.context`) formatted
  compactly (`k` for thousands, `m` for millions). It is hidden when the gateway
  does not report a limit.

### 2. Segmented usage bar

A 40-cell bar where each cell is colored by the category it belongs to, sized in
proportion to that category's share of the full context window. Whatever is left
over is drawn in the muted "free" color. The percent used is printed to the right:

```
████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  18%
```

Each category maps to a theme color:

| Category    | Color source        |
| ----------- | ------------------- |
| Input       | `theme.primary` (brand purple) |
| Output      | `theme.accent`      |
| Reasoning   | `theme.warning`     |
| Cache read  | `theme.secondary`   |
| Cache write | `theme.info`        |
| Free        | `theme.backgroundElement` (muted) |

The bar only fills when the model reports a context limit and the session has
used at least one token; otherwise it is entirely free space.

### 3. Token breakdown

One row per category with its color swatch, label, and token count, followed by a
`Free` row that also shows the free percentage:

```
█ Input         12.4k tokens
█ Output         1.2k tokens
█ Reasoning        840 tokens
█ Cache read    18.0k tokens
█ Cache write    2.1k tokens
░ Free         165.4k tokens (82%)
```

Token counts are formatted compactly (`k` / `m`, trailing `.0` dropped).

### 4. Used / limit / cost

The footer sums it up:

```
Used   34.6k / 200k · $0.0127
```

- **Used** is `input + output + reasoning + cache read + cache write`.
- The limit is the model's context window.
- The cost is the session's accumulated cost, formatted as USD.

## Where the numbers come from

The figures are read from the current session's last completed assistant turn,
not a live counter:

- The breakdown (`input`, `output`, `reasoning`, `cache.read`, `cache.write`)
  comes from the **most recent assistant message that produced output** in the
  active session. If the session has no such message yet, all categories read
  zero and the bar is empty.
- `percent = round(used / limit * 100)`. When the model reports no context limit,
  the percent and the bar read zero.
- The cost is the whole session's cost (`session.cost`), so it accumulates across
  every turn, while the token breakdown reflects only the latest turn's context
  footprint.

Because it reflects the last turn, `/context` is most useful right after a
response completes, when you want to see how close you are to the window before
sending more.

## Notes

- The context limit is per-model. Switching lanes or effort tiers with `/model`
  and `/effort` can change the window and therefore the percentages.
- All colors are theme tokens, so the dialog reads correctly in both the dark and
  light `darkcode` themes.

## Source

`packages/tui/src/component/dialog-context.tsx` (component), registered as the
`context.show` command in `packages/tui/src/app.tsx`.
