# Care Twin Asset Pipeline

Date: 2026-06-16

## Live PixelLab Production Status - 2026-06-18

PixelLab MCP is connected in Codex and Phase 1 candidate production has started.

Current artifacts:

- `docs/design/pixellab/PHOENIX_GENERATION_LOG_2026-06-18.md`
- `docs/design/pixellab/phoenix-identity-review-2026-06-18.html`
- `artifacts/woofwatcher-mobile/assets/avatar/phoenix/candidates/candidate-a-*.png`
- `artifacts/woofwatcher-mobile/assets/avatar/phoenix/candidates/candidate-b-*.png`
- `artifacts/woofwatcher-mobile/assets/avatar/phoenix/candidates/candidate-c-*.png`

Candidate D is now archived as a functional directional movement seed only. It is not the approved main-avatar style because Apollo wants the richer seated Neo Retro Digital Pet look from:

- `docs/design/reference/woofwatcher-pixel-reference-board-05-neo-retro-digital-pet.png`
- `docs/design/reference/woofwatcher-pixel-reference-board-06-ecosystem-supporting-pages.png`

The next generation pass did target the larger seated care-twin avatar and supporting ecosystem family first. Directional RPG-style sprites should remain secondary and should be derived later from the approved main avatar, not used as the main identity.

PixelLab balance is no longer blocked:

- Apollo added a PixelLab subscription on 2026-06-18.
- PixelLab reported 1,856 generations remaining after the v2 seed, state pack, idle animation, tail-wag animation, sleep-loop animation, and first dogless room layer. Additional action strips were generated later in the same 2026-06-18 production pass.
- Approved v2 seed object: `4f318d58-7166-4b0a-b202-2896eed1e0dc`.
- Current next blocker: final visual approval and native runtime QA, not credits, MCP access, room file presence, or sprite file presence.

## Goal

Make Phoenix feel like a real video-game care twin without lowering visual quality.

The app now has the runtime for layered sprite animation and the first complete registered asset group:

1. Dogless room backgrounds: `phoenix-room-day.png`, `phoenix-room-night.png`, `phoenix-room-bedtime.png`, `phoenix-room-health-watch.png`, and `phoenix-room-home-alone.png`.
2. Transparent Phoenix sprite strips: `idle-breathe-strip.png`, `tail-wag-strip.png`, `ear-perk-strip.png`, `walk-loop-strip.png`, `eat-loop-strip.png`, `drink-loop-strip.png`, `sleep-loop-strip.png`, `comfort-loop-strip.png`, `celebrate-hop-strip.png`, and `health-watch-strip.png`.

This prevents the duplicate-avatar look and lets Home render Phoenix as the animated character layer for every current care-twin action. First-pass derived room variants are runtime-ready, but final illustrated variants should still replace them before store-quality launch.

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

The approved frame must look like it belongs in boards 05/06: larger, expressive, premium neo-retro digital pet proportions with Phoenix's black saddle, dark mask, sage bandana, collar, and copper heart tag clearly readable.

Required supporting family after the identity lock:

- seated Home avatar
- sleep/rest avatar
- WoofGuide side avatar
- dark-mode room avatar
- badge/logo head
- running footer sprite

### 2. Dogless Room Background

Create the same room/patio scene without Phoenix baked into it.

Needed later in code:

- `assets/avatar/rooms/phoenix-room-day.png`
  - `phoenix-room-night.png`
  - `phoenix-room-bedtime.png`
  - `phoenix-room-health-watch.png`
  - `phoenix-room-home-alone.png`

The room should match the current board style: warm interior, window/patio depth, cozy objects, strong pixel charm, no heavy UI text inside the art.

Create at least a day room and dark/night room so the Home and dark-mode/supporting-page looks can share the same care-twin identity without duplicate dogs.

2026-06-19 room status: day is live, and PixelLab final-candidate night,
health-watch, and home-alone rooms are now wired as dogless 800x600 runtime
layers. Bedtime remains the only first-pass derived room variant and needs a
clean final PixelLab/Figma-quality replacement before store polish. Rejected
PixelLab attempts included isometric drift, baked-in dogs, visible text, and
watermark-like marks; do not register future rooms until they pass those visual
checks.

### 3. Phoenix Sprite Strips

Put final strips in:

`artifacts/woofwatcher-mobile/assets/avatar/phoenix/`

Required files:

- `idle-breathe-strip.png` - live
- `tail-wag-strip.png` - live
- `ear-perk-strip.png` - live
- `walk-loop-strip.png` - live from the v2 standing walk source for a stronger walk read
- `eat-loop-strip.png` - live
- `drink-loop-strip.png` - live
- `sleep-loop-strip.png` - live
- `comfort-loop-strip.png` - live
- `celebrate-hop-strip.png` - live
- `health-watch-strip.png` - live

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

Do not register future sprite strips before a matching dogless room exists. The runtime intentionally requires both pieces before it renders layered Phoenix. As of the 2026-06-18 pass, `careTwinAssets.ts` has registered all current sprite actions and routes sleep, comfort, health-watch, anxious, and normal states to appropriate room variants.

## Local Asset Scripts

- `npm run build:pixellab-sprite-strip` downloads a PixelLab `{i}.png` frame URL template and stitches selected frames into a fixed 256px-slot horizontal strip.
- `npm run build:pixellab-room-variants` derives first-pass room variants from the approved dogless day room. Use it only as a fallback; final room art should come from visually accepted PixelLab/Figma-quality sources.
- `npm run verify:pixellab-assets` checks sprite strip dimensions and required room files.

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
