#!/usr/bin/env bash
# make_icons.sh — build CR9 PWA icons from SVG sources using macOS qlmanage + sips.
# Tools required: qlmanage (built-in), sips (built-in).
# No external dependencies (Pillow/ImageMagick/rsvg-convert not required).

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
ICONS="$DIR/icons"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

SRC="$ICONS/icon.svg"
SRC_MASK="$ICONS/icon-maskable.svg"

if [[ ! -f "$SRC" || ! -f "$SRC_MASK" ]]; then
  echo "Missing SVG sources in $ICONS" >&2
  exit 1
fi

render() {
  local svg="$1" out="$2" size="$3"
  # qlmanage renders at fixed size; we render at 1024 then resize with sips for crispness.
  qlmanage -t -s 1024 -o "$TMP" "$svg" >/dev/null 2>&1
  local produced="$TMP/$(basename "$svg").png"
  if [[ ! -f "$produced" ]]; then
    echo "qlmanage failed for $svg" >&2
    exit 1
  fi
  # Resize to target with sips (high-quality Lanczos-ish).
  sips -Z "$size" "$produced" --out "$out" >/dev/null
  # Also force exact square (sips -Z keeps aspect; our svgs are square already).
  echo "wrote $out ($size x $size)"
}

render "$SRC"      "$ICONS/icon-180.png"          180
render "$SRC"      "$ICONS/icon-192.png"          192
render "$SRC"      "$ICONS/icon-512.png"          512
render "$SRC_MASK" "$ICONS/icon-512-maskable.png" 512

echo "Done."
ls -la "$ICONS"
