#!/bin/bash
# Generate and install a .desktop file for ThreadLiner with correct paths
# Run from anywhere: bash scripts/install-desktop.sh
# Skips silently on non-Linux systems.

if [ "$(uname)" != "Linux" ]; then
  exit 0
fi

# Skip in CI runners — the runner's $HOME is ephemeral, the desktop entry
# would be useless, and electron-builder's packaging step doesn't need it.
if [ -n "${CI:-}" ] || [ -n "${GITHUB_ACTIONS:-}" ]; then
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DESKTOP_DIR="$HOME/.local/share/applications"
DESKTOP_FILE="$DESKTOP_DIR/threadliner.desktop"

mkdir -p "$DESKTOP_DIR"

cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Name=ThreadLiner
Comment=A desktop RSS reader
Exec=npx --prefix "$PROJECT_DIR" electron "$PROJECT_DIR"
Icon=$PROJECT_DIR/assets/icon.png
Type=Application
Categories=Network;Feed;
StartupWMClass=ThreadLiner
EOF

# Nudge the launcher database so GNOME/KDE re-read the entry without a logout.
# Requires desktop-file-utils (Debian/Ubuntu: `sudo apt install desktop-file-utils`).
# The per-app icon bitmap cache in GNOME Shell may still need a Shell restart
# (Alt+F2 -> r on X11) or session logout/in on Wayland to refresh.
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
fi

echo "Installed: $DESKTOP_FILE"
echo "Icon:      $PROJECT_DIR/assets/icon.png"
echo "If the dock/alt-tab still shows the old icon, restart GNOME Shell"
echo "(Alt+F2 -> r on X11, or log out/in on Wayland)."
