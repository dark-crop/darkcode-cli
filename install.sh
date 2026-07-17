#!/usr/bin/env bash
# darkcode installer - one-line setup.
#
#   curl -fsSL https://dark-llm.cropbinary.com/install.sh | bash
#   darkcode --version
#
# Installs Bun (if missing), fetches darkcode from source, and puts the `darkcode`
# launcher on your PATH. Re-running updates an existing install. No build step.
#
# Env overrides: DARKCODE_REPO, DARKCODE_BRANCH, DARKCODE_HOME (install dir),
# DARKCODE_BIN (where the launcher symlink goes).
set -euo pipefail

REPO="${DARKCODE_REPO:-https://github.com/dark-crop/darkcode-cli.git}"
BRANCH="${DARKCODE_BRANCH:-master}"
INSTALL_DIR="${DARKCODE_HOME:-$HOME/.darkcode}"
BIN_DIR="${DARKCODE_BIN:-$HOME/.local/bin}"

info() { printf '\033[35m*\033[0m %s\n' "$*"; }
die()  { printf '\033[31mdarkcode install: %s\033[0m\n' "$*" >&2; exit 1; }

command -v git >/dev/null 2>&1 || die "git is required (install git, then re-run)."
command -v curl >/dev/null 2>&1 || die "curl is required."

# 1. Bun - the only runtime darkcode needs.
if ! command -v bun >/dev/null 2>&1; then
  info "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash >/dev/null
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi
command -v bun >/dev/null 2>&1 || die "Bun did not install; open a new shell and re-run."

# 2. Fetch or update the source.
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Updating darkcode in $INSTALL_DIR"
  git -C "$INSTALL_DIR" fetch --depth 1 origin "$BRANCH" -q
  git -C "$INSTALL_DIR" reset --hard "origin/$BRANCH" -q
else
  info "Cloning darkcode into $INSTALL_DIR"
  rm -rf "$INSTALL_DIR"
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$INSTALL_DIR" -q
fi

# 3. Install dependencies (no build step).
info "Installing dependencies (bun install)..."
( cd "$INSTALL_DIR" && bun install --silent )

# 4. Put the launcher on PATH (symlink resolves back to the repo root).
mkdir -p "$BIN_DIR"
chmod +x "$INSTALL_DIR/darkcode"
ln -sf "$INSTALL_DIR/darkcode" "$BIN_DIR/darkcode"
info "Linked $BIN_DIR/darkcode -> $INSTALL_DIR/darkcode"

# 5. PATH hint if the bin dir is not already on PATH.
case ":$PATH:" in
  *":$BIN_DIR:"*) ON_PATH=1 ;;
  *) ON_PATH=0 ;;
esac

printf '\n\033[35mdarkcode installed.\033[0m\n\n'
if [ "$ON_PATH" -eq 0 ]; then
  cat <<EOF
Add it to your PATH - put this in your ~/.zshrc or ~/.bashrc:

    export PATH="$BIN_DIR:\$PATH"

then open a new terminal (or run that line now). After that:

EOF
fi
cat <<EOF
    darkcode --version
    darkcode            # start the TUI, then /login to sign in

EOF
