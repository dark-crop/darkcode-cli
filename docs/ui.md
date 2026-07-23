# UI and theme

darkcode ships a stripped-down, Claude Code-style terminal interface: a compact
mascot header that scrolls with the conversation, a clean divider-framed input,
a footer with the current model and key hints, and a single live "working"
indicator while the model generates. Reasoning streams live *above* the answer
as the model thinks (click to expand), and each finished turn closes with a
muted `* <sassy sign-off> (<total time>)` run-time line. Everything is painted from one
accent color - a vivid "power purple" - defined in a single place and working
in both dark and light terminals.

This doc explains what you see on screen and where each piece lives in the
source, so it stays accurate as the code evolves.

## The accent color (single source of truth)

The whole app is themed around one accent, defined once in
`packages/tui/src/theme/assets/darkcode.json`. Two `defs` entries are the source
of truth:

| Def | Value | Used in |
| --- | --- | --- |
| `brandDark` | `#a855f7` | dark terminals |
| `brandLight` | `#7c3aed` | light terminals |

Their hover variants `brandDarkHover` (`#c084fc`) and `brandLightHover`
(`#6d28d9`) round out the ramp. Everything else references these names rather
than repeating a hex value:

```jsonc
"darkStep9":  "brandDark",
"darkStep10": "brandDarkHover",
"darkAccent": "brandDark",
"lightStep9":  "brandLight",
"lightStep10": "brandLightHover",
"lightAccent": "brandLight"
```

The theme then maps `primary` and `accent` to steps 9/accent for each mode, so a
single edit to `brandDark` / `brandLight` recolors the whole UI. Components read
`theme.primary` for the brand color and never hardcode a hex:

- the mascot face in the header
- the `›` prompt indicator
- the rotating working verb
- the input rail highlight and default agent color
- markdown headings, links, list markers, and syntax accents

The default theme name is `darkcode`. To change the brand color, edit the two
`brandDark` / `brandLight` defs - nothing else.

## Layout overview

The conversation lives inside a single scrollbox. Reading top to bottom:

```
▛▀▀▀▜  darkcode v0.x.x
▌▪ ▪▐  Mr. President 1.1 · high  dark-llm
▌ ▬ ▐  ~/code/project
▙▄▄▄▟

  › how do I ...            (your messages and the model's answers)

  ▓ You wish I was faster  (12s · ↓ 1.2k tokens)   <- live working row

────────────────────────────────────────────────────────
  › <your next prompt>
────────────────────────────────────────────────────────
  Mr. President 1.1 · high  dark-llm    tab agents  ctrl+p commands
```

There is no sidebar. Context-window usage moved to the `/context` command.

## The mascot header

Source: `packages/tui/src/component/header.tsx`.

A compact top-left header: a small four-line pixel mascot rendered in
`theme.primary`, next to the brand name `darkcode`, the version, the current
model and provider, and the working directory.

```
▛▀▀▀▜  darkcode v0.x.x
▌▪ ▪▐  Mr. President 1.1 · high  dark-llm
▌ ▬ ▐
▙▄▄▄▟  ~/code/project
```

The header is rendered **inside the scrollbox**, as the first item above the
messages, so it scrolls up and away with the conversation instead of being
pinned to the top of the screen (see `routes/session/index.tsx`, where `<Header
/>` sits directly inside `<scrollbox>` above the message list).

## The input

Source: `packages/tui/src/component/prompt/index.tsx`.

The input is a clean rail, not a shaded box:

- a full-width divider line above and a full-width divider line below
  (`border={["top"]}` / `border={["bottom"]}` in `theme.border`)
- a `›` prompt indicator in `theme.primary` to the left of the textarea
- no background fill, no placeholder text (empty input shows just the `›`)

The `placeholderText` memo returns `undefined` by design, so an empty prompt
never shows example text like "Ask anything".

### Footer

Directly below the input's bottom divider is a full-width footer row:

- **Left (idle):** the current agent, model, and provider, for example
  `Mr. President 1.1 · high  dark-llm`.
- **Right:** key hints - `tab agents` and `ctrl+p commands` (the shortcuts are
  resolved from your keybinds, so they show whatever you have bound). In shell
  mode the right side switches to `esc exit shell mode`.
- **While busy:** the left side switches to the interrupt hint (`esc interrupt`,
  then `esc again to interrupt`), and retry/backoff messages surface here.

## The single live working indicator

Source: the `WorkingIndicator` component in
`packages/tui/src/routes/session/index.tsx`, plus the verb list in
`packages/tui/src/util/working-verb.tsx`.

There is exactly **one** live indicator, shown in the chat the instant the
session goes busy (like Claude Code). It is rendered as the last item inside the
scrollbox, after the messages:

```
▓ You wish I was faster  (12s · ↓ 1.2k tokens)
```

It is composed of three parts:

1. **A block spinner** - `style: "blocks"`, colored with the current agent color
   (falling back to `theme.primary`).
2. **A rotating sassy verb** in `theme.primary`, picked at random from
   `WORKING_VERBS` in `working-verb.tsx`. The verb is chosen when the row
   appears and re-rolls every 12 seconds. The list is deliberately grumpy, for
   example `"You wish I was faster"`, `"Ugh, fine..."`, `"The audacity..."`,
   `"Working... unfortunately"`.
3. **Elapsed time and streamed tokens** in `theme.textMuted`. The format is
   `(elapsed · ↓ tokens)` once output starts, or just `(elapsed)` before any
   tokens arrive. Elapsed rolls over to `Nm Ss` past a minute; token counts
   compact to `1.2k` past a thousand. Tokens come from the last assistant
   message's `tokens.output`.

The indicator only renders while `session_status[sessionID].type === "busy"`,
and resets its timer when the session goes idle. There is no separate footer
spinner, no per-message "generating" header, and no live "Thinking" line - this
row is the one place the app tells you it is working.

## Reasoning: "Thought: Xs" summaries

Source: `ReasoningPart` and `ReasoningHeader` in
`packages/tui/src/routes/session/index.tsx`.

Reasoning is intentionally quiet:

- **Answer first.** The assistant message renders its non-reasoning parts, then
  its reasoning parts below them (`orderedParts` puts reasoning last), so any
  "thinking" appears **under** the response, not above it.
- **No live thinking line.** While reasoning is still streaming, `ReasoningHeader`
  renders nothing - the single `WorkingIndicator` above is the only live signal.
- **A grey summary when done.** Once the reasoning block finalizes (the server
  sets `time.end`), the header collapses to a muted grey line:

  ```
  Thought: <short summary> · 4s
  ```

  It shows a one-line summary of the reasoning plus its duration, in
  `theme.textMuted`. In minimal ("hide") thinking mode the line is collapsible -
  a `+ ` / `- ` toggle expands or hides the full reasoning markdown; the summary
  line itself never shifts the layout.

## Exit epilogue

Source: `packages/tui/src/util/presentation.ts`.

When the TUI quits it prints a plain epilogue - the word `darkcode` as text (no
large wordmark) and a resume hint:

```
darkcode

  Continue  darkcode -s <session>
```

## Dark and light

Every color above is defined for both modes in `darkcode.json`. The accent
resolves to `brandDark` in dark terminals and `brandLight` in light ones, and
neutral steps (`text`, `textMuted`, `border`, backgrounds) each have a
`dark`/`light` pair. When adjusting the theme, check both modes - the brand
accent, the mascot, the `›` indicator, and the working verb all follow
`theme.primary`, so they flip automatically with the terminal's palette.

## Where things live

| Piece | File |
| --- | --- |
| Accent SSOT (`brandDark` / `brandLight`) and full theme | `packages/tui/src/theme/assets/darkcode.json` |
| Mascot header (scrolls with the conversation) | `packages/tui/src/component/header.tsx` |
| Input rail, `›` indicator, footer, hints | `packages/tui/src/component/prompt/index.tsx` |
| Working indicator (spinner + verb + elapsed·tokens) | `WorkingIndicator` in `packages/tui/src/routes/session/index.tsx` |
| Rotating sassy verbs | `packages/tui/src/util/working-verb.tsx` |
| Reasoning "Thought: Xs" summary | `ReasoningPart` / `ReasoningHeader` in `packages/tui/src/routes/session/index.tsx` |
| Exit epilogue | `packages/tui/src/util/presentation.ts` |
