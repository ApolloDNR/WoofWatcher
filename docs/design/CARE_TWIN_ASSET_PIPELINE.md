# Care Twin Asset Pipeline

Date: 2026-06-16

## Goal

Make Phoenix feel like a real video-game care twin without lowering visual quality.

The app now has the runtime for layered sprite animation, but layered rendering stays disabled until both asset groups exist:

1. A dogless room background.
2. Transparent Phoenix sprite strips.

This prevents the duplicate-avatar look.

## What Apollo Needs To Provide Or Generate

PixelLab is now the preferred production path for the assets below. See:

`docs/design/PIXELLAB_ASSET_PRODUCTION.md`

### 1. Approved Phoenix Seed Frame

Pick one in-game Phoenix frame that is final enough to become the identity lock:

- correct German Shepherd/Belgian Shepherd feel
- correct face
- green bandana/collar details
- same neo-retro pixel style as the mockups
- transparent background
- no scenery
- full body visible
- readable at phone size

Do not generate every animation from different prompts. Start from this one approved frame.

### 2. Dogless Room Background

Create the same room/patio scene without Phoenix baked into it.

Needed later in code:

- `assets/avatar/rooms/phoenix-room-day.png`
- optional future states:
  - `phoenix-room-night.png`
  - `phoenix-room-bedtime.png`
  - `phoenix-room-health-watch.png`

The room should match the current board style: warm interior, window/patio depth, cozy objects, strong pixel charm, no heavy UI text inside the art.

### 3. Phoenix Sprite Strips

Put final strips in:

`artifacts/woofwatcher-mobile/assets/avatar/phoenix/`

Required files:

- `idle-breathe-strip.png`
- `tail-wag-strip.png`
- `ear-perk-strip.png`
- `walk-loop-strip.png`
- `eat-loop-strip.png`
- `drink-loop-strip.png`
- `sleep-loop-strip.png`
- `comfort-loop-strip.png`
- `celebrate-hop-strip.png`
- `health-watch-strip.png`

Rules:

- transparent PNG
- one strip per action
- each frame slot is 256px by 256px
- align Phoenix bottom-center in every frame
- same character, same palette, same bandana, same body proportions
- no background, text, labels, scenery, border, or poster composition
- generate each full strip at once, not frame-by-frame

## How To Ask Fable, Replit, Or An Artist

For PixelLab-specific generation prompts, use:

- `docs/design/pixellab/PHASE_1_PHOENIX_IDENTITY_PROMPT.md`
- `docs/design/pixellab/PHASE_2_ANIMATION_PROOF_PROMPT.md`
- `docs/design/pixellab/GENERATION_LOG_TEMPLATE.md`

Use this prompt:

```text
Create a production pixel-art sprite strip for WoofWatcher's Phoenix care twin.

Use the provided approved Phoenix seed frame as the character identity lock.
Preserve the same dog, same facing direction, same silhouette, same face, same green bandana, same palette, and same proportions.

Output one transparent PNG sprite strip.
Frame slots: 256px by 256px.
Anchor: bottom-center in every frame.
No scenery, no labels, no poster layout, no background.
Style: premium neo-retro pixel care app, crisp pixel clusters, professional mobile game asset.

Action: [ACTION NAME]
Frame count: [FRAME COUNT]
Loop: [YES/NO]
```

Replace `[ACTION NAME]` and `[FRAME COUNT]` using the manifest list above.

## Code Registration

Once final assets exist, register them in:

`artifacts/woofwatcher-mobile/lib/careTwinAssets.ts`

Example:

```ts
"tail-wag": {
  source: require("@/assets/avatar/phoenix/tail-wag-strip.png"),
  columns: 8,
  rows: 1,
  frameWidth: 256,
  frameHeight: 256,
},
```

Also register dogless room assets in the same file.

Do not register sprite strips before the dogless room exists. The runtime intentionally requires both pieces before it renders layered Phoenix.

## Quality Gate

Run the PixelLab asset verifier before registering final assets:

```text
cd artifacts/woofwatcher-mobile
node scripts/verify-pixellab-assets.js
```

Before approving assets:

- Phoenix does not change identity between frames.
- Body size does not drift.
- Paws stay anchored unless the action requires movement.
- Tail, ears, eating, sleeping, or walking action reads at phone size.
- Transparent background is preserved.
- No duplicate Phoenix appears in the Home room.
- Expo web export and focused tests still pass.
