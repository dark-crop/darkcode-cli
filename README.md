<h1 align="center">darkcode</h1>

<p align="center">
  <b>A terminal coding agent wired to your own private, uncensored LLM - not someone else's cloud.</b>
</p>

<p align="center">
  Claude Code-style TUI &nbsp;·&nbsp; one hard-locked gateway &nbsp;·&nbsp; local image generate / edit / re-pose baked in
</p>

<p align="center">
  <a href="#install"><img alt="platform" src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-informational?style=flat-square" /></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" /></a>
  <a href="#relationship-to-opencode"><img alt="fork" src="https://img.shields.io/badge/fork%20of-opencode-8b5cf6?style=flat-square" /></a>
  <a href="#install"><img alt="runtime" src="https://img.shields.io/badge/runtime-Bun-000?style=flat-square" /></a>
  <a href="#status"><img alt="status" src="https://img.shields.io/badge/status-early%20preview-a855f7?style=flat-square" /></a>
</p>

<p align="center">
  <a href="#the-unlock">The unlock</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#models">Models</a> ·
  <a href="#images">Images</a> ·
  <a href="#commands">Commands</a> ·
  <a href="#the-lock">The lock</a> ·
  <a href="#docs">Docs</a>
</p>

---

<p align="center">
  <img src="docs/assets/darkcode-tui.png" alt="darkcode TUI: planning a build with Mr. President 1.1, purple mascot header, live working row" width="840" />
</p>

### ⚡ Install (macOS / Linux / WSL)

```bash
curl -fsSL https://dark-llm.cropbinary.com/install.sh | bash
darkcode          # start the TUI, then /login to sign in
```

Installs Bun if needed, puts `darkcode` on your PATH, and **auto-updates in the background** from then
on. Already installed before auto-update existed? Run the line once more to enable it. [Full install &amp; options &rarr;](#install)

## The unlock

Most coding agents route your code and prompts through a vendor's cloud. **darkcode routes them to a
machine you own.** It is a hard-locked terminal client for the self-hosted
[**Dark-LLM**](https://github.com/dark-crop/dark-core) gateway - your own uncensored models, your
own image pipeline, on your own GPU box. A fresh install talks to **one gateway and nothing else**: no
OpenAI, no Anthropic, no telemetry to a third party.

It builds on the proven [opencode](https://github.com/sst/opencode) agent engine (tools, MCP, LSP,
sub-agents, sessions) but has grown into its own thing on top: the provider lock, an isolated config
dir, a fully live Claude Code-style interface (streaming reasoning, live diffs, a real FIFO prompt
queue), one native-vLLM model with effort tiers, persistent cross-session memory, browser sign-in, and
**local image generation / editing / pose-transfer as first-class agent tools.**

```mermaid
flowchart LR
    U(["you"]) --> DC["darkcode TUI"]
    DC -->|"Bearer key (/login)"| G{{"Dark-LLM gateway<br/>your GPU box"}}

    subgraph lanes["built-in dark-llm provider (locked)"]
        direction TB
        MP["Mr. President 1.1 · 262K"]
        EF["effort: low · med · high · ultra"]
    end
    subgraph img["image tools"]
        direction TB
        GEN["generate · z-image"]
        EDT["edit · Qwen-Image-Edit"]
        POSE["pose · AnyPose"]
        INP["inpaint · AliMama CN"]
    end
    G --> lanes
    G --> img

    classDef hub fill:#a855f7,stroke:#7c3aed,stroke-width:2px,color:#fff
    class G hub
```

## Highlights

| | |
|---|---|
| 🔒 **One gateway, one provider** | Hard-locked to `dark-llm`. No other provider ever appears in the picker. |
| 🧠 **One model, four efforts** | One native-vLLM lane - **Mr. President 1.1** (full 262K context) - and `/effort` picks the reasoning tier (low → ultra). The model name comes **live from the gateway**, never hardcoded. |
| 👁 **Every lane reads images** | Attach a screenshot and ask - all chat lanes have vision built in. |
| 🎨 **Images as tools** | Generate, edit, **re-pose**, and **inpaint** images inline - the agent calls them when you ask. |
| ⚡ **Everything is live** | Reasoning streams **above** the answer step-by-step, writes render as a live green diff, shell output streams in - then each turn ends with a `* <sign-off> (<time>)` run-time line. |
| ⛓ **Real message queue** | Stack prompts while it's busy and they run **in order** (FIFO); Esc interrupts the current turn and the rest of the queue keeps going. |
| 🧠 **Persistent memory** | An agent memory tool (global + per-project) - darkcode remembers facts across sessions the way it reads `AGENTS.md`. |
| 🔦 **Code-aware (LSP)** | Go-to-definition, references, hover, and workspace symbols are wired in, and diagnostics surface after every edit - so the model navigates by **ground truth**, not guesses. |
| 🖥 **Runs long processes** | A real background shell - start dev servers, watchers, or `tail -f` (`bash_background`), read their output as it accumulates (`bash_output`), and stop them (`bash_kill`) without blocking the turn. |
| 🕐 **Knows who / where / when** | The agent always knows your local date, time, timezone, approximate location, and language - derived from your system timezone, **no IP-geolocation or network call**. |
| 🌐 **Browser sign-in** | `/login` opens a self-contained page: username/password → token, and the pasted key is masked. |
| 🟣 **Power-purple, Claude Code-style** | Scrolling mascot header, clean divider-framed input, one sassy live "working" verb. |
| 📦 **Isolated config** | Lives in `~/.config/darkcode` - never touches your opencode setup or keys. |

## Install

**One line** (installs Bun if needed, fetches the source, puts `darkcode` on your PATH):

```bash
curl -fsSL https://dark-llm.cropbinary.com/install.sh | bash
darkcode --version
```

The installer lands in `~/.darkcode` and links the launcher into `~/.local/bin` (override with
`DARKCODE_HOME` / `DARKCODE_BIN`). Same script is on GitHub:
`curl -fsSL https://raw.githubusercontent.com/dark-crop/darkcode-cli/master/install.sh | bash`.

**Auto-updates in the background** (like Claude Code): an installed darkcode quietly fetches the latest
source on launch (throttled to once every 4 hours) and applies it on your **next** start - you'll see
`* darkcode updated to <hash>`. Re-running the install line still works to update on demand. Disable
auto-update with `DARKCODE_NO_UPDATE=1`. Dev clones (anything without the installer's marker) are never
auto-updated, so your local work is safe.

<details>
<summary><b>Or install from source</b> (Bun, no build step)</summary>

```bash
git clone https://github.com/dark-crop/darkcode-cli.git
cd darkcode
bun install
./darkcode --help          # runs immediately
```

Symlink the launcher onto your `PATH` so `git pull` alone updates your installed command:

```bash
sudo ln -s "$(pwd)/darkcode" /usr/local/bin/darkcode
cd ~/my-project && darkcode
```

</details>

> **Why the `./darkcode` launcher and not `bun run src/index.ts`?** The TUI uses SolidJS JSX, which Bun
> only transforms with the `@opentui/solid` preload active. The launcher wires that up while keeping
> *your* cwd as the project. Running the entry file directly fails with `Cannot find module
> 'react/jsx-dev-runtime'`. Always start through the launcher. See [docs/install.md](docs/install.md).

## Quick start

```bash
darkcode                      # 1. start the TUI
```
```
/login                        # 2. sign in (browser page: user/pass -> token, paste back)
> how do I ...                # 3. just talk to it
```

The default model is **`president-high`** (Mr. President 1.1, high effort). Non-interactive too:

```bash
darkcode run --model dark-llm/president-low "explain this stack trace"
```

## Models

One chat lane - **Mr. President 1.1**, your own uncensored, tool-capable model served natively on your
GPU box - across four effort tiers. A model id is `<lane>-<tier>` (e.g. `president-med`).

| Tier | Thinking | Context |
|---|---|---|
| `low` | off - fastest, cleanest output | 262K |
| `med` | on - small reasoning budget | 262K |
| `high` | on (default) - large reasoning budget | 262K |
| `ultra` | on - max reasoning budget | 262K |

Every tier gets the full native **262K** window; they differ only in how much the model thinks.
`/effort` switches the tier. **The model name and list come live from the gateway** (`GET /v1/models`
+ `/model/info`) - darkcode never hardcodes the model, so the picker always shows exactly what your
key is allowed and whatever the gateway is currently serving. Falls back to a generic label offline.
See [docs/models.md](docs/models.md).

## Images

darkcode can **make and change images inline** - just ask in plain language and the agent calls the
`image` tool itself (no command to remember). The edit/pose modes keep your subject's identity by
conditioning on your real photo.

| Mode | Just say | Behind it |
|---|---|---|
| 🖼 **Generate** | `generate a purple robot icon, 16:9` | Z-Image Turbo (~24 s) |
| ✏️ **Edit** | *attach a photo* → `edit this: replace her shirt with a party dress` | Qwen-Image-Edit-2511 + Lightning (~10-15 s) |
| 🤸 **Pose** | *attach person + pose image* → `make her do this pose` | AnyPose - copies the pose, keeps identity |
| 🩹 **Inpaint** | *attach image + mask* → `put a balloon in the white area` | Qwen-Image AliMama inpaint ControlNet - masked region only |

```
make a wide 16:9 landscape of neon mountains         # generate (name a ratio or WxH)
[attach photo]  edit this - add a party hat           # edit - attached image used automatically
[attach person] [attach pose]  copy this pose         # pose - person first, pose second
```

**Vision vs. image tool:** if you drop a screenshot and ask darkcode to *read* it or *act on what it
shows* ("what is this", "build this UI", "fix this bug"), it just **looks** (vision) - no image is made.
It only calls the image tool when you actually want an image *out* (generate / edit / pose / inpaint).

Results save as PNG in your workspace. The first image call asks a one-time permission. See
[docs/images.md](docs/images.md).

## Commands

| Command | Does |
|---|---|
| `/login` · `/logout` | Browser sign-in (in-page user/pass → token) · sign out |
| `/model` | Pick the model lane (currently Mr. President 1.1) |
| `/effort` | Pick the tier - low / med / high / ultra |
| `/init` | Investigate the repo and write a compact `AGENTS.md` (shows just `/init`, not the prompt) |
| `/review [target]` | Review changes (uncommitted / commit / branch / PR) |
| `/context` | Context-window usage: segmented bar, token breakdown, cost |

## The interface

A stripped-down, Claude Code-style TUI - everything inside one scrollbox:

```
▛▀▀▀▜  darkcode
▌▪ ▪▐  Mr. President 1.1 · med  dark-llm
▌ ▬ ▐  ~/code/project
▙▄▄▄▟

  › how do I ...                       (your messages + the model's answers)

  ▓ You wish I was faster  (12s · ↓ 1.2k)   ← one live working row

────────────────────────────────────────────
  › <your next prompt>
────────────────────────────────────────────
  Mr. President 1.1 · med  dark-llm    tab agents  ctrl+p commands
```

- **Scrolling mascot header** - pixel face + model + cwd, scrolls with the chat (not pinned).
- **Clean input** - full-width dividers frame a `›` indicator; no shaded box, no placeholder.
- **One live "working" verb** - a block spinner + a rotating, faintly sassy verb + `(elapsed · ↓ tokens)`.
- **Live reasoning** - thinking streams *above* the answer as the model works (click to expand the last
  12 lines); each finished turn closes with a muted `* <sassy sign-off> (<total time>)` line.
- **Live tools** - a running `write` shows the file streaming in as a green diff; shell output streams in
  and collapses to a single line (click to expand). No mid-token flicker.

The whole app is themed from one accent (`#a855f7` dark, `#7c3aed` light) defined once in
`packages/tui/src/theme/assets/darkcode.json`. See [docs/ui.md](docs/ui.md).

## The lock

This is the point of the fork - darkcode only ever talks to one provider. Three enforcement points:

1. **Config isolation** - `packages/core/src/global.ts` sets `app = "darkcode"`, so all XDG dirs are
   `~/.config/darkcode` etc. It never reads your existing opencode config or auth.
2. **Provider hard-lock** - `config.ts` forces `enabled_providers = ["dark-llm"]` after all config
   merges, so opencode / openai / anthropic never appear regardless of user config.
3. **Built-in provider** - `builtin-provider.ts` bakes in the `dark-llm` provider with zero config:
   base URL, the lanes/tiers, and the default `president-high`.

## Requirements

- **[Bun](https://bun.sh)** (the only runtime; no build step).
- A reachable **[Dark-LLM](https://github.com/dark-crop/dark-core) gateway** and a user key (get one via
  `/login`).

## Docs

| Doc | What it covers |
|---|---|
| [install.md](docs/install.md) | Build from source, the launcher + required preload, PATH, troubleshooting. |
| [models.md](docs/models.md) | Lanes, tiers, `/model` / `/effort`, the live model list. |
| [images.md](docs/images.md) | The `image` tool (agent-called): generate, edit, pose, inpaint. |
| [auth.md](docs/auth.md) | `/login` (in-page browser flow) and `/logout`, key storage, `DARK_LLM_KEY`. |
| [context.md](docs/context.md) | The `/context` usage bar. |
| [ui.md](docs/ui.md) | The Claude Code-style interface and the power-purple theme. |
| [architecture.md](docs/architecture.md) | The provider lock, isolated config, `packages/` layout. |

## Relationship to opencode

darkcode started as a **fork of [opencode](https://github.com/sst/opencode)** and has diverged
substantially: the hard provider lock, isolated config, the power-purple Claude Code-style UI with
live streaming reasoning / diffs / a real FIFO prompt queue, single-model effort tiers, persistent
memory, the browser login, and the image tools. It still rides on the opencode agent engine, and
internal package names (`@opencode-ai/*`) are kept compatible so upstream improvements stay mergeable.
Credit for the underlying agent belongs to the opencode team. It is **not affiliated with or endorsed
by** opencode.

## Status

**Early preview.** Under active development and diverging from upstream. Expect rough edges.

## License

MIT - see [LICENSE](LICENSE).
