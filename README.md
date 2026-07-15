<p align="center">
  <h1 align="center">darkcode</h1>
</p>

<p align="center">A polished terminal coding agent for your <strong>own local, uncensored LLMs</strong>.</p>

<p align="center">
  <a href="#installation"><img alt="platform" src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-informational?style=flat-square" /></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" /></a>
  <a href="https://github.com/chatthong/darkcode"><img alt="status" src="https://img.shields.io/badge/status-early%20preview-orange?style=flat-square" /></a>
</p>

---

**darkcode** is a fork of [opencode](https://github.com/sst/opencode) built for one job: give people running local LLMs a terminal agent that actually feels good to use. It ships with a built-in provider for the [Dark-LLM](#the-dark-llm-gateway) gateway, two-axis model control (`/model` for the lane, `/effort` for the reasoning tier), and a one-command sign-in — so a fresh install talks to your own GPU box with zero config.

If you have wired up a local stack and found the existing CLIs a step behind the hosted ones, this is meant to close that gap.

> **Early preview.** darkcode is under active development and diverges from upstream opencode. It is not affiliated with or endorsed by the opencode team.

## Why

Running your own models should not mean settling for a worse agent. darkcode keeps opencode's strong engine (agents, tools, MCP, LSP, sessions) and adds the pieces that make a local stack pleasant:

- **Built-in local provider** — a `dark-llm` provider is baked in as a zero-config default. Fresh installs list and use your models immediately; your global/project config still overrides or disables it.
- **Two-axis model control** — pick the **lane** with `/model` (Singto / Chang / Talay) and the **effort** with `/effort` (low / med / high / ultra). The prompt shows the active choice as `Chang · med`.
- **One-command sign-in** — `darkcode login` supports three ways in: paste a token, username + password, or open the browser and paste the key back.
- **A calmer look** — a warm default theme (light + dark) and working-verb spinners, tuned to feel closer to a hosted agent than a raw REPL.

## Installation

darkcode is not on a package registry yet — run it from source with [Bun](https://bun.sh):

```bash
git clone https://github.com/chatthong/darkcode.git
cd darkcode
bun install
bun run packages/opencode/src/index.ts --help   # verify it runs
```

That last line runs darkcode directly. To get a `darkcode` **command** on your PATH (so `darkcode`, `darkcode login`, etc. work), add a shell function pointing at your clone:

```bash
# from inside the darkcode/ directory:
echo "darkcode() { bun run \"$(pwd)/packages/opencode/src/index.ts\" \"\$@\"; }" >> ~/.zshrc
source ~/.zshrc      # or open a new terminal

darkcode --help      # now works from anywhere
```

> `bun install` alone does **not** create a `darkcode` binary — the `bin` launcher expects a compiled build. The shell function above is the simplest way to run from source. A packaged `darkcode` binary (`bun run --cwd packages/opencode build`) and installers are on the roadmap.

## Quick start

```bash
# 1. sign in to your gateway (see the three methods below)
darkcode login

# 2. start the TUI — it defaults to the built-in dark-llm provider
darkcode

# 3. inside the TUI:
/model     # choose a lane:  Singto (fast) · Chang (coding) · Talay (heavy)
/effort    # choose a tier:  low · med · high · ultra
```

Non-interactive use works too:

```bash
darkcode run --model dark-llm/singto-fast-low "explain this error"
```

### Signing in (3 ways)

`darkcode login` walks you through whichever you prefer:

| Method | When to use |
| --- | --- |
| **Token** | You already have an `sk-…` key — paste it. |
| **Username & password** | Log in with your gateway account. |
| **Open in browser** | Log in on the web, create a key, paste it back. |

All three end the same way: the key is validated against the gateway and stored, so your model calls just work afterward.

### Model lanes & effort

The built-in provider exposes three lanes, each at four effort tiers:

| Lane | Role | Model |
| --- | --- | --- |
| **Singto** | fast answers, cheap fan-out | 35B MoE |
| **Chang** | coding + orchestration (default) | 27B dense |
| **Talay** | heavy reasoning / agent work | 122B MoE |

`low` turns thinking off for clean, fast output; `med`/`high`/`ultra` enable reasoning with an increasing budget. `/model` and `/effort` compose — Chang at `high` is `chang-code-high`.

## The Dark-LLM gateway

darkcode is the client half of a two-part local stack. The server half, **[Dark-LLM](https://github.com/chatthong/dark-llm)**, is an OpenAI-compatible gateway over your own GPU box (llama.cpp + llama-swap + LiteLLM, plus a ComfyUI bridge for images). darkcode's built-in provider points at it out of the box, but because it is just OpenAI-compatible, you can point darkcode at any compatible endpoint via config or `darkcode login --url`.

## Configuration

darkcode reads the same config as opencode (`opencode.json`, `.opencode/`, `~/.config/opencode/`). To disable the built-in provider entirely:

```json
{ "disabled_providers": ["dark-llm"] }
```

To point it at your own gateway, set the `dark-llm` provider's `api` base or use `darkcode login --url https://your-gateway/v1`.

## Relationship to opencode

darkcode is a downstream fork. It tracks opencode's engine and re-brands the user-facing surface; internal package names (`@opencode-ai/*`), config paths, and API shapes are intentionally left compatible to keep merges from upstream tractable. Credit for the underlying agent belongs to the [opencode](https://github.com/sst/opencode) team.

## License

MIT — see [LICENSE](LICENSE).
