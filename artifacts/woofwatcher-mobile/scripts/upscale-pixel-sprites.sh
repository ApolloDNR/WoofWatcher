#!/usr/bin/env bash
# Generates @2x / @3x density variants for the pixel-art sprite assets using
# nearest-neighbor upscaling. Metro's density-suffix resolution then serves
# the sharpest variant per device pixel ratio, so high-DPI phones downscale
# a supersampled source instead of bilinearly upscaling the 1x art (which is
# what made the care twin look soft/mushy on device).
#
# Idempotent: re-running overwrites the generated variants. Base 1x files are
# never touched. Requires ImageMagick (magick).
set -euo pipefail

cd "$(dirname "$0")/.."

upscale() {
  local src="$1"
  local base="${src%.png}"
  magick "$src" -filter point -resize 200% "${base}@2x.png"
  magick "$src" -filter point -resize 300% "${base}@3x.png"
  echo "upscaled: $src"
}

# Storybook shepherd set: action strips + stills used by the live care twin.
for f in assets/avatar/phoenix/storybook/*.png; do
  case "$f" in
    *@2x.png|*@3x.png) continue ;;
  esac
  upscale "$f"
done

# Breed template packs: idle/walk strips used for non-shepherd avatars.
for f in assets/avatar/templates/*/sprites/*-strip.png; do
  case "$f" in
    *@2x.png|*@3x.png) continue ;;
  esac
  upscale "$f"
done

# Layered template art (170px base poses, emote stills, accessory overlays)
# renders into the same 118-248pt pose boxes as the sprites, so it needs the
# same supersampled variants to stay crisp on DPR2-3 phones.
for f in assets/avatar/templates/*/base.png \
  assets/avatar/templates/*/emotes/*.png \
  assets/avatar/templates/*/accessories/*.png; do
  [ -e "$f" ] || continue
  case "$f" in
    *@2x.png|*@3x.png) continue ;;
  esac
  upscale "$f"
done

echo "done"
