# Asset TODO

Date: 2026-06-14

## PixelLab Phase 1 Run - 2026-06-18

PixelLab MCP is connected. The first Phase 1 Phoenix identity attempt produced directional candidates A-D, but Apollo rejected that style for the main avatar target.

Candidate files are saved in:

- `artifacts/woofwatcher-mobile/assets/avatar/phoenix/candidates/`

Review board:

- `docs/design/pixellab/phoenix-identity-review-2026-06-18.html`

Generation log:

- `docs/design/pixellab/PHOENIX_GENERATION_LOG_2026-06-18.md`

Candidate IDs:

- Candidate A: `43cde13a-7335-4ad4-9e54-52ca652f6608`
- Candidate B: `c029278c-84e3-46a6-a485-1d4f38da6153`
- Candidate C: `9a0f891f-77c3-4c4c-97f0-8d3569a2f415`
- Candidate D: `f0c6169b-88c0-4428-9089-31c0565c4129` (refinement of A)

Current design read: Candidate D is better than A/B/C as a small directional sprite, but it is not close enough to the boards 05/06 main avatar and ecosystem direction. Treat it as archived movement-sprite exploration, not the final Phoenix avatar.

V2 update: Apollo added a PixelLab subscription and the new selected main-avatar seed is `phoenix-main-avatar-v2.png`, generated from PixelLab object `4f318d58-7166-4b0a-b202-2896eed1e0dc`. The app now uses the v2 approved still pack for default avatar surfaces and has a full registered layered sprite manifest plus first-pass dogless room variants.

Subscription seed strip update: the PixelLab character `f0c6169b-88c0-4428-9089-31c0565c4129` now has verified local animation seed strips at `assets/avatar/phoenix/pixellab-idle-south-strip.png` and `assets/avatar/phoenix/pixellab-walk-south-strip.png`. These are movement-review assets, not the approved Home replacement yet.

## Locked Reference Boards

Apollo's current selected UI references are versioned here:

- `docs/design/reference/woofwatcher-pixel-reference-board-01.png`
- `docs/design/reference/woofwatcher-pixel-reference-board-02.png`
- `docs/design/reference/woofwatcher-pixel-reference-board-03.png`
- `docs/design/reference/woofwatcher-pixel-reference-board-04.png`
- `docs/design/reference/woofwatcher-pixel-reference-board-05-neo-retro-digital-pet.png`
- `docs/design/reference/woofwatcher-pixel-reference-board-06-ecosystem-supporting-pages.png`

Use board 05 as the primary Phoenix Home/avatar target and board 06 as the supporting-pages ecosystem target. Use board 04 as the primary shell/layout target and boards 02/03 as the component vocabulary target.

## Needed For v1.5

- Final Phoenix pixel avatar base. Status: v2 main seed exists and is wired into app defaults.
- Live layered Home room. Status: `assets/avatar/rooms/phoenix-room-day.png` exists, and first-pass dogless variants exist for night, bedtime, health-watch, and home-alone.
- Production Phoenix asset family matching boards 05/06:
  - large seated Home avatar - v2 live
  - sleep/rest avatar - v2 live
  - WoofGuide side avatar - v2 live
  - dark-mode room avatar
  - badge/logo head - v2 live
  - running footer sprite
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
- Pixel room backgrounds for Home and Avatar Studio. Status: day dogless Home room live; first-pass night, bedtime, health-watch, and home-alone variants live; final illustrated variants and Avatar Studio-specific room art still needed.
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
- Layered sprite runtime: `SpriteSheetPlayer` can crop and animate registered sprite strips. `careTwinAssets.ts` now registers idle-breathe, tail-wag, ear-perk, walk, eat, drink, sleep, comfort, celebrate, health-watch, the day room, and first-pass night/bedtime/health/home-alone room variants.
- Health/Bile Watch: board metric tiles and Bile Watch status pill.
- Log, Plans, More, Records, WoofGuide, Avatar Studio: shared board route header slots ready for final icon/animation polish.
- Avatar Studio: V1 template/config system is wired with scan-assisted mock suggestions, editable coat/face/accessory slots, emote preview, local save, crisp pixel rendering, and the live layered `LivingPhoenixRoom` Studio preview. It still needs final breed template art, overlay-aligned accessory sprites, and stronger prop-specific emote assets.
- Pixel placeholder pack: `assets/avatar/pixel/` is now fallback/reference only.
- PixelLab v2 approved pack: `assets/avatar/phoenix/approved/` is the active default app avatar set.
- PixelLab v2 live sprite strips: `assets/avatar/phoenix/idle-breathe-strip.png`, `tail-wag-strip.png`, `ear-perk-strip.png`, `walk-loop-strip.png`, `eat-loop-strip.png`, `drink-loop-strip.png`, `sleep-loop-strip.png`, `comfort-loop-strip.png`, `celebrate-hop-strip.png`, and `health-watch-strip.png`.
- PixelLab Candidate D pack: `assets/avatar/phoenix/approved/` is archived as directional movement exploration only.

Detailed handoff: `docs/design/CARE_TWIN_ASSET_PIPELINE.md`.

PixelLab production handoff: `docs/design/PIXELLAB_ASSET_PRODUCTION.md`.

Avatar Studio implementation notes: `docs/design/AVATAR_STUDIO_IMPLEMENTATION.md`.

## Avatar Studio Template Assets

Start with a polished Phoenix/Shepherd pack, then expand to the launch template set.

Initial template previews are live as a PixelLab-generated 85x85 launch thumbnail pack, registered through `artifacts/woofwatcher-mobile/lib/avatarTemplateAssets.ts` and rendered in `/portrait`:

- `assets/avatar/templates/shepherd/preview.png` - live.
- `assets/avatar/templates/retriever/preview.png` - live.
- `assets/avatar/templates/husky/preview.png` - live.
- `assets/avatar/templates/bully/preview.png` - live.
- `assets/avatar/templates/doodle/preview.png` - live.
- `assets/avatar/templates/terrier/preview.png` - live.
- `assets/avatar/templates/hound/preview.png` - live.
- `assets/avatar/templates/dachshund/preview.png` - live.
- `assets/avatar/templates/spaniel/preview.png` - live.
- `assets/avatar/templates/toy/preview.png` - live.
- `assets/avatar/templates/slender/preview.png` - live.
- `assets/avatar/templates/mixed/preview.png` - live.

Initial production-scale base stills are live as a PixelLab-generated 170x170 base pack, registered through `avatarTemplateAssets.ts`, verified by `verify-pixellab-assets.js`, and used by `/portrait` when the selected template has base art:

- `assets/avatar/templates/shepherd/base.png` - live.
- `assets/avatar/templates/retriever/base.png` - live.
- `assets/avatar/templates/husky/base.png` - live.
- `assets/avatar/templates/bully/base.png` - live.
- `assets/avatar/templates/doodle/base.png` - live.
- `assets/avatar/templates/terrier/base.png` - live.
- `assets/avatar/templates/hound/base.png` - live.
- `assets/avatar/templates/dachshund/base.png` - live.
- `assets/avatar/templates/spaniel/base.png` - live.
- `assets/avatar/templates/toy/base.png` - live.
- `assets/avatar/templates/slender/base.png` - live.
- `assets/avatar/templates/mixed/base.png` - live.

Initial Phoenix/Shepherd emote stills are live as a PixelLab-generated and normalized 170x170 mood pack, registered through `avatarEmoteAssets.ts`, verified by `verify-pixellab-assets.js`, and rendered in the `/portrait` Mood set preview:

- `assets/avatar/phoenix/approved/emotes/happy.png` - live.
- `assets/avatar/phoenix/approved/emotes/calm.png` - live.
- `assets/avatar/phoenix/approved/emotes/excited.png` - live.
- `assets/avatar/phoenix/approved/emotes/bored.png` - live.
- `assets/avatar/phoenix/approved/emotes/hungry.png` - live.
- `assets/avatar/phoenix/approved/emotes/anxious.png` - live.
- `assets/avatar/phoenix/approved/emotes/sleepy.png` - live.
- `assets/avatar/phoenix/approved/emotes/proud.png` - live.
- `assets/avatar/phoenix/approved/emotes/home-alone.png` - live.
- `assets/avatar/phoenix/approved/emotes/not-feeling-well.png` - live.

Initial Retriever emote stills are live as the first non-Phoenix 170x170 mood pack, registered through `avatarEmoteAssets.ts`, verified by `verify-pixellab-assets.js`, and rendered in `/portrait` when the selected template recommends `retriever-starter`:

- `assets/avatar/templates/retriever/emotes/happy.png` - live.
- `assets/avatar/templates/retriever/emotes/calm.png` - live.
- `assets/avatar/templates/retriever/emotes/excited.png` - live.
- `assets/avatar/templates/retriever/emotes/bored.png` - live.
- `assets/avatar/templates/retriever/emotes/hungry.png` - live.
- `assets/avatar/templates/retriever/emotes/anxious.png` - live.
- `assets/avatar/templates/retriever/emotes/sleepy.png` - live.
- `assets/avatar/templates/retriever/emotes/proud.png` - live.
- `assets/avatar/templates/retriever/emotes/home-alone.png` - live.
- `assets/avatar/templates/retriever/emotes/not-feeling-well.png` - live.

Initial Husky/Spitz emote stills are live as the first spitz/working-body 170x170 mood pack, registered through `avatarEmoteAssets.ts`, verified by `verify-pixellab-assets.js`, and rendered in `/portrait` when the selected template recommends `husky-starter`:

- `assets/avatar/templates/husky/emotes/happy.png` - live.
- `assets/avatar/templates/husky/emotes/calm.png` - live.
- `assets/avatar/templates/husky/emotes/excited.png` - live.
- `assets/avatar/templates/husky/emotes/bored.png` - live.
- `assets/avatar/templates/husky/emotes/hungry.png` - live.
- `assets/avatar/templates/husky/emotes/anxious.png` - live.
- `assets/avatar/templates/husky/emotes/sleepy.png` - live.
- `assets/avatar/templates/husky/emotes/proud.png` - live.
- `assets/avatar/templates/husky/emotes/home-alone.png` - live.
- `assets/avatar/templates/husky/emotes/not-feeling-well.png` - live.

Still needed for a full App Store avatar system:

- emote stills for the remaining unfinished launch templates and reusable body classes.
- template-specific sprite strips for major body classes.

Initial accessory slots:

- neck: forest bandana, navy collar, copper collar, heart tag, trail bandana. Status: transparent PixelLab 85x85 inventory icons live.
- head: birthday hat. Status: transparent PixelLab 85x85 inventory icon live.
- face: sleepy mask. Status: transparent PixelLab 85x85 inventory icon live.
- body: training vest. Status: transparent PixelLab 85x85 inventory icon live.
- room: cozy bed. Status: transparent PixelLab 85x85 inventory icon live.
- fx: heart sparkles. Status: transparent PixelLab 85x85 inventory icon live.

The first accessory inventory pack is registered through `avatarAccessoryAssets.ts`, verified by `verify-pixellab-assets.js`, and rendered by `/portrait` as real accessory thumbnails.

Do not generate every template as one-off unrelated art. Each template needs the same visual language, bottom-center anchor, and accessory slot logic.

## Current Pixel Placeholder Pack

These are acceptable for internal preview only and should be replaced by production artwork before store launch:

- `assets/avatar/pixel/phoenix-pixel-avatar.png`
- `assets/avatar/pixel/phoenix-pixel-head.png`
- `assets/avatar/pixel/phoenix-pixel-happy.png`
- `assets/avatar/pixel/phoenix-pixel-excited.png`
- `assets/avatar/pixel/phoenix-pixel-calm.png`
- `assets/avatar/pixel/phoenix-pixel-anxious.png`
- `assets/avatar/pixel/phoenix-pixel-unwell.png`

They are derived from the approved pixel room board, so they keep the preview visually aligned while the final sprite/template pack is being produced.

## Current PixelLab Directional Seed Pack

Candidate D is archived as a directional seed after Phase 1 review:

- `assets/avatar/phoenix/approved/phoenix-seed-south.png`
- `assets/avatar/phoenix/approved/phoenix-seed-east.png`
- `assets/avatar/phoenix/approved/phoenix-seed-north.png`
- `assets/avatar/phoenix/approved/phoenix-seed-west.png`
- `assets/avatar/phoenix/approved/phoenix-seed-south-east.png`
- `assets/avatar/phoenix/approved/phoenix-seed-north-east.png`
- `assets/avatar/phoenix/approved/phoenix-seed-north-west.png`
- `assets/avatar/phoenix/approved/phoenix-seed-south-west.png`

These are seed rotations, not final main-avatar assets and not final animation strips. Do not promote Candidate D to the live main avatar.

Next required asset pass:

- Improve or upscale the v2 seated Phoenix main avatar if Apollo wants an even closer board-05/06 match.
- Replace the first-pass derived room variants with final illustrated dark/night, bedtime, health-watch, and home-alone scenes.
- Inspect and improve any action strip that does not read strongly enough at phone size, especially walk/eat/drink where future prop layers can make the action clearer.
- Inspect the subscription seed idle/walk strips in native/mobile preview before deciding whether they should replace or supplement the current approved seated sprite family.
- Derive the dark-mode, badge/logo refinements, running footer sprite, true overlay-aligned accessory layers, and remaining unfinished template emote packs from the approved identity system instead of generating unrelated one-off dogs.

## Production Sprite Manifest Needed Next

Create these as transparent PNG sprite strips, each frame in a 256px slot, aligned bottom-center, same Phoenix silhouette/palette/bandana/proportions, no scenery, no labels, no poster composition:

- `assets/avatar/phoenix/idle-breathe-strip.png`: 8 frames, 6 fps, loop. Status: live.
- `assets/avatar/phoenix/tail-wag-strip.png`: 8 frames, 8 fps, loop. Status: live.
- `assets/avatar/phoenix/ear-perk-strip.png`: 6 frames, 7 fps, one-shot cue. Status: live.
- `assets/avatar/phoenix/walk-loop-strip.png`: 10 frames, 10 fps, loop. Status: live from the v2 standing walk source for a stronger walking read.
- `assets/avatar/phoenix/eat-loop-strip.png`: 8 frames, 7 fps, loop. Status: live.
- `assets/avatar/phoenix/drink-loop-strip.png`: 8 frames, 7 fps, loop. Status: live.
- `assets/avatar/phoenix/sleep-loop-strip.png`: 8 frames, 5 fps, loop. Status: live.
- `assets/avatar/phoenix/comfort-loop-strip.png`: 8 frames, 6 fps, loop. Status: live.
- `assets/avatar/phoenix/celebrate-hop-strip.png`: 8 frames, 9 fps, one-shot reward. Status: live.
- `assets/avatar/phoenix/health-watch-strip.png`: 8 frames, 5 fps, loop. Status: live.

Sprite pipeline rule: start from one approved in-game Phoenix seed frame, generate each full strip at once, normalize with one shared scale, preserve transparency, and inspect in-engine before approving.

## Asset Limitation To Solve Next

The current Home runtime now supports true layered sprite animation. It uses a dogless room layer plus transparent Phoenix strips for finished actions. For the full video-game feel, the app still needs the remaining production assets with separated layers:

- Final illustrated dogless room backgrounds for night, bedtime, health watch, and home-alone to replace first-pass derived variants.
- Optional improved Phoenix loops and prop layers for walk, eating, drinking, anxious glance, low-energy/health watch, proud celebration, and home-alone waiting after runtime/device QA.
- Optional foreground props such as bowl, rug, bed, window, door, toy, and sparkle layers.

`avatarLifeEngine.ts` drives the state decisions while `LivingPhoenixRoom.tsx` renders the registered layered sprite tracks.

Register future assets in `artifacts/woofwatcher-mobile/lib/careTwinAssets.ts` only after both a dogless room layer and matching sprite strips are ready.

Use `artifacts/woofwatcher-mobile/scripts/verify-pixellab-assets.js` to check file presence and PNG dimensions before registration.

## Source Control Rule

Mirror final selected screenshots or source references into `docs/design/reference/` when Apollo provides them. Do not rely only on expiring chat image attachments.
