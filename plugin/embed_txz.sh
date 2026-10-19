#!/bin/bash
# Splice the built .txz into towertorch.plg's txz FILE stanza as base64,
# replacing whatever sits between its <INLINE> tags: the @@TXZ_BASE64@@
# placeholder on a fresh checkout, or a prior release's blob.
#
#   plugin/embed_txz.sh <VERSION>
#
# Run it after plugin/pkg_build.sh <VERSION>. With the blob embedded, the reinstall
# Unraid's rc.local runs at boot needs no network; the comment above the FILE
# stanza in towertorch.plg says why that matters.
#
# Type="base64" has to sit on the <FILE> tag rather than the nested <INLINE> one,
# because dynamix.plugin.manager reads $file->attributes()->Type off the FILE
# element. On <INLINE> it is ignored without an error and the raw base64 text is
# written out as the "txz", which then fails with "xz: file format not recognized".
set -euo pipefail

VERSION="${1:?usage: embed_txz.sh <VERSION>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLG="$ROOT/plugin/towertorch.plg"
TXZ="$ROOT/plugin/out/towertorch-$VERSION-x86_64-1.txz"

[ -f "$TXZ" ] || { echo "missing $TXZ, run pkg_build.sh $VERSION first" >&2; exit 1; }

FILE_LINE=$(grep -n '<FILE Name="&plgPath;/&txz;"' "$PLG" | head -1 | cut -d: -f1)
[ -n "$FILE_LINE" ] || { echo "no txz FILE stanza found in $PLG" >&2; exit 1; }
grep -q 'Type="base64"' <(sed -n "${FILE_LINE}p" "$PLG") || { echo "txz FILE stanza in $PLG needs Type=\"base64\" on <FILE>, not on <INLINE>" >&2; exit 1; }
OPEN=$(awk -v start="$FILE_LINE" 'NR>=start && /<INLINE>/{print NR; exit}' "$PLG")
[ -n "$OPEN" ] || { echo "no <INLINE> tag found after the txz FILE stanza (line $FILE_LINE) in $PLG" >&2; exit 1; }
CLOSE=$(awk -v start="$OPEN" 'NR>start && /<\/INLINE>/{print NR; exit}' "$PLG")
[ -n "$CLOSE" ] || { echo "no matching </INLINE> found after line $OPEN in $PLG" >&2; exit 1; }

echo "==> encoding $(basename "$TXZ") ($(wc -c < "$TXZ") bytes) as base64"
TMP="$(mktemp)"
head -n "$OPEN" "$PLG" > "$TMP"
base64 -w0 "$TXZ" >> "$TMP"
echo >> "$TMP"
tail -n "+$CLOSE" "$PLG" >> "$TMP"
mv "$TMP" "$PLG"

echo "==> decoding the embedded blob back out to compare sha256"
DECODED="$(mktemp)"
NEW_OPEN=$(awk -v start="$FILE_LINE" 'NR>=start && /<INLINE>/{print NR; exit}' "$PLG")
NEW_CLOSE=$(awk -v start="$NEW_OPEN" 'NR>start && /<\/INLINE>/{print NR; exit}' "$PLG")
sed -n "$((NEW_OPEN+1)),$((NEW_CLOSE-1))p" "$PLG" | base64 -d > "$DECODED"
SRC_SHA=$(sha256sum "$TXZ" | cut -d' ' -f1)
DEC_SHA=$(sha256sum "$DECODED" | cut -d' ' -f1)
rm -f "$DECODED"
if [ "$SRC_SHA" != "$DEC_SHA" ]; then
  echo "embedded blob does not decode back to the built txz ($SRC_SHA vs $DEC_SHA)" >&2
  exit 1
fi
echo "==> embedded and verified: $(basename "$TXZ") -> $PLG (sha256 $SRC_SHA)"
echo "==> $(wc -c < "$PLG") bytes total"
