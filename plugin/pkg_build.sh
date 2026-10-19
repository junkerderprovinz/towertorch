#!/bin/bash
# Build the TowerTorch plugin package from the Go supervisor binary and the
# plugin files. It uses tar rather than makepkg, so it also runs in CI.
#
#   plugin/pkg_build.sh [VERSION]      # VERSION defaults to today (YYYY.MM.DD)
#
# It writes plugin/out/towertorch-<version>-x86_64-1.txz and its .sha256.
# The release workflow attaches the .txz and injects the sha into the .plg.
set -euo pipefail

VERSION="${1:-$(date +%Y.%m.%d)}"
ARCH="x86_64"
SLUG="towertorch"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN_SRC="$ROOT/plugin/src/$SLUG"
BIN_REL="usr/local/emhttp/plugins/$SLUG/bin/$SLUG"
OUT="$ROOT/plugin/out"
PKGROOT="$(mktemp -d)"
trap 'rm -rf "$PKGROOT"' EXIT

echo "==> building supervisor binary (linux/amd64)"
( cd "$ROOT" && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
  go build -trimpath -ldflags "-s -w -X main.version=v$VERSION" -o "$PLUGIN_SRC/$BIN_REL" ./cmd/towertorch )

echo "==> assembling package tree"
cp -a "$PLUGIN_SRC/." "$PKGROOT/"
chmod +x "$PKGROOT/usr/local/emhttp/plugins/$SLUG/scripts/rc.$SLUG"
chmod +x "$PKGROOT/usr/local/emhttp/plugins/$SLUG/event/"* 2>/dev/null || true
chmod +x "$PKGROOT/$BIN_REL"

# Normalise text files to LF. A CRLF .page breaks Unraid's PageBuilder (it splits
# the header on a pure-LF "\n---\n"), and a trailing CR breaks shell shebangs.
echo "==> normalising text files to LF"
find "$PKGROOT" -type f ! -path "*/bin/*" ! -name '*.png' -print0 \
  | while IFS= read -r -d '' f; do perl -i -pe 's/\r\n/\n/g; s/\r$//' "$f"; done

# The settings page's Info tab shows this as the UI version beside the engine's, so a
# stale frontend under test gives itself away.
echo "==> stamping UI version"
sed -i "s/@@CCVER@@/$VERSION/" \
  "$PKGROOT/usr/local/emhttp/plugins/$SLUG/scripts/settings.js" \
  "$PKGROOT/usr/local/emhttp/plugins/$SLUG/scripts/header.js"

# Unraid's autov() appends "?v=<filemtime>" to the injected .js and .css, so a
# uniform fresh mtime is what makes a release bump the query and the browser drop
# its cached copy. An mtime installpkg restores unchanged would serve the old one.
echo "==> stamping fresh mtimes (cache-bust for autov ?v=)"
find "$PKGROOT/usr/local/emhttp/plugins/$SLUG" -type f \( -name '*.js' -o -name '*.css' -o -name '*.page' -o -name '*.php' \) -exec touch {} +

mkdir -p "$OUT"
TXZ="$OUT/$SLUG-$VERSION-$ARCH-1.txz"
echo "==> packaging -> $TXZ"
# --force-local: a Windows output path like "D:/..." has a colon GNU tar would
# otherwise read as host[:path]. Harmless on Linux/CI.
tar --force-local -C "$PKGROOT" -caf "$TXZ" .

echo "==> sha256"
sha256sum "$TXZ" | tee "$TXZ.sha256"
echo "done: $TXZ"
