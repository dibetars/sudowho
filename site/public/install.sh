#!/usr/bin/env bash
# sudowho installer
#   curl -fsSL https://sudowho.tarsusstudios.com/install.sh | bash
set -euo pipefail

REPO="https://raw.githubusercontent.com/dibetars/sudowho/main"
PREFIX="${SUDOWHO_PREFIX:-$HOME/.sudowho}"
BIN_DIR="${SUDOWHO_BIN_DIR:-$HOME/bin}"

echo "Installing sudowho to $PREFIX ..."
mkdir -p "$PREFIX/bin" "$PREFIX/lib" "$PREFIX/dashboard" "$BIN_DIR"

command -v python3 >/dev/null 2>&1 || { echo "sudowho requires python3. Install it and re-run."; exit 1; }
command -v git >/dev/null 2>&1 || { echo "sudowho requires git. Install it and re-run."; exit 1; }

curl -fsSL "$REPO/cli/bin/sudowho" -o "$PREFIX/bin/sudowho"
curl -fsSL "$REPO/cli/lib/core.py" -o "$PREFIX/lib/core.py"
curl -fsSL "$REPO/cli/lib/dashboard_server.py" -o "$PREFIX/lib/dashboard_server.py"
curl -fsSL "$REPO/cli/dashboard/index.html" -o "$PREFIX/dashboard/index.html"
curl -fsSL "$REPO/cli/dashboard/styles.css" -o "$PREFIX/dashboard/styles.css"
curl -fsSL "$REPO/cli/dashboard/app.js" -o "$PREFIX/dashboard/app.js"

chmod +x "$PREFIX/bin/sudowho"
ln -sf "$PREFIX/bin/sudowho" "$BIN_DIR/sudowho"

echo "Installed to $BIN_DIR/sudowho"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "Add this to your shell profile: export PATH=\"$BIN_DIR:\$PATH\"" ;;
esac

echo
echo "Next steps:"
echo "  sudowho init         # set up your git / gh / vercel profiles"
echo "  sudowho dashboard    # open the local web dashboard"
echo
echo "Everything runs locally. Nothing is uploaded anywhere."
