#!/bin/bash
# Boots the Figma side of the bridge on this Mac so a remote harness
# (OpenClaw, phone chat, etc.) can drive it without anyone at the keyboard.
#
# Usage: ./scripts/figma-up.sh [fileKey]
# Needs: System Settings > Privacy & Security > Accessibility -> allow your
# terminal app, so osascript may click Figma's menus.

set -euo pipefail

FILE_KEY="${1:-lfUaTYV6m43VkBLHbkM9t4}"

# 1. Keep the Mac awake while this script lives (display may still sleep).
caffeinate -dims &
CAFF_PID=$!
trap 'kill $CAFF_PID 2>/dev/null || true' EXIT
echo "caffeinate running (pid $CAFF_PID)"

# 2. Open the file in the desktop app via deep link.
open -a Figma "figma://file/${FILE_KEY}"
echo "waiting for Figma to load the file..."
sleep 20

# 3. Click Plugins > Development > Unofficial Figma MCP. Dev plugins cannot autostart,
#    so this is scripted UI automation — the one manual step, automated.
osascript <<'EOF'
tell application "Figma" to activate
delay 2
tell application "System Events"
  tell process "Figma"
    click menu item "Unofficial Figma MCP" of menu of menu item "Development" of menu of menu bar item "Plugins" of menu bar 1
  end tell
end tell
EOF
echo "plugin launched — verify with the figma_status MCP tool"

# 4. Stay resident so caffeinate keeps the machine up. Ctrl+C to stop.
wait $CAFF_PID
