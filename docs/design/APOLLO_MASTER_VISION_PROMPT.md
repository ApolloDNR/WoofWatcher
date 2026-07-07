# WoofWatcher Master Vision Prompt

This is Apollo's operative brief. Every working session — Claude, Codex, or
human — reads this FIRST and holds every change against it before calling
anything done. If a change does not move the app toward this vision, do not
ship it.

## The One-Paragraph Vision

WoofWatcher is a premium dog-care operating system that plays like a living
Tamagotchi. The owner logs real care (meals, walks, potty, meds); the app
turns that truth into a living world: an animated pixel dog who exists in a
full-screen room that changes with the real time of day, earns XP and levels
only from real logged care, celebrates milestones, and grows a shared record
a household, sitter, or vet can trust. Real care. Pixel heart.

## Non-Negotiable Product Laws

1. The dog is ALIVE. It is an animated sprite layered over the room
   background — never baked into the background image. It idles, wags,
   reacts to logs, celebrates level-ups, and should gain walk cycles,
   sleep-in-bed-at-night, and mood states as sprite assets land.
2. The room is the WORLD. Backgrounds cover the entire screen top to
   bottom. High-horizon composition: wall band in the top quarter, open
   floor flowing down behind the content, muted low-contrast palette so
   consoles float clearly. Day art 6 AM-8 PM, night art 8 PM-6 AM, on the
   real clock.
3. Consoles FLOAT. No card, table, nav bar, or control ever touches the
   screen edge. Consistent 16pt gutter. The layout reads like watching the
   room through a camera with a HUD.
4. Every number is TRUE. XP, levels, streaks, stats, and badges derive only
   from real logged care. No coins, no purchasable progress, no fake
   badges, no hardcoded counts, no dead buttons. Undo takes the XP back.
5. Care workflows are SACRED. Meal lifecycle, potty flow, Health/Bile
   Watch non-diagnostic language, Records, Care Pass, privacy gates, and
   the 605-test suite are never sacrificed for visuals.

## Locked Brand

- Logo: the 2B Phoenix Mark — navy dog-head profile, copper heart at the
  chest (assets/brand/phoenix-mark.png) + "Woof" navy / "Watcher" copper in
  Fraunces serif.
- Palette: cream #F7F2E8 / ivory #FFF9EF surfaces, navy #081424 / ink
  #142033, copper #C85A2A / #E07A2F, amber #D8A852, sage #4D8A56, pale sky.
- Type: Fredoka 600/700 display, Inter 400-800 body/UI, Fraunces 700 wordmark
  only. All weights must be loaded in app/_layout.tsx before use.
- Look: calm premium — 20-24px radii, soft diffuse shadows, sentence-case
  labels, rounded chips, no scanlines, no hard pixel card edges. Pixel style
  lives in the ART (dog, room, icons), not the container chrome.

## Screen Targets (from Apollo's vision boards)

- Home: DONE and the reference for everything else — full-screen living
  room, greeting chip, floating twin chip, presence pill, level strip
  (Lv/title/XP bar/streak), Care Status stat rows with segmented pill bars,
  Next Up, floating nav with soft active pill.
- Avatar Studio: dog on a pedestal/rug against clean cream, sparkles;
  Breed / Coat / Eyes / Accessories segment tabs; carousel selector; color
  swatch row; Randomize + green Save Avatar.
- Adventure: quest board plus Adventure Trail of real logged places (no
  GPS/maps until Apollo approves location policy).
- Career & Stats: level, XP-to-next, logs this week, active days, streak,
  badges from the evidence-based achievements model.
- Health, Records, Plans, More: carry the same immersive/floating language;
  keep proof-gate cockpits intact but visually calm.
- Care Pass: shareable, eventually with QR; serious enough for a vet.

## Asset Pipeline (who makes what)

- Backgrounds, scenes, logos, marketing art → image generation via the
  connected art tool (Higgsfield MCP; ~2 credits/image). Rooms are 9:16,
  high-horizon, muted, no dog baked in. Iterate until composition serves
  the layout; check where the floor lands relative to the sprite band
  BEFORE wiring in.
- Animated sprites (walk/idle/sleep/mood cycles) → Scenario MCP, Pro plan:
  Retro Diffusion Animation (style walking_and_idle, 48x48,
  returnSpritesheet true), cleaned with Pixel Snapper, stitched with the
  repo's sprite-strip scripts, registered in asset verification.
- PixelLab is retired once Scenario is connected.

## Verification Contract (every slice, no exceptions)

1. pnpm run test:focused green (Node 24).
2. Mobile typecheck green.
3. Expo web export + headless screenshot of the changed screens at 390x844.
4. LOOK at the screenshot against this document and the vision boards
   before declaring success. If the composition is off, iterate; do not
   ship and oversell.
5. Commit with a clear message and push to the working branch.

## External Gates (only Apollo can clear)

- Scenario connector active in claude.ai settings (sprite pipeline).
- GitHub billing fixed (remote CI verification).
- Clerk / Supabase / payments / push / store accounts + approvals for
  go-live (tracked in docs/BLOCKERS_FOR_APOLLO.md and the in-app cockpits).

## Master Prompt (paste this to start any session)

"Read docs/design/APOLLO_MASTER_VISION_PROMPT.md and hold every change
against it. Pick the highest-impact unfinished screen target, implement the
smallest coherent slice toward the vision, run the full verification
contract including screenshot review against the boards, push, and show me
the screenshot. Do not claim provider features that are not configured, do
not invent numbers, and do not touch care workflows or tests except to
extend them. If art is needed, generate it per the asset pipeline and check
composition against the layout before wiring it in."
