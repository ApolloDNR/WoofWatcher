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

### Phase 1 - Phoenix Identity Lock

Goal: create no more than four Phoenix candidates and select one.

Output:

- Candidate PNGs in `artifacts/woofwatcher-mobile/assets/avatar/phoenix/candidates/`.
- Contact sheet or HTML review page if supported by the active toolchain.
- Generation log using `docs/design/pixellab/GENERATION_LOG_TEMPLATE.md`.
- One approved identity in `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/`.

Use prompt:

- `docs/design/pixellab/PHASE_1_PHOENIX_IDENTITY_PROMPT.md`

Stop for Apollo approval before animation.

### Phase 2 - Animation Proof

Goal: prove consistency on a tiny animation set before spending on the full pack.

Output:

- `idle-breathe-strip.png`
- `walk-loop-strip.png`
- `sleep-loop-strip.png`
- `comfort-loop-strip.png` or home-alone/anxious equivalent

Use prompt:

- `docs/design/pixellab/PHASE_2_ANIMATION_PROOF_PROMPT.md`

Stop for in-app inspection before full pack.

### Phase 3 - Full Animation Pack

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

