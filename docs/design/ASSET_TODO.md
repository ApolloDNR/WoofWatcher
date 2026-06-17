# Asset TODO

Date: 2026-06-14

## Locked Reference Boards

Apollo's current selected UI references are versioned here:

- `docs/design/reference/woofwatcher-pixel-reference-board-01.png`
- `docs/design/reference/woofwatcher-pixel-reference-board-02.png`
- `docs/design/reference/woofwatcher-pixel-reference-board-03.png`
- `docs/design/reference/woofwatcher-pixel-reference-board-04.png`

Use board 04 as the primary shell/layout target and boards 02/03 as the component vocabulary target.

## Needed For v1.5

- Final Phoenix pixel avatar base.
- Avatar states:
  - Happy
  - Calm
  - Excited
  - Sleepy
  - Anxious
  - Bored
  - Hungry
  - Proud
  - Home Alone
  - Not Feeling Well
- Pixel room backgrounds for Home and Avatar Studio.
- Pixel icon set for navigation and quick log actions.
- Status meters and badge sprites.
- Speech bubble and emote sprites.
- Achievement badge set.
- Desktop navy sidebar assets.
- Mobile navy bottom navigation assets.
- Segmented retro HUD meter sprites or CSS equivalents.
- Pixel speech bubble variants.
- Pixel scenic room/patio backgrounds matching the board style.

## Future Animation States

- Happy tail wag.
- Excited bounce.
- Sleepy zzz.
- Anxious ears/glance.
- Hungry bowl look.
- Proud sparkle.
- Home-alone waiting.
- Not-feeling-well low posture.

## Current Code Slots Ready For Final Assets

- Phoenix Home: `LivingPhoenixRoom` now has a Reanimated care-twin runtime with room-zone mapping, breathing, state cues, mood patch, reaction bursts, speech bubble, and HUD overlays.
- Care Twin Engine: `artifacts/woofwatcher-mobile/lib/avatarLifeEngine.ts` now exposes `CARE_TWIN_SPRITE_MANIFEST`, `deriveCareTwinScene`, scene phases, priority needs, sprite actions, HUD tones, and tap verbs.
- Layered sprite runtime: `SpriteSheetPlayer` can crop and animate registered sprite strips, while `careTwinAssets.ts` keeps layered rendering disabled until both transparent Phoenix strips and dogless room layers are registered.
- Health/Bile Watch: board metric tiles and Bile Watch status pill.
- Log, Plans, More, Records, WoofGuide, Avatar Studio: shared board route header slots ready for final icon/animation polish.
- Avatar Studio: V1 template/config system is wired with scan-assisted mock suggestions, editable coat/face/accessory slots, emote preview, and local save. It still needs final template art and sprite/emote assets.

Detailed handoff: `docs/design/CARE_TWIN_ASSET_PIPELINE.md`.

Avatar Studio implementation notes: `docs/design/AVATAR_STUDIO_IMPLEMENTATION.md`.

## Avatar Studio Template Assets Needed

Start with a polished Phoenix/Shepherd pack, then expand to the launch template set.

Initial template previews:

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

Initial accessory slots:

- neck: forest bandana, navy collar, copper collar, heart tag, trail bandana.
- head: birthday hat.
- face: sleepy mask.
- body: training vest.
- room: cozy bed.
- fx: heart sparkles.

Do not generate every template as one-off unrelated art. Each template needs the same visual language, bottom-center anchor, and accessory slot logic.

## Production Sprite Manifest Needed Next

Create these as transparent PNG sprite strips, each frame in a 256px slot, aligned bottom-center, same Phoenix silhouette/palette/bandana/proportions, no scenery, no labels, no poster composition:

- `assets/avatar/phoenix/idle-breathe-strip.png`: 8 frames, 6 fps, loop.
- `assets/avatar/phoenix/tail-wag-strip.png`: 8 frames, 8 fps, loop.
- `assets/avatar/phoenix/ear-perk-strip.png`: 6 frames, 7 fps, one-shot cue.
- `assets/avatar/phoenix/walk-loop-strip.png`: 10 frames, 10 fps, loop.
- `assets/avatar/phoenix/eat-loop-strip.png`: 8 frames, 7 fps, loop.
- `assets/avatar/phoenix/drink-loop-strip.png`: 8 frames, 7 fps, loop.
- `assets/avatar/phoenix/sleep-loop-strip.png`: 8 frames, 5 fps, loop.
- `assets/avatar/phoenix/comfort-loop-strip.png`: 8 frames, 6 fps, loop.
- `assets/avatar/phoenix/celebrate-hop-strip.png`: 8 frames, 9 fps, one-shot reward.
- `assets/avatar/phoenix/health-watch-strip.png`: 8 frames, 5 fps, loop.

Sprite pipeline rule: start from one approved in-game Phoenix seed frame, generate each full strip at once, normalize with one shared scale, preserve transparency, and inspect in-engine before approving.

## Asset Limitation To Solve Next

The current Home runtime deliberately uses the board-accurate pixel room as one animated stage so the app does not show an ugly second pasted-on Phoenix. For the final video-game feel, the app needs production assets with separated layers:

- Dogless room background.
- Transparent Phoenix base sprite.
- Phoenix sprite loops for idle breathing, happy tail wag, walk, eating, drinking, sleeping, anxious glance, low-energy/health watch, proud celebration, and home-alone waiting.
- Optional foreground props such as bowl, rug, bed, window, door, toy, and sparkle layers.

Once those assets exist, `avatarLifeEngine.ts` can keep driving the state decisions while `LivingPhoenixRoom.tsx` swaps from single-stage animation to true layered sprite animation.

The runtime swap is already coded behind an asset-readiness gate. Register assets in `artifacts/woofwatcher-mobile/lib/careTwinAssets.ts` only after both a dogless room layer and matching sprite strips are ready.

## Source Control Rule

Mirror final selected screenshots or source references into `docs/design/reference/` when Apollo provides them. Do not rely only on expiring chat image attachments.
