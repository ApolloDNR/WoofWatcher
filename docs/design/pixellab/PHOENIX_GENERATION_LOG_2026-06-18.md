# Phoenix PixelLab Generation Log - 2026-06-18

## Session Goal

Create Phase 1 Phoenix identity candidates for WoofWatcher's production care twin.

## Balance

- Before Phase 1 queue: 40 trial generations remaining.
- After Candidate D: 0 trial generations remaining, 43 used of 40 reported by PixelLab.
- Phase 2 animation proof was blocked until Apollo added subscription generations; it is now in progress with live idle, tail-wag, and sleep-loop strips.
- After Apollo added subscription: 2,000 generations remaining, subscription active, Tier 1 Pixel Apprentice.
- After v2 identity review packs: 1,950 generations remaining before state/animation work was checked again.
- After v2 seed, state pack, and idle animation: 1,865 generations remaining, 135 used of 2,000.
- After tail-wag, sleep-loop, and dogless room background: 1,856 generations remaining, 144 used of 2,000.
- Later on 2026-06-18, Codex queued the remaining v2 action strips from the approved v2 Phoenix sources. Re-check balance before the next large generation batch.

## Attempted But Rejected

### v3 Quadruped Candidates

- Date: 2026-06-18
- Phase: Phase 1 identity exploration
- Operator: Codex
- PixelLab tool: `create_character`
- Result: rejected by PixelLab before generation
- Reason: v3 mode does not support quadruped body type. PixelLab instructed use of `standard` or `pro` for dog/quadruped characters.
- Cost: no generation charged

## Queued Candidates

### Candidate A

- Date: 2026-06-18
- Phase: Phase 1 identity lock
- Operator: Codex
- PixelLab tool: `create_character`
- PixelLab generation/job ID: `43cde13a-7335-4ad4-9e54-52ca652f6608`
- Mode: `standard`
- Estimated or reported cost: 1 generation
- Output path: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/candidates/`
- Output type: 8-direction character
- Character size: 96x96px
- Transparent background: expected
- Direction count: 8
- Reference image paths: `docs/design/reference/woofwatcher-pixel-reference-board-01.png` through `woofwatcher-pixel-reference-board-04.png`
- Prompt file: `docs/design/pixellab/PHASE_1_PHOENIX_IDENTITY_PROMPT.md`
- Prompt changes: warmer app-icon-friendly Phoenix with selective outline, medium shading, high detail
- Seed/settings: `body_type=quadruped`, `template=dog`, `view=side`, `text_guidance_scale=9`
- Status: completed and downloaded

### Candidate B

- Date: 2026-06-18
- Phase: Phase 1 identity lock
- Operator: Codex
- PixelLab tool: `create_character`
- PixelLab generation/job ID: `c029278c-84e3-46a6-a485-1d4f38da6153`
- Mode: `standard`
- Estimated or reported cost: 1 generation
- Output path: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/candidates/`
- Output type: 8-direction character
- Character size: 96x96px
- Transparent background: expected
- Direction count: 8
- Reference image paths: `docs/design/reference/woofwatcher-pixel-reference-board-01.png` through `woofwatcher-pixel-reference-board-04.png`
- Prompt file: `docs/design/pixellab/PHASE_1_PHOENIX_IDENTITY_PROMPT.md`
- Prompt changes: animation-readability focused Phoenix with single color outline, basic shading, medium detail
- Seed/settings: `body_type=quadruped`, `template=dog`, `view=side`, `text_guidance_scale=8.5`
- Status: completed and downloaded

### Candidate C

- Date: 2026-06-18
- Phase: Phase 1 identity lock
- Operator: Codex
- PixelLab tool: `create_character`
- PixelLab generation/job ID: `9a0f891f-77c3-4c4c-97f0-8d3569a2f415`
- Mode: `standard`
- Estimated or reported cost: 1 generation
- Output path: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/candidates/`
- Output type: 8-direction character
- Character size: 80x80px
- Transparent background: expected
- Direction count: 8
- Reference image paths: `docs/design/reference/woofwatcher-pixel-reference-board-01.png` through `woofwatcher-pixel-reference-board-04.png`
- Prompt file: `docs/design/pixellab/PHASE_1_PHOENIX_IDENTITY_PROMPT.md`
- Prompt changes: smaller, stronger black outline, higher-detail Phoenix for mobile readability
- Seed/settings: `body_type=quadruped`, `template=dog`, `view=side`, `text_guidance_scale=9.5`
- Status: completed and downloaded

### Candidate D

- Date: 2026-06-18
- Phase: Phase 1 identity refinement
- Operator: Codex
- PixelLab tool: `create_character_state`
- PixelLab generation/job ID: `f0c6169b-88c0-4428-9089-31c0565c4129`
- Source candidate: `43cde13a-7335-4ad4-9e54-52ca652f6608` / Candidate A
- Estimated or reported cost: PixelLab balance moved from 37 remaining to 0 remaining after Candidate D completed.
- Output path: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/candidates/`
- Output type: refined 8-direction character state
- Transparent background: expected
- Direction count: 8
- Reference image paths: Candidate A generated rotations
- Prompt file: inline PixelLab state edit from Candidate A
- Prompt changes: stronger black saddle, clearer shepherd mask, visible bandana/collar/copper heart tag, more premium animation-ready silhouette
- Seed/settings: `use_color_palette_from_reference=true`
- Status: completed, downloaded, then demoted after design review to archived directional exploration only

## Archived Directional Exploration

Candidate D is not approved as the final main WoofWatcher avatar style. It is archived as a possible future movement-sprite exploration because Apollo selected a richer visual target after review:

- `docs/design/reference/woofwatcher-pixel-reference-board-05-neo-retro-digital-pet.png`
- `docs/design/reference/woofwatcher-pixel-reference-board-06-ecosystem-supporting-pages.png`

The next approved Phoenix identity must look closer to those boards: larger, seated/expressive, premium neo-retro digital pet proportions, readable face and shepherd markings, sage bandana, dark collar, and copper heart tag.

Archived files:

- `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/phoenix-seed-south.png`
- `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/phoenix-seed-east.png`
- `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/phoenix-seed-north.png`
- `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/phoenix-seed-west.png`
- `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/phoenix-seed-south-east.png`
- `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/phoenix-seed-north-east.png`
- `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/phoenix-seed-north-west.png`
- `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/phoenix-seed-south-west.png`

Review artifacts:

- `docs/design/pixellab/phoenix-identity-review-2026-06-18.html`
- `docs/design/pixellab/phoenix-identity-contact-sheet-2026-06-18.png`

## QA Checklist For Next Main Avatar Review

- Same Phoenix identity across all directions:
- Tall shepherd ears:
- Black-and-tan saddle coat:
- Dark facial mask:
- Sage bandana:
- Dark collar and copper heart tag:
- No cropped ears, paws, or tail:
- Transparent background:
- Pixel clusters crisp:
- Mobile-size readability:
- Matches boards 05/06 large expressive avatar direction:
- Includes or can derive seated, sleep/rest, WoofGuide, dark-mode, badge/logo, and running footer variants:
- Approved for Phase 2 animation proof:

## V2 Main Avatar Pass

Apollo added a PixelLab subscription and requested the redesign continue toward the board 05/06 style.

### Candidate E Review Pack

- Date: 2026-06-18
- Phase: main avatar redesign
- Operator: Codex
- PixelLab tool: `create_1_direction_object`
- PixelLab object ID: `76ad00e2-16f8-4f13-bd54-975ce95cfed1`
- Mode: 1-direction 4-frame review pack
- Cost: 25 generations
- Size: 170x170px
- Prompt target: large seated Phoenix, premium neo-retro digital pet, transparent background, no room/UI/text, not tiny RPG sprite
- Local files:
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/candidates/candidate-e-frame-0.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/candidates/candidate-e-frame-1.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/candidates/candidate-e-frame-2.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/candidates/candidate-e-frame-3.png`
- Review sheet: `docs/design/pixellab/phoenix-candidate-e-contact-sheet-2026-06-18.png`
- Status: downloaded for comparison; not selected

### Candidate F Review Pack

- Date: 2026-06-18
- Phase: main avatar redesign
- Operator: Codex
- PixelLab tool: `create_1_direction_object`
- PixelLab object ID: `a365ff85-d06d-4f5c-9b31-d007ac93538f`
- Mode: 1-direction 4-frame review pack
- Cost: 25 generations
- Size: 170x170px
- Prompt target: front-facing three-quarter seated Phoenix, happy tongue-out, App Store mascot proportions, transparent background
- Local files:
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/candidates/candidate-f-frame-0.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/candidates/candidate-f-frame-1.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/candidates/candidate-f-frame-2.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/candidates/candidate-f-frame-3.png`
- Review sheet: `docs/design/pixellab/phoenix-candidate-ef-contact-sheet-2026-06-18.png`
- Selected frame: `2`

### Approved V2 Seed

- PixelLab object ID: `4f318d58-7166-4b0a-b202-2896eed1e0dc`
- Source: Candidate F frame 2
- Tag: `woofwatcher-phoenix-main-avatar-v2`
- Local files:
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/phoenix-main-avatar-v2.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/phoenix-main-head-v2.png`
- Status: wired into app defaults and Avatar Studio head/icon surfaces

### V2 State Assets

- Sleep/rest object ID: `5ff99e4b-b2ca-4a4f-96b3-8da9a661c367`
- Home-alone/anxious object ID: `bc0121cd-0a35-45e9-9665-f9a10e87426a`
- Proud/happy object ID: `7cd658e1-84a7-4991-ac69-bac0a1a9c9ac`
- WoofGuide bust object ID: `6b9bbb5b-e7ea-4074-b632-84a981c839d4`
- Local files:
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/phoenix-sleep-rest-v2.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/phoenix-home-alone-anxious-v2.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/phoenix-proud-happy-v2.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/phoenix-woofguide-bust-v2.png`

### V2 Idle Animation Proof

- Source object ID: `4f318d58-7166-4b0a-b202-2896eed1e0dc`
- Animation group: `f3c893f9-028a-4b7a-94aa-d86399e0c364`
- PixelLab output: 9 frames
- Local raw frames: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/animations/idle-breathe-v2/frame-*.png`
- Review sheet: `docs/design/pixellab/phoenix-idle-breathe-v2-preview-2026-06-18.png`
- Raw strip: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/idle-breathe-v2-strip.png`
- Normalized production strip: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/idle-breathe-strip.png`
- Status: generated, normalized, and registered in the layered room runtime

### V2 Tail-Wag Animation Proof

- Source object ID: `4f318d58-7166-4b0a-b202-2896eed1e0dc`
- Animation group: `8ab90288-dcec-433d-b243-814a5890ae20`
- PixelLab output: 9 frames
- Local raw frames: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/animations/tail-wag-v2/frame-*.png`
- Review sheet: `docs/design/pixellab/phoenix-tail-wag-v2-preview-2026-06-18.png`
- Normalized production strip: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/tail-wag-strip.png`
- Status: generated, normalized, and registered in the layered room runtime

### V2 Sleep-Loop Animation Proof

- Source object ID: `5ff99e4b-b2ca-4a4f-96b3-8da9a661c367`
- Animation group: `247f0406-4bf5-4b40-b32b-26842d0b816e`
- PixelLab output: 9 frames
- Local raw frames: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/animations/sleep-loop-v2/frame-*.png`
- Review sheet: `docs/design/pixellab/phoenix-sleep-loop-v2-preview-2026-06-18.png`
- Normalized production strip: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/sleep-loop-strip.png`
- Status: generated, normalized, and registered in the layered room runtime

### V2 Dogless Room Layer

- PixelLab map object ID: `081c5fb5-f7db-422d-8732-2c7da0a404d8`
- Local source/mask:
  - `artifacts/woofwatcher-mobile/assets/avatar/rooms/phoenix-room-day-inpaint-source-192.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/rooms/phoenix-room-day-inpaint-mask-192.png`
- PixelLab raw room: `artifacts/woofwatcher-mobile/assets/avatar/rooms/phoenix-room-day-pixellab-400x300.png`
- Local production room layer: `artifacts/woofwatcher-mobile/assets/avatar/rooms/phoenix-room-day.png`
- Production sizing: upscaled nearest-neighbor to 800x600 for the asset verifier and mobile stage rendering.
- Status: generated and registered as the shared dogless room layer for current moods

### V2 Action Strip Expansion

- Date: 2026-06-18
- Operator: Codex
- PixelLab source objects:
  - Main seated Phoenix: `4f318d58-7166-4b0a-b202-2896eed1e0dc`
  - Home-alone/anxious Phoenix: `bc0121cd-0a35-45e9-9665-f9a10e87426a`
  - Proud/happy Phoenix: `7cd658e1-84a7-4991-ac69-bac0a1a9c9ac`
- PixelLab animation groups:
  - `ear-perk`: `1152c1f0-a9b0-4a53-8ca4-ee5f7bd2d57b`
  - `walk-loop`: `c4dca12e-024c-4003-a266-ea45a8ad129f`
  - `eat-loop`: `a78ced66-e86c-4456-83e2-4479f9e28ea6`
  - `drink-loop`: `2de4e6a7-d850-4e80-b488-17d372c91780`
  - `comfort-loop`: `51ae7a6b-852c-45ed-a15d-0d97cf71280d`
  - `celebrate-hop`: `1c20cff5-f383-4abb-8a80-22febb83d91d`
  - `health-watch`: `7fb9bfaa-7736-4ddd-9572-4095bd33af81`
- Local production strips:
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/ear-perk-strip.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/walk-loop-strip.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/eat-loop-strip.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/drink-loop-strip.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/comfort-loop-strip.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/celebrate-hop-strip.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/health-watch-strip.png`
- Local tooling:
  - `artifacts/woofwatcher-mobile/scripts/build-pixellab-sprite-strip.js`
- Status: generated, normalized into fixed 256px slots, registered in `careTwinAssets.ts`, and verified for dimensions. The first walk strip stayed too seated in visual review, so a standing walk source replacement pass was started.

### V2 Standing Walk Source

- Date: 2026-06-18
- Operator: Codex
- PixelLab tool: `create_object_state`
- PixelLab object ID: `7cbe5ec5-e3e6-4e14-9276-5837b75403e1`
- Source object: `4f318d58-7166-4b0a-b202-2896eed1e0dc`
- Local file:
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/phoenix-standing-walk-source-v2.png`
- Standing walk animation group: `c237cd43-423b-494a-b972-c01f9b976da9`
- Production strip: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/walk-loop-strip.png`
- Status: generated and saved as a better full-body movement source. The `walk-loop-v2-standing` animation replaced the first seated walk attempt, and the strip builder now clears PixelLab's transparent-frame matte RGB for cleaner downstream previews.

### First-Pass Dogless Room Variants

- Date: 2026-06-18
- Operator: Codex
- Source: `artifacts/woofwatcher-mobile/assets/avatar/rooms/phoenix-room-day.png`
- Local tooling: `artifacts/woofwatcher-mobile/scripts/derive-pixellab-room-variants.js`
- Output:
  - `artifacts/woofwatcher-mobile/assets/avatar/rooms/phoenix-room-night.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/rooms/phoenix-room-bedtime.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/rooms/phoenix-room-health-watch.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/rooms/phoenix-room-home-alone.png`
- Status: generated locally as runtime-ready first-pass variants and registered for room-state routing. Replace with final illustrated PixelLab/Figma-quality variants before store-quality launch.

### Avatar Studio Template Preview Pack

- Date: 2026-06-18
- Operator: Codex
- PixelLab tool: `create_1_direction_object`
- Review object ID: `692b49bd-53dd-4256-a427-dc4dca21853d`
- Tag: `woofwatcher-avatar-template-preview-2026-06-18`
- Cost: 25 generations
- Output format: 12 selected transparent 85x85 PNG thumbnails.
- Local registry: `artifacts/woofwatcher-mobile/lib/avatarTemplateAssets.ts`
- Local assets:
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/shepherd/preview.png` from `7afe5bc8-8452-4e60-acda-56025dad7cb2`
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/retriever/preview.png` from `31b0491c-637d-4a77-8a8d-8144cb4eebfb`
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/husky/preview.png` from `26cc4384-c269-40f6-8598-ec7af79c8c99`
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/bully/preview.png` from `8a1181e4-75ba-4c05-ad3a-4a402b484cfa`
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/doodle/preview.png` from `95639c70-1314-42c7-ae8c-3abe809892b6`
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/terrier/preview.png` from `6a525c1d-20ed-49e7-bd6e-8d218da207ef`
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/hound/preview.png` from `542a71da-8b6e-41fe-84c3-76ad6a7a0bb2`
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/dachshund/preview.png` from `5e63c845-6ae9-44b9-ba8f-3b41611f4565`
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/spaniel/preview.png` from `32e5dcfd-8b8e-4931-9e70-58637955e784`
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/toy/preview.png` from `0605ba11-08b7-483d-8a08-6ad68a5752f6`
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/slender/preview.png` from `3d5e306e-2cf1-4fd1-99b7-ecfb47f9c8b4`
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/mixed/preview.png` from `29dd78da-57d2-4609-953a-25b1c07ce71d`
- Status: generated, visually reviewed as a coherent first-pass launch template thumbnail set, registered in the mobile Avatar Studio template picker, and protected by readiness tests. Full template base/emote/sprite packs are still future work.

### Avatar Studio Template Base Pack 1

- Date: 2026-06-18
- Operator: Codex
- PixelLab tool: `create_1_direction_object`
- Review object ID: `3e5f7877-7382-49de-b3fc-1f74c75631ec`
- Tag: `woofwatcher-avatar-template-base-pack-2026-06-18`
- Cost: 25 generations
- Output format: 4 selected transparent 170x170 PNG base stills.
- Local registry: `artifacts/woofwatcher-mobile/lib/avatarTemplateAssets.ts`
- Local assets:
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/shepherd/base.png` from `4a979556-9f07-4660-b3bf-831fed6030c0`
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/retriever/base.png` from `472ae20c-5dc4-496a-b0e7-7cafe29d147c`
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/husky/base.png` from `f8fed25f-6a1f-46fa-8d5a-5ec17fadd0f7`
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/doodle/base.png` from `f5852e83-c2d1-4630-8e97-6a4cdb02260d`
- Status: generated, visually reviewed as a coherent first production-scale base set, registered in the mobile Avatar Studio preview stage, and protected by readiness tests. Remaining base templates were completed in packs 2 and 3 below.

### Avatar Studio Template Base Pack 2

- Date: 2026-06-18
- Operator: Codex
- PixelLab tool: `create_1_direction_object`
- Review object ID: `eae9f9d1-83ea-4f8d-9ea6-af81db200d18`
- Tag: `woofwatcher-avatar-template-base-pack-2026-06-18`
- Cost: 25 generations
- Output format: 4 selected transparent 170x170 PNG base stills.
- Local registry: `artifacts/woofwatcher-mobile/lib/avatarTemplateAssets.ts`
- Local assets:
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/bully/base.png` from `25c648c4-6e26-4c8e-8b65-6fb94e7c10b4`
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/terrier/base.png` from `65f0ffbb-e811-49d4-be6d-c8f2b2abf0ce`
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/hound/base.png` from `7f8a712d-c65c-4d1c-835a-5f79b5500ff7`
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/dachshund/base.png` from `8fbb402b-579d-478c-bcad-fd21e61cf530`
- Status: generated, selected, downloaded, visually checked in a 12-template contact sheet, registered, and covered by PixelLab asset verification.

### Avatar Studio Template Base Pack 3

- Date: 2026-06-18
- Operator: Codex
- PixelLab tool: `create_1_direction_object`
- Review object ID: `06af8c0e-a3fe-411a-bab9-9535648a7f29`
- Tag: `woofwatcher-avatar-template-base-pack-2026-06-18`
- Cost: 25 generations
- Output format: 4 selected transparent 170x170 PNG base stills.
- Local registry: `artifacts/woofwatcher-mobile/lib/avatarTemplateAssets.ts`
- Local assets:
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/spaniel/base.png` from `b85934b2-d1cc-4b89-b4e9-0342520ec73a`
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/toy/base.png` from `995d0da0-6469-42ea-9855-7caed01584c2`
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/slender/base.png` from `efa34067-c258-4105-9da4-73d0907f36b5`
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/mixed/base.png` from `c63ef688-cc17-4f7f-94d2-8504606213b5`
- Status: generated, selected, downloaded, visually checked in a 12-template contact sheet, registered, and covered by PixelLab asset verification. The launch template base-still layer is now complete; emote stills, sprite strips, and accessories remain.

### Phoenix Avatar Studio Emote Pack 1

- Date: 2026-06-18
- Operator: Codex
- PixelLab tool: `create_object_state`
- Source object ID: `4f318d58-7166-4b0a-b202-2896eed1e0dc`
- Output format: 10 transparent 170x170 PNG emote stills.
- Local registry: `artifacts/woofwatcher-mobile/lib/avatarEmoteAssets.ts`
- Local assets:
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/emotes/happy.png` from the approved proud/happy state.
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/emotes/calm.png` from `f690d72e-5efb-4931-ad76-d2f4a739ff87`.
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/emotes/excited.png` from `bfe8bee5-5fa8-415c-b63e-2d71faa9725e`.
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/emotes/bored.png` from `b74aea82-806a-410c-acc5-1247cbde970c`.
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/emotes/hungry.png` from `2f1a7800-0414-44e7-94d0-fb986ca22343`.
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/emotes/anxious.png` from the approved home-alone/anxious state.
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/emotes/sleepy.png` from the approved sleep/rest state.
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/emotes/proud.png` from the approved proud/happy state.
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/emotes/home-alone.png` from the approved home-alone/anxious state.
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/emotes/not-feeling-well.png` from `39e8b2d9-da66-496b-83c6-8755bcad7d23`.
- Rejected first-pass object IDs:
  - `ac03ab66-d872-4ac6-a8e9-9b83f9828fe7` - bored pose too similar to default.
  - `799136e4-e617-4187-880c-62078df88661` - hungry pose too subtle at phone size.
  - `2032e8a9-6e52-4504-8ac4-38dd69c7957c` - not-feeling-well pose too similar to default.
- Status: generated, downloaded, registered, wired into the Avatar Studio Mood set, and covered by PixelLab asset verification. The first Phoenix/Shepherd still-emote layer is live; remaining non-Retriever template emotes, accessory overlays, and mood transition strips remain.

### Subscription Seed Animation Strips

- Date: 2026-06-18
- Operator: Codex
- PixelLab character ID: `f0c6169b-88c0-4428-9089-31c0565c4129`
- PixelLab templates:
  - `idle`
  - `walk-8-frames`
- Local assets:
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/pixellab-idle-south-strip.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/pixellab-walk-south-strip.png`
- Output format: two transparent 2048x256 PNG strips with eight 256px frame slots.
- Verification: covered by `artifacts/woofwatcher-mobile/scripts/verify-pixellab-assets.js`.
- Status: local production seed strips for movement review. They are not promoted over the current approved seated Home sprite family until phone-size proportions, anchor, and mockup fit are approved.

### Retriever Avatar Studio Emote Pack 1

- Date: 2026-06-18
- Operator: Codex
- PixelLab tool: `create_object_state`
- Source object ID: `472ae20c-5dc4-496a-b0e7-7cafe29d147c`
- Output format: 10 transparent 170x170 PNG emote stills.
- Local registry: `artifacts/woofwatcher-mobile/lib/avatarEmoteAssets.ts`
- Local assets:
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/retriever/emotes/happy.png` from `5e24a03f-73dc-4684-b4c3-ddc91f8db9f9`.
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/retriever/emotes/calm.png` from `b5983708-e550-472f-9189-5ac9bec7d191`.
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/retriever/emotes/excited.png` from `e4aae138-1c54-4cf1-88c7-613dc62d1184`.
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/retriever/emotes/bored.png` from `e29b6096-6f06-4f14-80c8-aec1c839ee2d`.
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/retriever/emotes/hungry.png` from `7afaace0-d865-4d94-ba17-b5a2b93a57a1`.
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/retriever/emotes/anxious.png` from `87bda871-3929-4378-ac3f-7ef1d98318d5`.
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/retriever/emotes/sleepy.png` from `2be863b6-a1b7-422b-ae26-cd82676cdc38`.
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/retriever/emotes/proud.png` from `88e6bf65-fc70-4fc8-bc58-d70a0672e671`.
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/retriever/emotes/home-alone.png` from `52215717-34b7-4ebf-a354-2c628eb0559d`.
  - `artifacts/woofwatcher-mobile/assets/avatar/templates/retriever/emotes/not-feeling-well.png` from `a48f574d-fb49-4198-ad9b-96ac47df7e5f`.
- Verification: covered by `artifacts/woofwatcher-mobile/scripts/verify-pixellab-assets.js`.
- Status: generated, downloaded, registered, wired into the Avatar Studio Mood set through selected-template emote routing, and covered by mobile readiness tests. This is the first non-Phoenix still-emote layer; remaining templates/body classes still need packs.
