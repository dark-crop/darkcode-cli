# darkcode docs

darkcode is an MIT-licensed fork of [opencode](https://github.com/sst/opencode), rebranded around a vivid "power purple" accent and locked into being a dedicated terminal client for the self-hosted [Dark-LLM](https://dark-llm.cropbinary.com) gateway. It ships a built-in `dark-llm` provider - three model lanes (Loki, Thor, Ta), with four effort tiers (low/med/high/ultra) on the Loki and Thor chat lanes - and hides every other provider, so a fresh install talks to one gateway and nothing else. Its config lives in its own `~/.config/darkcode` directory, so it never touches your opencode setup.

## Documentation

| Doc | What it covers |
| --- | --- |
| [install.md](install.md) | Build from source: `git clone`, `bun install`, the `./darkcode` launcher (with the required `@opentui/solid` preload), and putting it on your `PATH`. |
| [models.md](models.md) | The `dark-llm` lanes and tiers, the `/model` and `/effort` commands, and how the model list is pulled live from the gateway. |
| [auth.md](auth.md) | Signing in with `/login` (browser flow to the gateway `/token` page) and out with `/logout`, plus where the credential is stored. |
| [context.md](context.md) | The `/context` command: context-window usage, the segmented per-category bar, token breakdown, and cost. |
| [ui.md](ui.md) | The Claude Code-style interface: scrolling mascot header, clean input rail, the single live working indicator, reasoning summaries, and the exit epilogue. |
| [architecture.md](architecture.md) | How darkcode is structured: the provider lock, isolated config, the `packages/` layout, and how it differs from upstream opencode. |

## Quickstart

```bash
git clone <darkcode-repo> && cd darkcode   # clone the source
bun install                                # install dependencies (Bun required)
ln -s "$PWD/darkcode" /usr/local/bin/darkcode   # put the launcher on your PATH
darkcode                                   # run /login on first start, then chat
```

The default model is `dark-llm/thor-med`. See [models.md](models.md) to switch lanes and tiers.
