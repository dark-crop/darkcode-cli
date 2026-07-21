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

# 1. Bun - the only runtime darkcode needs. Auto-detect, and install it if missing.
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
# Pick up an existing Bun that just isn't on PATH yet (e.g. installed moments ago in this shell),
# so we don't reinstall it needlessly.
export PATH="$BUN_INSTALL/bin:$PATH"

if ! command -v bun >/dev/null 2>&1; then
  # Bun's installer unpacks a zip, so it needs unzip (or 7z) present.
  command -v unzip >/dev/null 2>&1 || command -v 7z >/dev/null 2>&1 \
    || die "Bun's installer needs 'unzip' - install unzip, then re-run."
  info "Bun not found - installing Bun..."
  curl -fsSL https://bun.sh/install | bash >/dev/null 2>&1 \
    || die "Bun install failed (check your network / https://bun.sh, then re-run)."
  export PATH="$BUN_INSTALL/bin:$PATH"
fi
command -v bun >/dev/null 2>&1 || die "Bun did not install; open a new shell and re-run."
info "Bun $(bun --version 2>/dev/null || echo '(unknown version)') ready."

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

# Mark this as a managed install so the launcher may auto-update it in the background
# (a dev clone has no marker and is never auto-updated). Reset the throttle so the first
# post-install launch does not immediately re-fetch.
touch "$INSTALL_DIR/.darkcode-managed"
date +%s > "$INSTALL_DIR/.last-update-check" 2>/dev/null || true

# 5. Put BOTH Bun and darkcode on PATH automatically, by appending to the login shell's rc file.
#    This is the whole point of "fully auto": a fresh terminal just works, with zero hand-editing.
#    Idempotent (a marker guards re-runs). Opt out with DARKCODE_NO_PATH=1.
rc_file_for_shell() {
  case "$(basename "${SHELL:-sh}")" in
    zsh)  printf '%s' "${ZDOTDIR:-$HOME}/.zshrc" ;;
    bash) [ "$(uname 2>/dev/null)" = "Darwin" ] && printf '%s' "$HOME/.bash_profile" || printf '%s' "$HOME/.bashrc" ;;
    fish) printf '%s' "$HOME/.config/fish/config.fish" ;;
    *)    printf '%s' "$HOME/.profile" ;;
  esac
}
on_path() { case ":$PATH:" in *":$1:"*) return 0 ;; *) return 1 ;; esac; }

RC="$(rc_file_for_shell)"
MARKER="# added by the darkcode installer"
append_path_block() {
  # $1 = rc path. $PATH is escaped so it stays literal in the file (expanded at shell startup).
  case "$1" in
    *config.fish)
      cat >> "$1" <<EOF

$MARKER
set -gx BUN_INSTALL "$BUN_INSTALL"
fish_add_path "$BUN_INSTALL/bin" "$BIN_DIR"
EOF
      ;;
    *)
      cat >> "$1" <<EOF

$MARKER
export BUN_INSTALL="$BUN_INSTALL"
export PATH="$BUN_INSTALL/bin:$BIN_DIR:\$PATH"
EOF
      ;;
  esac
}

if [ "${DARKCODE_NO_PATH:-0}" != "1" ]; then
  mkdir -p "$(dirname "$RC")" 2>/dev/null || true
  if [ -f "$RC" ] && grep -qF "$MARKER" "$RC" 2>/dev/null; then
    info "PATH already set up in $RC"
  elif append_path_block "$RC" 2>/dev/null; then
    info "Added Bun + darkcode to your PATH in $RC"
  fi
fi

printf '\n\033[35mdarkcode installed.\033[0m\n\n'
if on_path "$BIN_DIR" && command -v bun >/dev/null 2>&1; then
  cat <<EOF
    darkcode --version
    darkcode            # start the TUI, then /login to sign in
EOF
else
  cat <<EOF
One step left - load the new PATH into THIS terminal (new terminals are already set up):

    source $RC

then:

    darkcode --version
    darkcode            # start the TUI, then /login to sign in
EOF
fi
