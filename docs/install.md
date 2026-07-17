# Installing darkcode

darkcode installs **from source only**. There is no npm package or prebuilt
binary yet, so you clone the repo, install dependencies with Bun, and run the
committed `./darkcode` launcher.

darkcode is an MIT-licensed fork of [opencode](https://github.com/sst/opencode),
rebranded and locked into being a dedicated client for the self-hosted
[Dark-LLM](https://dark-llm.cropbinary.com) gateway.

## Requirements

- **[Bun](https://bun.sh)** - the only runtime you need. darkcode runs its
  TypeScript entry point directly with Bun; there is no separate build step.
- **git** - to clone the repo and to keep it up to date with `git pull`.

The repo pins a Bun version in the root `package.json` `packageManager` field
(currently `bun@1.3.14`). The pre-push git hook enforces it (see
[Pre-push typecheck hook](#pre-push-typecheck-hook)), so match that version if
you plan to contribute. To install or update Bun:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Install from source

```bash
git clone https://github.com/dark-crop/darkcode-cli.git
cd darkcode
bun install
./darkcode --help          # run it - works immediately, no build step
```

`bun install` sets up the whole workspace under `packages/`. Once that
finishes, the `./darkcode` launcher in the repo root is runnable as-is.

## The `./darkcode` launcher

darkcode ships a committed `./darkcode` shell script at the repo root. Always
start darkcode through this launcher rather than calling the entry file
directly.

The launcher:

1. Resolves the repo root from its own location, following symlinks - so it
   works when the script is symlinked onto your `PATH`.
2. Checks that dependencies are installed and tells you to run `bun install` if
   they are not.
3. Resolves the `@opentui/solid/preload` module to an absolute path.
4. Execs Bun with that preload and forwards all your arguments:

```bash
exec bun --preload "$preload" packages/opencode/src/index.ts "$@"
```

Because the launcher passes the preload as an absolute path (instead of relying
on a `bunfig.toml` in `packages/opencode`), Bun keeps **your** current directory
as the project. That means you can run `darkcode` from any project folder and it
operates on that folder, not on the darkcode source tree.

## Why the `@opentui/solid` preload is required

darkcode's TUI is built with SolidJS JSX. Bun only transforms that JSX when the
`@opentui/solid` preload is active. Without it, the SolidJS runtime resolves the
wrong JSX runtime and the TUI throws:

```
Cannot find module 'react/jsx-dev-runtime'
```

This is why you cannot start darkcode with a bare
`bun run packages/opencode/src/index.ts`. The `./darkcode` launcher wires up the
preload for you, so just use the launcher.

## Put `darkcode` on your PATH

To run `darkcode` from any directory, symlink the launcher onto your `PATH`. A
symlink (rather than a copy) keeps it pointing at the repo, so `git pull` alone
updates your installed command:

```bash
sudo ln -s "$(pwd)/darkcode" /usr/local/bin/darkcode

darkcode --help              # now works from anywhere
cd ~/my-project && darkcode  # operates on your current directory
```

The launcher follows symlinks when resolving the repo root, so the PATH symlink
finds `packages/opencode` and the preload correctly no matter where you invoke
it from.

If `/usr/local/bin` is not on your `PATH`, or you prefer not to use `sudo`, link
into any directory that is on your `PATH` instead, for example `~/.local/bin`:

```bash
mkdir -p ~/.local/bin
ln -s "$(pwd)/darkcode" ~/.local/bin/darkcode
```

## Configuration is isolated

darkcode uses its own config directory, `~/.config/darkcode`, separate from
opencode's `~/.config/opencode`. Installing and running darkcode never reads or
writes your existing opencode configuration.

## Keeping up to date

Because you run from source, updating is just:

```bash
cd /path/to/darkcode
git pull
bun install     # only needed when dependencies change
```

If you symlinked the launcher onto your `PATH`, the `git pull` is enough - the
symlink already points at the updated script.

## Pre-push typecheck hook

The repo installs a Husky pre-push git hook. Before every `git push` it:

1. Verifies your Bun version satisfies the range pinned in the root
   `package.json` `packageManager` field, and fails the push if it does not.
2. Runs the full workspace typecheck:

```bash
bun typecheck   # bun turbo typecheck across all packages
```

If either check fails, the push is aborted. This only affects contributors
pushing to the repo; it does not affect running darkcode.

## Troubleshooting

**`Cannot find module 'react/jsx-dev-runtime'`** - you are running the entry
file directly without the preload. Use the `./darkcode` launcher instead.

**`darkcode: dependencies not installed`** - run `bun install` in the repo root.

**`darkcode: could not resolve @opentui/solid/preload`** - `bun install` did not
complete successfully. Re-run it in the repo root.
