#!/usr/bin/env bash

set -Eeuo pipefail

REPOSITORY="pradityaaldi/open-figma-mcp"
APP_ROOT="${OPEN_FIGMA_MCP_HOME:-$HOME/.local/share/open-figma-mcp}"
BIN_DIR="${OPEN_FIGMA_MCP_BIN_DIR:-$HOME/.local/bin}"
BIN_PATH="$BIN_DIR/open-figma-mcp"
REQUESTED_REF="${OPEN_FIGMA_MCP_REF:-latest}"
INSTALL_PLUGIN=true
UNINSTALL=false

info() {
  printf '\033[1;34m%s\033[0m\n' "$*"
}

success() {
  printf '\033[1;32m%s\033[0m\n' "$*"
}

warn() {
  printf '\033[1;33m%s\033[0m\n' "$*" >&2
}

fail() {
  printf '\033[1;31merror:\033[0m %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Open Figma MCP installer

Usage:
  install.sh                         install or update to the latest release
  install.sh --ref v0.1.0            install a specific tag
  install.sh --no-plugin             skip Figma plugin registration
  install.sh --uninstall             remove the app and Figma plugin

Environment:
  OPEN_FIGMA_MCP_HOME                app directory (default: ~/.local/share/open-figma-mcp)
  OPEN_FIGMA_MCP_BIN_DIR             command directory (default: ~/.local/bin)
  OPEN_FIGMA_MCP_REF                 release tag or branch (default: latest)
EOF
}

while (($#)); do
  case "$1" in
    --ref|--version)
      [[ $# -ge 2 ]] || fail "$1 requires a value"
      REQUESTED_REF="$2"
      shift 2
      ;;
    --no-plugin)
      INSTALL_PLUGIN=false
      shift
      ;;
    --uninstall)
      UNINSTALL=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1"
      ;;
  esac
done

safe_app_root() {
  [[ -n "$APP_ROOT" && "$APP_ROOT" != "/" && "$APP_ROOT" != "$HOME" ]]
}

uninstall() {
  safe_app_root || fail "refusing to remove unsafe path: $APP_ROOT"

  if [[ "$INSTALL_PLUGIN" == true && -x "$BIN_PATH" ]]; then
    info "Removing the Figma development plugin…"
    "$BIN_PATH" uninstall-plugin || warn "Plugin removal was not completed; you can remove it from Figma manually."
  fi

  rm -f -- "$BIN_PATH"
  rm -rf -- "$APP_ROOT"
  success "Open Figma MCP was removed."
}

if [[ "$UNINSTALL" == true ]]; then
  uninstall
  exit 0
fi

command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v tar >/dev/null 2>&1 || fail "tar is required"
command -v node >/dev/null 2>&1 || fail "Node.js 20 or newer is required: https://nodejs.org"
command -v npm >/dev/null 2>&1 || fail "npm is required"

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
[[ "$NODE_MAJOR" -ge 20 ]] || fail "Node.js 20 or newer is required (found $(node --version))"

case "$(uname -s)" in
  Darwin|Linux) ;;
  *) fail "this installer currently supports macOS and Linux" ;;
esac

REF="$REQUESTED_REF"
REF_KIND="tags"

if [[ "$REF" == "latest" ]]; then
  info "Finding the latest release…"
  RELEASE_JSON="$(curl -fsSL "https://api.github.com/repos/$REPOSITORY/releases/latest" 2>/dev/null || true)"
  REF="$(printf '%s' "$RELEASE_JSON" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
  if [[ -z "$REF" ]]; then
    REF="main"
    REF_KIND="heads"
    warn "No GitHub release found; installing the current main branch."
  fi
elif [[ "$REF" == "main" ]]; then
  REF_KIND="heads"
fi

SAFE_REF="${REF//[^A-Za-z0-9._-]/-}"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/open-figma-mcp.XXXXXX")"
trap 'rm -rf -- "$TMP_DIR"' EXIT

ARCHIVE="$TMP_DIR/source.tar.gz"
SOURCE_DIR="$TMP_DIR/source"
ARCHIVE_URL="https://codeload.github.com/$REPOSITORY/tar.gz/refs/$REF_KIND/$REF"

info "Downloading Open Figma MCP ($REF)…"
curl -fL --retry 3 --connect-timeout 15 "$ARCHIVE_URL" -o "$ARCHIVE"
mkdir -p "$SOURCE_DIR"
tar -xzf "$ARCHIVE" -C "$SOURCE_DIR" --strip-components=1

info "Installing runtime dependencies…"
(
  cd "$SOURCE_DIR"
  npm ci --omit=dev --ignore-scripts --no-audit --no-fund
)

safe_app_root || fail "refusing to install to unsafe path: $APP_ROOT"
RELEASE_DIR="$APP_ROOT/releases/${SAFE_REF}-$(date +%Y%m%d%H%M%S)-$$"
mkdir -p "$APP_ROOT/releases" "$BIN_DIR"
mv "$SOURCE_DIR" "$RELEASE_DIR"
if [[ -e "$APP_ROOT/current" && ! -L "$APP_ROOT/current" ]]; then
  fail "$APP_ROOT/current exists and is not a symbolic link"
fi
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"
ln -sfn "$APP_ROOT/current/bin/cli.js" "$BIN_PATH"

if [[ "$INSTALL_PLUGIN" == true ]]; then
  info "Installing the Figma development plugin…"
  "$BIN_PATH" install-plugin
fi

success "Open Figma MCP is installed."
printf '\nCommand: %s\n' "$BIN_PATH"

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    printf '\nAdd this line to your shell profile, then restart the terminal:\n'
    printf '  export PATH="%s:$PATH"\n' "$BIN_DIR"
    ;;
esac

cat <<EOF

MCP client configuration:
{
  "mcpServers": {
    "open-figma-mcp": {
      "command": "$BIN_PATH"
    }
  }
}

Open a Figma file, then run:
Plugins → Development → Open Figma MCP

Update:    run the install command again
Uninstall: curl -fsSL https://pradityaaldi.github.io/open-figma-mcp/install.sh | bash -s -- --uninstall
EOF
