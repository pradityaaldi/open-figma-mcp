#!/usr/bin/env bash

set -Eeuo pipefail

REPOSITORY="pradityaaldi/unofficial-figma-mcp"
APP_ROOT="${UNOFFICIAL_FIGMA_MCP_HOME:-$HOME/.local/share/unofficial-figma-mcp}"
BIN_DIR="${UNOFFICIAL_FIGMA_MCP_BIN_DIR:-$HOME/.local/bin}"
BIN_PATH="$BIN_DIR/unofficial-figma-mcp"
REQUESTED_REF="${UNOFFICIAL_FIGMA_MCP_REF:-latest}"
# Installs from before the rename to unofficial-figma-mcp.
LEGACY_APP_ROOT="$HOME/.local/share/open-figma-mcp"
LEGACY_BIN_PATH="$BIN_DIR/open-figma-mcp"
INSTALL_PLUGIN=true
UNINSTALL=false
FORCE_BUNDLED_NODE=false
# Used when no Node.js 20+ is on PATH: an official LTS build is downloaded
# into the app directory, so nothing system-wide changes and no sudo is needed.
NODE_MIN_MAJOR=20
NODE_LTS_LINE="${UNOFFICIAL_FIGMA_MCP_NODE_LINE:-latest-v24.x}"

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
Unofficial Figma MCP installer

Usage:
  install.sh                         install or update to the latest release
  install.sh --ref v0.1.0            install a specific tag
  install.sh --no-plugin             skip Figma plugin registration
  install.sh --use-bundled-node      always use a private Node.js, even if one is installed
  install.sh --uninstall             remove the app and Figma plugin

Environment:
  UNOFFICIAL_FIGMA_MCP_HOME                app directory (default: ~/.local/share/unofficial-figma-mcp)
  UNOFFICIAL_FIGMA_MCP_BIN_DIR             command directory (default: ~/.local/bin)
  UNOFFICIAL_FIGMA_MCP_REF                 release tag or branch (default: latest)
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
    --use-bundled-node)
      FORCE_BUNDLED_NODE=true
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
  if [[ -L "$LEGACY_BIN_PATH" ]]; then rm -f -- "$LEGACY_BIN_PATH"; fi
  success "Unofficial Figma MCP was removed."
}

if [[ "$UNINSTALL" == true ]]; then
  uninstall
  exit 0
fi

command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v tar >/dev/null 2>&1 || fail "tar is required"

case "$(uname -s)" in
  Darwin) NODE_OS="darwin" ;;
  Linux) NODE_OS="linux" ;;
  *) fail "this installer currently supports macOS and Linux" ;;
esac
case "$(uname -m)" in
  arm64|aarch64) NODE_ARCH="arm64" ;;
  x86_64|amd64) NODE_ARCH="x64" ;;
  *) fail "unsupported CPU architecture: $(uname -m)" ;;
esac

sha256_of() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d ' ' -f 1
  else
    sha256sum "$1" | cut -d ' ' -f 1
  fi
}

# Absolute path to a Node.js 20+ binary, or nothing.
usable_node() {
  local candidate major
  for candidate in "$@"; do
    [[ -n "$candidate" && -x "$candidate" ]] || continue
    major="$("$candidate" -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || true)"
    if [[ "$major" =~ ^[0-9]+$ && "$major" -ge "$NODE_MIN_MAJOR" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

# Download the official Node.js LTS build, verify its checksum, and unpack it
# into $APP_ROOT/node. Prints the path of the node binary.
install_private_node() {
  local base="https://nodejs.org/dist/$NODE_LTS_LINE"
  local sums name expected actual dir="$APP_ROOT/node"
  sums="$(curl -fsSL --retry 3 "$base/SHASUMS256.txt")" || fail "could not reach nodejs.org to download Node.js"
  name="$(printf '%s\n' "$sums" | grep -Eo "node-v[0-9.]+-$NODE_OS-$NODE_ARCH\.tar\.gz$" | head -n 1)"
  [[ -n "$name" ]] || fail "no Node.js build found for $NODE_OS-$NODE_ARCH"
  expected="$(printf '%s\n' "$sums" | grep " $name\$" | cut -d ' ' -f 1)"

  info "Downloading ${name%.tar.gz} from nodejs.org…" >&2
  curl -fL --progress-bar --retry 3 --connect-timeout 15 "$base/$name" -o "$TMP_DIR/$name" >&2
  actual="$(sha256_of "$TMP_DIR/$name")"
  [[ -n "$expected" && "$actual" == "$expected" ]] || fail "Node.js download failed its checksum; try again"

  rm -rf -- "$dir.new"
  mkdir -p "$dir.new"
  tar -xzf "$TMP_DIR/$name" -C "$dir.new" --strip-components=1
  rm -rf -- "$dir"
  mv "$dir.new" "$dir"
  printf '%s\n' "$dir/bin/node"
}

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
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/unofficial-figma-mcp.XXXXXX")"
trap 'rm -rf -- "$TMP_DIR"' EXIT

safe_app_root || fail "refusing to install to unsafe path: $APP_ROOT"
mkdir -p "$APP_ROOT"

info "Checking for Node.js ${NODE_MIN_MAJOR} or newer…"
NODE_BIN=""
if [[ "$FORCE_BUNDLED_NODE" != true ]]; then
  NODE_BIN="$(usable_node "$(command -v node 2>/dev/null || true)" "$APP_ROOT/node/bin/node" || true)"
fi
if [[ -z "$NODE_BIN" ]]; then
  if [[ "$FORCE_BUNDLED_NODE" == true ]]; then
    info "Installing a private copy of Node.js (LTS)…"
  else
    info "Node.js ${NODE_MIN_MAJOR}+ not found. Installing a private copy of Node.js (LTS)…"
  fi
  NODE_BIN="$(install_private_node)"
  usable_node "$NODE_BIN" >/dev/null || fail "the downloaded Node.js does not run on this machine"
  success "Node.js $("$NODE_BIN" --version) ready at $NODE_BIN"
else
  success "Using Node.js $("$NODE_BIN" --version) at $NODE_BIN"
fi
# npm and the app must run on this exact node, whatever PATH says.
export PATH="$(dirname "$NODE_BIN"):$PATH"
export NPM_CONFIG_UPDATE_NOTIFIER=false
command -v npm >/dev/null 2>&1 || fail "npm was not found next to $NODE_BIN"

ARCHIVE="$TMP_DIR/source.tar.gz"
SOURCE_DIR="$TMP_DIR/source"
ARCHIVE_URL="https://codeload.github.com/$REPOSITORY/tar.gz/refs/$REF_KIND/$REF"

info "Downloading Unofficial Figma MCP ($REF)…"
curl -fL --retry 3 --connect-timeout 15 "$ARCHIVE_URL" -o "$ARCHIVE"
mkdir -p "$SOURCE_DIR"
tar -xzf "$ARCHIVE" -C "$SOURCE_DIR" --strip-components=1

info "Installing runtime dependencies…"
(
  cd "$SOURCE_DIR"
  npm ci --omit=dev --ignore-scripts --no-audit --no-fund
)

RELEASE_DIR="$APP_ROOT/releases/${SAFE_REF}-$(date +%Y%m%d%H%M%S)-$$"
mkdir -p "$APP_ROOT/releases" "$BIN_DIR"
mv "$SOURCE_DIR" "$RELEASE_DIR"
if [[ -e "$APP_ROOT/current" && ! -L "$APP_ROOT/current" ]]; then
  fail "$APP_ROOT/current exists and is not a symbolic link"
fi
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"

# The command is a tiny wrapper that names node by absolute path, so desktop
# MCP clients work even though they do not inherit the terminal's PATH.
rm -f -- "$BIN_PATH"
cat > "$BIN_PATH" <<WRAPPER
#!/bin/sh
exec "$NODE_BIN" "$APP_ROOT/current/bin/cli.js" "\$@"
WRAPPER
chmod 755 "$BIN_PATH"

# Migrate an Open Figma MCP install: keep the old command name working for
# existing MCP client configs, and drop the old app directory.
if [[ -L "$LEGACY_BIN_PATH" || -d "$LEGACY_APP_ROOT" ]]; then
  info "Migrating from Open Figma MCP…"
  if [[ -L "$LEGACY_BIN_PATH" ]]; then
    ln -sfn "$BIN_PATH" "$LEGACY_BIN_PATH"
  fi
  rm -rf -- "$LEGACY_APP_ROOT"
  warn "The command is now $BIN_PATH. $LEGACY_BIN_PATH still works, but update your MCP config when convenient."
fi

if [[ "$INSTALL_PLUGIN" == true ]]; then
  info "Installing the Figma development plugin…"
  "$BIN_PATH" install-plugin
fi

success "Unofficial Figma MCP is installed."
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
    "unofficial-figma-mcp": {
      "command": "$BIN_PATH"
    }
  }
}

Terminal agents (one command each):
  Claude Code:  claude mcp add --scope user unofficial-figma-mcp -- "$BIN_PATH"
  Command Code: cmd mcp add --scope user unofficial-figma-mcp -- "$BIN_PATH"

Open a Figma file, then run:
Plugins → Development → Unofficial Figma MCP

Update:    run the install command again
Uninstall: curl -fsSL https://pradityaaldi.github.io/unofficial-figma-mcp/install.sh | bash -s -- --uninstall
EOF

# Finish with a banner big enough to notice. Block letters need UTF-8;
# fall back to plain ASCII letters elsewhere.
case "${LC_ALL:-${LC_CTYPE:-${LANG:-}}}" in
  *UTF-8*|*utf8*|*UTF8*|*utf-8*) BIG_FONT=true ;;
  *) BIG_FONT=false ;;
esac
printf '\n\033[1;32m'
if [[ "$BIG_FONT" == true ]]; then
  cat <<'ART'
███████╗██╗   ██╗ ██████╗ ██████╗███████╗███████╗███████╗
██╔════╝██║   ██║██╔════╝██╔════╝██╔════╝██╔════╝██╔════╝
███████╗██║   ██║██║     ██║     █████╗  ███████╗███████╗
╚════██║██║   ██║██║     ██║     ██╔══╝  ╚════██║╚════██║
███████║╚██████╔╝╚██████╗╚██████╗███████╗███████║███████║
╚══════╝ ╚═════╝  ╚═════╝ ╚═════╝╚══════╝╚══════╝╚══════╝
ART
else
  cat <<'ART'
  ____  _   _  ____ ____ _____ ____ ____
 / ___|| | | |/ ___/ ___| ____/ ___/ ___|
 \___ \| | | | |  | |   |  _| \___ \___ \
  ___) | |_| | |__| |___| |___ ___) |__) |
 |____/ \___/ \____\____|_____|____/____/
ART
fi
printf '\033[0;1m'
cat <<'ART'
  ____  _____    _    ______   __  _____ ___     ____  ___
 |  _ \| ____|  / \  |  _ \ \ / / |_   _/ _ \   / ___|/ _ \
 | |_) |  _|   / _ \ | | | \ V /    | || | | | | |  _| | | |
 |  _ <| |___ / ___ \| |_| || |     | || |_| | | |_| | |_| |
 |_| \_\_____/_/   \_\____/ |_|     |_| \___/   \____|\___/
ART
printf '\033[0m\n'
printf 'Next: connect your AI app. Step by step: https://pradityaaldi.github.io/unofficial-figma-mcp/#setup\n'
