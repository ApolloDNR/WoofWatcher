# PixelLab Asset Production

Date: 2026-06-17

## Purpose

PixelLab is the WoofWatcher production asset path for Phoenix's real video-game care twin.

Use PixelLab for:

- Phoenix identity candidates.
- Transparent directional character sprites.
- Sprite strips for idle, walk, sleep, anxious, proud, health-watch, eat, and drink states.
- Avatar Studio template previews.
- Accessories and outfit layers.
- Dogless room backgrounds.

Do not use PixelLab secrets in the Expo app, PWA, GitHub, screenshots, or docs.

## Security Rule

The PixelLab bearer token shown in any screenshot should be treated as compromised. Rotate it before using MCP or API generation.

Local setup belongs only in:

```text
%USERPROFILE%\.codex\config.toml
```

Never commit that config file.

## MCP Setup

After rotating the token, add this shape to local Codex config, replacing the token locally only:

```toml
[mcp_servers.pixellab]
command = "npx"
args = [
  "mcp-remote@latest",
  "https://api.pixellab.ai/mcp/",
  "--transport",
  "http-only",
  "--header",
  "Authorization:${AUTH_HEADER}"
]

[mcp_servers.pixellab.env]
AUTH_HEADER = "Bearer YOUR_NEW_PIXEL_LAB_TOKEN"
```

Restart Codex after saving the config.

## First Verification Prompt

Use `docs/design/pixellab/MCP_VERIFICATION_PROMPT.md` after restart.

Important: do not generate assets during verification. First confirm the available PixelLab tools, parameters, balance, reference-image support, character tools, animation tools, and export shapes.

## Production Phases

### Phase 1 - Phoenix Main Avatar Identity Lock

Goal: create no more than four Phoenix main-avatar candidates and select one.

The target is the larger seated/expressive Neo Retro Digital Pet avatar from:

```text
docs/design/reference/woofwatcher-pixel-reference-board-05-neo-retro-digital-pet.png
docs/design/reference/woofwatcher-pixel-reference-board-06-ecosystem-supporting-pages.png
```

Board 05 is the primary Phoenix Home target. Board 06 is the ecosystem target for supporting pages: sleep/rest art, records/reports thumbnails, WoofGuide side avatar, dark-mode Phoenix room, badges, logo/app-icon head, and running footer sprite.

Do not accept tiny RPG directional sprites as the main app avatar identity. Those belong to a later movement-sprite pass after the larger expressive identity is approved.

Output:

- Candidate PNGs in `artifacts/woofwatcher-mobile/assets/avatar/phoenix/candidates/`.
- Contact sheet or HTML review page if supported by the active toolchain.
- Generation log using `docs/design/pixellab/GENERATION_LOG_TEMPLATE.md`.
- One approved main-avatar identity in `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/`.

Use prompt:

- `docs/design/pixellab/PHASE_1_PHOENIX_IDENTITY_PROMPT.md`

Stop for Apollo approval before animation.

### Phase 2 - Animation Proof

Goal: prove consistency on a tiny animation set before spending on the full pack.

Start with the approved seated/expressive main avatar:

- idle breathing / blink
- happy tail wag
- sleep/rest
- home-alone anxious glance

Only after that works, derive directional movement sprites.

The first animation proof should preserve the board 05/06 proportions and emotional read. A tiny map-sprite walk cycle is not enough to approve Phase 2.

Output:

- `idle-breathe-strip.png`
- `walk-loop-strip.png`
- `sleep-loop-strip.png`
- `comfort-loop-strip.png` or home-alone/anxious equivalent

Use prompt:

- `docs/design/pixellab/PHASE_2_ANIMATION_PROOF_PROMPT.md`

Stop for in-app inspection before full pack.

### Phase 3 - Full Animation Pack

The full pack must feel like one WoofWatcher ecosystem, not separate one-off dogs. Required still/scene variants before or alongside strips:

- large seated Home avatar
- sleep/rest avatar for Alone Time and reports
- WoofGuide side avatar
- dark-mode room avatar
- badge/logo head
- running footer sprite

Required sprite strips:

- `idle-breathe-strip.png`: 8 frames, 6 fps, loop.
- `tail-wag-strip.png`: 8 frames, 8 fps, loop.
- `ear-perk-strip.png`: 6 frames, 7 fps, one-shot cue.
- `walk-loop-strip.png`: 10 frames, 10 fps, loop.
- `eat-loop-strip.png`: 8 frames, 7 fps, loop.
- `drink-loop-strip.png`: 8 frames, 7 fps, loop.
- `sleep-loop-strip.png`: 8 frames, 5 fps, loop.
- `comfort-loop-strip.png`: 8 frames, 6 fps, loop.
- `celebrate-hop-strip.png`: 8 frames, 9 fps, one-shot reward.
- `health-watch-strip.png`: 8 frames, 5 fps, loop.

All strips must be transparent PNGs, 256px per frame slot, one row, bottom-center anchored.

### Phase 4 - Accessories

Create separate equipment layers:

- collar
- tag
- bandana
- hat
- glasses
- harness
- raincoat
- visual effects

Accessories must stay slot-based. Do not bake accessories into unrelated one-off character art.

### Phase 4A - Avatar Template Previews

The first launch preview pack is live:

- `assets/avatar/templates/shepherd/preview.png`
- `assets/avatar/templates/retriever/preview.png`
- `assets/avatar/templates/husky/preview.png`
- `assets/avatar/templates/bully/preview.png`
- `assets/avatar/templates/doodle/preview.png`
- `assets/avatar/templates/terrier/preview.png`
- `assets/avatar/templates/hound/preview.png`
- `assets/avatar/templates/dachshund/preview.png`
- `assets/avatar/templates/spaniel/preview.png`
- `assets/avatar/templates/toy/preview.png`
- `assets/avatar/templates/slender/preview.png`
- `assets/avatar/templates/mixed/preview.png`

These are transparent 85x85 PixelLab thumbnails for the Avatar Studio picker. Full template packs still need production-scale `base.png`, emotes, and sprite strips.

### Phase 4B - Avatar Template Base Art

The first production-scale template base pack is live:

- `assets/avatar/templates/shepherd/base.png` from PixelLab object `4a979556-9f07-4660-b3bf-831fed6030c0`
- `assets/avatar/templates/retriever/base.png` from PixelLab object `472ae20c-5dc4-496a-b0e7-7cafe29d147c`
- `assets/avatar/templates/husky/base.png` from PixelLab object `f8fed25f-6a1f-46fa-8d5a-5ec17fadd0f7`
- `assets/avatar/templates/doodle/base.png` from PixelLab object `f5852e83-c2d1-4630-8e97-6a4cdb02260d`

These are transparent 170x170 PixelLab character stills for the Avatar Studio preview stage. The app registers them through `avatarTemplateAssets.ts` and falls back to preview thumbnails for templates that do not have `base.png` yet.

Full template packs still need:

- `emotes/{state}.png` for each template.
- `sprites/{action}-strip.png` for each template or body-class family.
- accessory overlays that align to the same bottom-center avatar anchor.

### Phase 5 - Dogless Rooms

Create Phoenix-free backgrounds:

- `assets/avatar/rooms/phoenix-room-day.png`
- `assets/avatar/rooms/phoenix-room-night.png`
- `assets/avatar/rooms/phoenix-room-bedtime.png`
- `assets/avatar/rooms/phoenix-room-health-watch.png`
- `assets/avatar/rooms/phoenix-room-home-alone.png`

Phoenix must remain a transparent separate sprite layer.

## Registering Assets

After approved room and sprite assets exist, register them in:

```text
artifacts/woofwatcher-mobile/lib/careTwinAssets.ts
```

Do not register Phoenix sprites before a dogless room layer exists. That rule prevents duplicate Phoenix rendering over the current baked hero art.

## Verification

Run:

```text
node scripts/verify-pixellab-assets.js
```

from:

```text
artifacts/woofwatcher-mobile
```

This verifies the registered Phoenix sprite strips, dogless room files, and Avatar Studio template previews.

Use:

```text
node scripts/verify-pixellab-assets.js --allow-missing
```

when checking repo readiness before the final assets exist.

## Future In-App Scan Pipeline

Do not call PixelLab from the mobile client.

Future production flow:

```text
WoofWatcher mobile app
  -> WoofWatcher secure backend
  -> PixelLab API
  -> approved generated assets in secure storage
  -> mobile app downloads approved avatar pack
```

Secrets belong only on the backend.
