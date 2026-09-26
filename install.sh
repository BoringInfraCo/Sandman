#!/usr/bin/env sh
set -eu

VERSION="${SANDMAN_VERSION:-latest}"
PREFIX="${PREFIX:-$HOME/.local}"
BIN_DIR="$PREFIX/bin"
TMP_DIR="${TMPDIR:-/tmp}"

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
esac

if command -v npm >/dev/null 2>&1; then
  npm install -g "@itssergio91/sandman@${VERSION}"
  echo "Installed Sandman via npm."
  exit 0
fi

echo "npm not found. Install Node.js 18+ or use: npm install -g @itssergio91/sandman"
exit 1
