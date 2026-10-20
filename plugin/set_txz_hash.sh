#!/bin/bash
# Write the SHA256 of the built .txz into towertorch.plg's sha256 entity.
#
#   plugin/set_txz_hash.sh <VERSION>
#
# Run it after plugin/pkg_build.sh <VERSION>, together with the version bump. The
# release must carry exactly this .txz, or the plugin manager rejects the download.
set -euo pipefail

VERSION="${1:?usage: set_txz_hash.sh <VERSION>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLG="$ROOT/plugin/towertorch.plg"
TXZ="$ROOT/plugin/out/towertorch-$VERSION-x86_64-1.txz"

[ -f "$TXZ" ] || { echo "missing $TXZ, run pkg_build.sh $VERSION first" >&2; exit 1; }
grep -q '<!ENTITY sha256 ' "$PLG" || { echo "no sha256 entity in $PLG" >&2; exit 1; }

SHA=$(sha256sum "$TXZ" | cut -d' ' -f1)
sed -i "s|^\(  <!ENTITY sha256 *\)\"[0-9a-f]*\">|\1\"$SHA\">|" "$PLG"
grep -q "\"$SHA\"" "$PLG" || { echo "could not write the hash into $PLG" >&2; exit 1; }
echo "==> $(basename "$TXZ") sha256 $SHA written to $PLG"
