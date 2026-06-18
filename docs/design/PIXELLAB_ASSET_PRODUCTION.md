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

These are transparent 85x85 PixelLab thumbnails for the Avatar Studio picker. Full template packs still need emotes and sprite strips.

### Phase 4B - Avatar Template Base Art

The full first-pass production-scale template base pack is live:

- `assets/avatar/templates/shepherd/base.png` from PixelLab object `4a979556-9f07-4660-b3bf-831fed6030c0`
- `assets/avatar/templates/retriever/base.png` from PixelLab object `472ae20c-5dc4-496a-b0e7-7cafe29d147c`
- `assets/avatar/templates/husky/base.png` from PixelLab object `f8fed25f-6a1f-46fa-8d5a-5ec17fadd0f7`
- `assets/avatar/templates/bully/base.png` from PixelLab object `25c648c4-6e26-4c8e-8b65-6fb94e7c10b4`
- `assets/avatar/templates/doodle/base.png` from PixelLab object `f5852e83-c2d1-4630-8e97-6a4cdb02260d`
- `assets/avatar/templates/terrier/base.png` from PixelLab object `65f0ffbb-e811-49d4-be6d-c8f2b2abf0ce`
- `assets/avatar/templates/hound/base.png` from PixelLab object `7f8a712d-c65c-4d1c-835a-5f79b5500ff7`
- `assets/avatar/templates/dachshund/base.png` from PixelLab object `8fbb402b-579d-478c-bcad-fd21e61cf530`
- `assets/avatar/templates/spaniel/base.png` from PixelLab object `b85934b2-d1cc-4b89-b4e9-0342520ec73a`
- `assets/avatar/templates/toy/base.png` from PixelLab object `995d0da0-6469-42ea-9855-7caed01584c2`
- `assets/avatar/templates/slender/base.png` from PixelLab object `efa34067-c258-4105-9da4-73d0907f36b5`
- `assets/avatar/templates/mixed/base.png` from PixelLab object `c63ef688-cc17-4f7f-94d2-8504606213b5`

These are transparent 170x170 PixelLab character stills for the Avatar Studio preview stage. The app registers them through `avatarTemplateAssets.ts`; every launch template now has a production-scale base still.

Full template packs still need:

- `emotes/{state}.png` for each template.
- `sprites/{action}-strip.png` for each template or body-class family.
- accessory overlays that align to the same bottom-center avatar anchor.

### Phase 4C - Phoenix Emote Pack

The first Phoenix/Shepherd emote pack is live:

- `assets/avatar/phoenix/approved/emotes/happy.png` from the approved proud/happy state.
- `assets/avatar/phoenix/approved/emotes/calm.png` from PixelLab object `f690d72e-5efb-4931-ad76-d2f4a739ff87`.
- `assets/avatar/phoenix/approved/emotes/excited.png` from PixelLab object `bfe8bee5-5fa8-415c-b63e-2d71faa9725e`.
- `assets/avatar/phoenix/approved/emotes/bored.png` from PixelLab object `b74aea82-806a-410c-acc5-1247cbde970c`.
- `assets/avatar/phoenix/approved/emotes/hungry.png` from PixelLab object `2f1a7800-0414-44e7-94d0-fb986ca22343`.
- `assets/avatar/phoenix/approved/emotes/anxious.png` from the approved home-alone/anxious state.
- `assets/avatar/phoenix/approved/emotes/sleepy.png` from the approved sleep/rest state.
- `assets/avatar/phoenix/approved/emotes/proud.png` from the approved proud/happy state.
- `assets/avatar/phoenix/approved/emotes/home-alone.png` from the approved home-alone/anxious state.
- `assets/avatar/phoenix/approved/emotes/not-feeling-well.png` from PixelLab object `39e8b2d9-da66-496b-83c6-8755bcad7d23`.

These are transparent 170x170 PixelLab Phoenix states for the Avatar Studio Mood set. The app registers them through `avatarEmoteAssets.ts`; `/portrait` now uses the selected emote as the large hero preview when the Phoenix/Shepherd pack is active.

Remaining emote work:

- Generate starter emote packs for non-Phoenix launch templates.
- Decide whether non-Shepherd breeds share body-class emotes or require one pack per template.
- Add matching short animation strips after still-state approval.

### Phase 4D - Avatar Accessory Inventory Pack

The first PixelLab accessory inventory pack is live:

- `assets/avatar/accessories/forest-bandana.png` from PixelLab object `fa81f98c-0cad-4df2-9671-4b5be32c6f34`.
- `assets/avatar/accessories/navy-collar.png` from PixelLab object `670d848c-78ef-4150-9c91-0b893bc071e0`.
- `assets/avatar/accessories/copper-collar.png` from PixelLab object `63af7c6f-36df-4290-ac45-ac714f026b3b`.
- `assets/avatar/accessories/heart-tag.png` from PixelLab object `29b375ca-5fc6-42d6-a3ec-26e618204c6a`.
- `assets/avatar/accessories/trail-bandana.png` from PixelLab object `a54244ac-76c8-49c2-82bf-949aaa9648c4`.
- `assets/avatar/accessories/birthday-hat.png` from PixelLab object `2a22670b-2736-4412-b2ac-b3ee3a3238a6`.
- `assets/avatar/accessories/sleepy-mask.png` from PixelLab object `e106649d-5e30-4be1-ab3d-9f49e3b9ff3c`.
- `assets/avatar/accessories/training-vest.png` from PixelLab object `5b4248e7-f293-42ad-84e2-c4827e064f43`.
- `assets/avatar/accessories/cozy-bed.png` from PixelLab object `698b7c8c-89b1-411e-8314-29e14701c453`.
- `assets/avatar/accessories/heart-sparkles.png` from PixelLab object `e3790a9a-a5be-4ba2-b60d-d13970624b23`.

These are transparent 85x85 PixelLab inventory icons for the Avatar Studio Customize tab. The app registers them through `avatarAccessoryAssets.ts`; `/portrait` now renders accessory art in the slot grid and hero equipped-loadout rail.

Remaining accessory work:

- Generate true 170x170 transparent overlay layers that align with the bottom-center avatar anchor.
- Decide which accessories are baked into Phoenix-specific sprite packs versus drawn as runtime overlays.
- Add per-template fit checks for long-body, small, compact, and floppy-ear templates.

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

This verifies the registered Phoenix sprite strips, dogless room files, Avatar Studio template previews, template base stills, Phoenix emote stills, and Avatar Studio accessory inventory icons.

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
