#!/usr/bin/env bash
# darkcode installer - interactive setup / update / uninstall.
#
#   curl -fsSL https://dark-llm.cropbinary.com/install.sh | bash        # interactive menu (in a terminal)
#   curl -fsSL https://dark-llm.cropbinary.com/install.sh | bash -s -- install
#   DARKCODE_ACTION=uninstall bash install.sh
#
# In a terminal it shows a menu (Install / Update / Uninstall). Piped non-interactively (CI, Docker)
# it defaults to Install/Update so the classic one-liner still just works. It installs Bun if missing
# and links the `darkcode` launcher onto your PATH. No build step.
#
# Env: DARKCODE_ACTION (install|update|uninstall), DARKCODE_REPO, DARKCODE_BRANCH,
#      DARKCODE_HOME (install dir), DARKCODE_BIN (launcher dir), DARKCODE_NO_PATH=1, DARKCODE_YES=1.
set -euo pipefail

REPO="${DARKCODE_REPO:-https://github.com/dark-crop/darkcode-cli.git}"
BRANCH="${DARKCODE_BRANCH:-master}"
INSTALL_DIR="${DARKCODE_HOME:-$HOME/.darkcode}"
BIN_DIR="${DARKCODE_BIN:-$HOME/.local/bin}"

P='\033[35m'; B='\033[1m'; DIM='\033[2m'; RED='\033[31m'; GRN='\033[32m'; YLW='\033[33m'; R='\033[0m'
info()  { printf "${P}*${R} %s\n" "$*"; }
ok()    { printf "  ${GRN}ok${R}   %s\n" "$*"; }
warn()  { printf "  ${YLW}warn${R} %s\n" "$*"; }
bad()   { printf "  ${RED}fail${R} %s\n" "$*"; }
die()   { printf "${RED}darkcode install: %s${R}\n" "$*" >&2; exit 1; }
have()  { command -v "$1" >/dev/null 2>&1; }

banner() {
  printf "\n"
  printf "  ${P}${B}\xe2\x96\x9b\xe2\x96\x80\xe2\x96\x80\xe2\x96\x80\xe2\x96\x9c${R}  ${P}${B}darkcode${R} ${DIM}installer${R}\n"
  printf "  ${P}${B}\xe2\x96\x8c\xe2\x96\xaa \xe2\x96\xaa\xe2\x96\x90${R}  ${DIM}a terminal coding agent wired to your own private LLM${R}\n"
  printf "  ${P}${B}\xe2\x96\x99\xe2\x96\x84\xe2\x96\x84\xe2\x96\x84\xe2\x96\x9f${R}\n\n"
}

# ---- preflight health check -------------------------------------------------------------------
# Verify the tools an install needs BEFORE touching anything. Bun is checked here and installed
# later if missing (unzip is only required in that case).
health_check() {
  info "Preflight checks"
  local fail=0
  if have git;  then ok "git";  else bad "git (required)";  fail=1; fi
  if have curl; then ok "curl"; else bad "curl (required)"; fail=1; fi
  if have bun;  then ok "bun $(bun --version 2>/dev/null)";
  else
    warn "bun not found (will be installed)"
    if ! have unzip && ! have 7z; then bad "unzip (needed to install bun)"; fail=1; fi
  fi
  [ "$fail" -eq 0 ] || die "preflight failed - install the tools marked 'fail' above, then re-run."
}

ensure_bun() {
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
  if ! have bun; then
    info "Installing Bun (darkcode's only runtime)..."
    curl -fsSL https://bun.sh/install | bash >/dev/null 2>&1 \
      || die "Bun install failed (check your network / https://bun.sh, then re-run)."
    export PATH="$BUN_INSTALL/bin:$PATH"
  fi
  have bun || die "Bun did not install; open a new shell and re-run."
  info "Bun $(bun --version 2>/dev/null || echo '(unknown)') ready."
}

# ---- PATH wiring (used by install) ------------------------------------------------------------
rc_file_for_shell() {
  case "$(basename "${SHELL:-sh}")" in
    zsh)  printf '%s' "${ZDOTDIR:-$HOME}/.zshrc" ;;
    bash) [ "$(uname 2>/dev/null)" = "Darwin" ] && printf '%s' "$HOME/.bash_profile" || printf '%s' "$HOME/.bashrc" ;;
    fish) printf '%s' "$HOME/.config/fish/config.fish" ;;
    *)    printf '%s' "$HOME/.profile" ;;
  esac
}
on_path() { case ":$PATH:" in *":$1:"*) return 0 ;; *) return 1 ;; esac; }
MARKER="# added by the darkcode installer"

wire_path() {
  [ "${DARKCODE_NO_PATH:-0}" = "1" ] && return 0
  local rc; rc="$(rc_file_for_shell)"
  mkdir -p "$(dirname "$rc")" 2>/dev/null || true
  if [ -f "$rc" ] && grep -qF "$MARKER" "$rc" 2>/dev/null; then
    info "PATH already set up in $rc"; return 0
  fi
  case "$rc" in
    *config.fish)
      { printf '\n%s\n' "$MARKER"; printf 'set -gx BUN_INSTALL "%s"\n' "$BUN_INSTALL";
        printf 'fish_add_path "%s/bin" "%s"\n' "$BUN_INSTALL" "$BIN_DIR"; } >> "$rc" 2>/dev/null \
        && info "Added Bun + darkcode to your PATH in $rc" ;;
    *)
      { printf '\n%s\n' "$MARKER"; printf 'export BUN_INSTALL="%s"\n' "$BUN_INSTALL";
        printf 'export PATH="%s/bin:%s:$PATH"\n' "$BUN_INSTALL" "$BIN_DIR"; } >> "$rc" 2>/dev/null \
        && info "Added Bun + darkcode to your PATH in $rc" ;;
  esac
}

# ---- actions ----------------------------------------------------------------------------------
do_install() {
  health_check
  ensure_bun
  if [ -d "$INSTALL_DIR/.git" ]; then
    info "Updating source in $INSTALL_DIR"
    git -C "$INSTALL_DIR" fetch --depth 1 origin "$BRANCH" -q
    git -C "$INSTALL_DIR" reset --hard "origin/$BRANCH" -q
  else
    info "Cloning darkcode into $INSTALL_DIR"
    rm -rf "$INSTALL_DIR"
    git clone --depth 1 --branch "$BRANCH" "$REPO" "$INSTALL_DIR" -q
  fi
  info "Installing dependencies (bun install)..."
  ( cd "$INSTALL_DIR" && bun install --silent )
  mkdir -p "$BIN_DIR"
  chmod +x "$INSTALL_DIR/darkcode"
  ln -sf "$INSTALL_DIR/darkcode" "$BIN_DIR/darkcode"
  info "Linked $BIN_DIR/darkcode -> $INSTALL_DIR/darkcode"
  # Mark as a managed install (the launcher auto-updates it; a dev clone has no marker). Reset the
  # throttle so the first post-install launch does not immediately re-fetch.
  touch "$INSTALL_DIR/.darkcode-managed"
  date +%s > "$INSTALL_DIR/.last-update-check" 2>/dev/null || true
  wire_path

  printf "\n${P}${B}darkcode installed.${R}\n\n"
  local rc; rc="$(rc_file_for_shell)"
  if on_path "$BIN_DIR" && have bun; then
    printf "    darkcode --version\n    darkcode            ${DIM}# start the TUI, then /login to sign in${R}\n\n"
  else
    printf "One step left - load the new PATH into THIS terminal (new terminals are ready):\n\n"
    printf "    source %s\n\n    darkcode --version\n    darkcode            ${DIM}# then /login${R}\n\n" "$rc"
  fi
}

do_update() {
  [ -d "$INSTALL_DIR/.git" ] || die "darkcode is not installed at $INSTALL_DIR - run Install first."
  health_check
  ensure_bun
  info "Updating darkcode in $INSTALL_DIR"
  git -C "$INSTALL_DIR" fetch --depth 1 origin "$BRANCH" -q
  git -C "$INSTALL_DIR" reset --hard "origin/$BRANCH" -q
  info "Installing dependencies (bun install)..."
  ( cd "$INSTALL_DIR" && bun install --silent )
  chmod +x "$INSTALL_DIR/darkcode"
  ln -sf "$INSTALL_DIR/darkcode" "$BIN_DIR/darkcode"
  printf "\n${P}${B}darkcode updated${R} to %s.\n\n" "$(git -C "$INSTALL_DIR" rev-parse --short HEAD 2>/dev/null || echo latest)"
}

do_uninstall() {
  if [ ! -d "$INSTALL_DIR" ] && [ ! -L "$BIN_DIR/darkcode" ]; then
    info "darkcode does not appear to be installed. Nothing to do."; return 0
  fi
  printf "\n${YLW}This will remove:${R}\n"
  printf "  - %s ${DIM}(the darkcode install)${R}\n" "$INSTALL_DIR"
  printf "  - %s ${DIM}(the launcher symlink)${R}\n" "$BIN_DIR/darkcode"
  printf "  ${DIM}Bun and your PATH line are left in place (remove them by hand if you want).${R}\n"
  if [ "${DARKCODE_YES:-0}" != "1" ]; then
    printf "\n  Remove darkcode? [y/N]: "
    local a=""; if [ -r /dev/tty ]; then read -r a < /dev/tty || true; else read -r a || true; fi
    case "$a" in y|Y|yes|YES) ;; *) info "Cancelled."; return 0 ;; esac
  fi
  rm -f "$BIN_DIR/darkcode"
  rm -rf "$INSTALL_DIR"
  # Config/keys live in ~/.config/darkcode etc.; leave them (a re-install reuses your login).
  printf "\n${P}${B}darkcode uninstalled.${R}\n"
  printf "${DIM}  Your sign-in/config in ~/.config/darkcode was kept. Delete it too if you like.${R}\n\n"
}

# ---- interactive menu (simple numbered prompt, read from /dev/tty) -----------------------------
# Deliberately NOT a raw-mode arrow-key menu: that needs `read -t <frac>` + cursor math, which breaks
# on macOS's bash 3.2 ("invalid timeout specification") and glitches the redraw. A numbered prompt is
# bulletproof across every shell and reads cleanly from /dev/tty under `curl | bash`.
menu() {
  local def="1"; [ -d "$INSTALL_DIR/.git" ] && def="2"    # already installed -> default to Update
  {
    printf '  %b1%b  Install    %bset up darkcode + Bun, link it onto your PATH%b\n' "${P}${B}" "${R}" "${DIM}" "${R}"
    printf '  %b2%b  Update     %bpull the latest darkcode into your existing install%b\n' "${P}${B}" "${R}" "${DIM}" "${R}"
    printf '  %b3%b  Uninstall  %bremove darkcode (keeps your login + Bun)%b\n' "${P}${B}" "${R}" "${DIM}" "${R}"
    printf '  %b4%b  Quit%b\n\n' "${P}${B}" "${R}" "${DIM}" "${R}"
    printf '  Choose %b[1-4]%b (default %b%s%b): ' "${DIM}" "${R}" "${P}${B}" "$def" "${R}"
  } > /dev/tty
  local n=""; read -r n < /dev/tty || n="4"
  [ -z "$n" ] && n="$def"
  printf '\n' > /dev/tty
  case "$n" in
    1|i|install)   printf 'install' ;;
    2|u|update)    printf 'update' ;;
    3|uninstall|remove) printf 'uninstall' ;;
    *)             printf 'quit' ;;
  esac
}

# ---- dispatch ---------------------------------------------------------------------------------
banner
have git  || die "git is required (install git, then re-run)."
have curl || die "curl is required."

ACTION="${DARKCODE_ACTION:-${1:-}}"
if [ -z "$ACTION" ]; then
  if [ -t 1 ] && [ -r /dev/tty ]; then
    ACTION="$(menu)"                    # interactive terminal -> show the menu
  else
    ACTION="install"                    # piped / non-interactive (CI, auto-update) -> just install/update
  fi
fi

case "$ACTION" in
  install)          do_install ;;
  update|upgrade)   do_update ;;
  uninstall|remove) do_uninstall ;;
  quit|q)           info "Bye." ;;
  *)                die "unknown action '$ACTION' (use install | update | uninstall)." ;;
esac
