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
