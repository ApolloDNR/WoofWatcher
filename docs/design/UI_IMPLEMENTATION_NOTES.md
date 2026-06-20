# UI Implementation Notes

Date: 2026-06-14

## Current Approach

Implement v1.5 incrementally. Do not rewrite the product from scratch.

The app should converge on a shared visual system across:
- Expo mobile app.
- Local-first PWA/dashboard.
- Future Figma components.

Apollo's latest reference boards are now the visual source of truth. Keep them mirrored in `docs/design/reference/` and use `docs/superpowers/specs/2026-06-14-woofwatcher-pixel-ui-lock-design.md` as the implementation spec before making visual changes.

## Tokens

Use the v1.5 palette:
- Deep navy `#081424`
- Navy `#081A2A`
- Navy 2 `#102C40`
- Copper `#C85A2A`
- Copper 2 `#E07A2F`
- Forest `#4D8A56`
- Sage `#6DA36F`
- Sage soft `#E8F3E7`
- Cream `#F7F2E8`
- Ivory `#FFF9EF`
- Blue signal `#A8CBE8`
- Amber `#D8A852`
- Rose `#C96358`
- Stone `#E6DED2`
- Ink `#142033`

## Typography

- Use readable UI text for product content.
- Use pixel styling only as an accent for logo, badges, speech bubbles, status labels, and small UI feedback.

## PWA Notes

- Keep `woofwatcher.v1.state`.
- Keep backup/import/export actions.
- Keep localStorage as the v1.5 PWA data source until cloud sync is explicitly implemented.
- The PWA shell should expose grouped desktop navigation and five-tab mobile navigation.
- Quick Log should remove confusing pee/poop top-level concepts and use Potty as the parent action.

## Mobile Notes

- Mobile remains canonical.
- Keep Home, Log, Plans, Health, More as bottom nav.
- Put overflow tools under More.
- Continue moving reusable rules into `lib/care-domain`.
- Prioritize the actual Expo mobile screens before polishing the PWA because mobile is the primary product surface.
- Match the reference-board mobile layouts: Home, Quick Log, Plans, Health/Bile, Household Pulse/Alone Time, Care Pass, Avatar Studio, and Reports.

## Visual Fidelity Notes

- Use the navy shell and bottom bar as the strongest brand frame.
- Use cream/ivory content backgrounds with thin stone borders.
- Keep cards compact and purposeful.
- Use segmented HUD meters for energy, hunger, hydration, bile risk, bond, and similar status signals.
- Use pixel icons and Phoenix room art as product identity, but keep care copy readable.
- No button should be introduced unless it has a real action, route, or honest setup explanation.
- Phoenix should read as hard-pixel game art, not a soft illustration or photo-derived portrait. If a user uploads a dog photo, show it as a scan reference only; the avatar hero must stay a PixelLab/template care twin.
- Do not promote a new still dog into Home unless the matching animation strips exist. The live care twin should remain one coherent sprite family, not a still avatar plus mismatched motion.

## 2026-06-14 Mobile Foundation Pass

Implemented the first board-accurate Expo mobile foundation slice:

- Locked board palette tokens in `artifacts/woofwatcher-mobile/constants/colors.ts`.
- Added reusable board primitives in `artifacts/woofwatcher-mobile/components/board/BoardPrimitives.tsx`.
- Converted mobile bottom navigation to the dark navy shell with cream active states.
- Rebuilt Phoenix Home around the reference-board composition: pixel room hero, speech bubble, presence chip, segmented status meters, Quick Actions, Today at a Glance, Recent Activity, and Health/Bile/Alone watch cards.
- Added a static readiness test so the app keeps the locked palette, board primitives, Home wiring, and navy tab shell.

Remaining visual work:

- Continue deep visual polish on Quick Log, Plans, More, Records, Care Pass, WoofGuide, and Avatar Studio now that route chrome is aligned.
- Run simulator/browser screenshot QA once dependencies are installed.
- Replace current static board assets with final Phoenix pixel states when available.

## 2026-06-14 Board Route Adoption Pass

Extended the mobile board primitive system beyond Phoenix Home:

- Added `BoardRouteHeader`, `BoardPill`, and `BoardMetricTile` to `artifacts/woofwatcher-mobile/components/board/BoardPrimitives.tsx`.
- Converted Health Watch/Bile Watch to shared board cards, pills, metric tiles, section headers, and care rows while preserving non-diagnostic health copy.
- Added shared route headers to Quick Log, Plans, More, Records, WoofGuide, and Avatar Studio.
- Added board section usage to Quick Log, Plans, More, Records, WoofGuide, and Avatar Studio so the visual system now reaches every core v1.5 mobile route.
- Added a mobile readiness test that protects board primitive adoption across Log, Plans, Health, More, Records, WoofGuide, and Avatar Studio.

Cleanup note:

- Removed the hidden legacy route-header blocks from `more.tsx` and `portrait.tsx` so those routes now rely on `BoardRouteHeader` without duplicate hidden markup.

## 2026-06-14 Core Workflow Card Anatomy Pass

Tightened the next board-system layer across the highest-frequency mobile routes:

- Converted the Quick Log composer to `BoardCard` so the main logging surface shares the same border, radius, and shadow contract as Home and Health.
- Wrapped Plans upcoming events in a board card with internal event rows, preserving real add/remove event behavior without nesting cards.
- Converted the Records Dog ID credential to the navy `BoardCard` tone while preserving share/print behavior and credential content.
- Added a mobile readiness test that protects this shared card anatomy for Quick Log, Plans, and Records.

## 2026-06-14 Records Report Board Anatomy Pass

Tightened the premium Records and report surfaces:

- Added an accessory slot to `BoardSectionHeader` so board headers can carry real actions such as Share without becoming dead decorative labels.
- Converted Records Care Pass preview into a `BoardCard` section with internal audience rows for Sitter, Vet, Trainer, and Caregiver.
- Converted Report History into a `BoardCard` section while preserving resend and printable-source share actions for saved Care Pass artifacts.
- Converted Progress Report into a `BoardCard` section with the period segmented control and working share action inside the same report surface.
- Added a mobile readiness test that protects Records Care Pass, Report History, and Progress Report board anatomy for the Fable/Replit polish pass.

## 2026-06-14 Records Vault Board Anatomy Pass

Closed the remaining lower Records layout gap:

- Converted Record Vault into a `BoardCard` section with a real Add action and internal vault tiles for vaccines, visits, receipts, insurance, microchip, medication, weight, and documents.
- Converted Diet on File into a `BoardCard` section with a real Edit route and preserved recent meal-note context.
- Converted Records Cabinet into a `BoardCard` section with saved-count copy, the empty add-first-record action, existing record rows, attachment indicators, due labels, and delete controls preserved.
- Removed the old shadow treatment from vault tiles so they read as internal board controls rather than cards inside cards.
- Added a mobile readiness test that protects Record Vault, Diet on File, and Records Cabinet board anatomy.

## 2026-06-14 Records Trend Board Anatomy Pass

Moved the first Records trend set onto shared board anatomy:

- Converted Weight Trend into a `BoardCard` section while preserving the SVG trend chart, goal pill, chart labels, and vet-safe pacing copy.
- Converted Mood Trend into a `BoardCard` section while preserving the mood distribution bars and average mood summary.
- Converted Hydration into a `BoardCard` section while preserving the water summary, progress meter, refill/caregiver stats, latest-log context, and next-step copy.
- Removed the now-unused `chartCard` style.
- Added a mobile readiness test that protects Weight Trend, Mood Trend, and Hydration board anatomy.

## 2026-06-14 Records Activity Board Anatomy Pass

Moved the next Records care-evidence set onto shared board anatomy:

- Converted Walk Activity into a `BoardCard` section while preserving activity status, walk meter, dog-interaction stats, latest walk context, and Saved Routes.
- Converted Training Progress into a `BoardCard` section while preserving minutes/wins/skills stats, focus skills, latest practice context, and next-practice notes.
- Converted Potty Health into a `BoardCard` section while preserving pee/poop/review stats, stool color/context detail, latest potty context, and non-diagnostic next-step copy.
- Added a mobile readiness test that protects Walk Activity, Training Progress, and Potty Health board anatomy.

## 2026-06-14 Records Completion Board Anatomy Pass

Finished the remaining Records screen board-unification work:

- Converted Care Trends into a `BoardCard` section while preserving weekly signals, meal completion, walk minutes, and next-step copy.
- Moved the Dog ID heading and Share/Print actions onto the shared `BoardSectionHeader` pattern while preserving the navy credential card.
- Converted Alone Time, Grooming Care, Incident Lookback, and Medication Plan into shared `BoardCard` sections.
- Preserved medication routine navigation, adherence stats, next-dose state, follow-ups, medication history search, outcome filters, and all medication accessibility labels.
- Removed the now-unused Records-only `padCard`, `sectionHeader`, and `sectionTitle` styles so the screen no longer carries a parallel card vocabulary.
- Added mobile readiness tests for Care Trends, Dog ID heading, Alone Time, Grooming Care, Incident Lookback, and Medication Plan board anatomy.

## 2026-06-14 More Board Anatomy Pass

Moved the primary More tab household and system surfaces onto the shared board vocabulary:

- Converted Care Team into one `BoardCard` section with household rename, invite code, invite sharing, and member rows preserved.
- Converted Household Access, Responsibility Center, and Sync Health into `BoardCard` sections while preserving invite, routine-board, and refresh actions.
- Converted Tools & Sharing into a `BoardCard` section while preserving all route links and accessibility labels.
- Converted Diet Profile into a `BoardCard` section while preserving Edit and Details controls plus expanded diet rows and vet-note copy.
- Removed the old local More `sectionHeader`, `sectionTitle`, `inviteCard`, `responsibilityCard`, `syncCard`, and `dietCard` style vocabulary.
- Added a mobile readiness test that protects the new More board anatomy.

## 2026-06-14 Plans Board Anatomy Pass

Moved the main Plans route care-planning surfaces onto shared board anatomy:

- Converted Reminder Center into a single `BoardCard` with its `BoardSectionHeader` inside the card while preserving active-count copy, reminder metrics, row routing, and notification-readiness language.
- Converted Daily Routine into a `BoardCard` with add-routine action, progress copy, empty setup state, household responsibility panel, owner load chips, routine timeline, edit routing, and one-tap completion preserved.
- Replaced the old local `sectionHeader`, `sectionTitle`, `emptyCard`, `reminderCard`, and `responsibilityCard` style vocabulary with shared board spacing and an internal routine responsibility panel.
- Removed one unused legacy `eventCard` style.
- Added a mobile readiness test that protects Reminder Center and Daily Routine board anatomy.

## 2026-06-14 Quick Log Board Anatomy Pass

Moved the remaining Quick Log search and timeline surfaces onto shared board anatomy:

- Converted Today at a Glance into a `BoardCard` with a `BoardSectionHeader` and internal daily summary panel.
- Converted Find Care Logs into a `BoardCard` containing search input, active-filter summary, and filter chips while preserving search/filter behavior.
- Converted the empty timeline state into a `BoardCard` with a clear "No matching logs" header.
- Converted grouped timeline days into `BoardCard` sections with `BoardSectionHeader` titles while preserving sticky notes, edit/detail/delete actions, sync labels, and severity badges.
- Replaced the old local `searchCard`, `snapshotBar`, `dayCard`, and timeline-empty card vocabulary with board panel styles.
- Updated the composer-boundary readiness test so the Log composer and search card remain separate board surfaces.

## 2026-06-14 WoofGuide Board Anatomy Pass

Moved the assistant's owner-reviewed start state onto the same board system:

- Kept the WoofGuide intro as a shared `BoardCard` with route-header copy that makes the vet boundary explicit.
- Converted Quick Questions into a `BoardCard` with tappable internal prompt rows instead of standalone floating chips.
- Converted Suggested Actions into a `BoardCard` with internal action rows while preserving generated routing, prompts, draft creation, and owner-review labels.
- Removed the old `quickRow`, `actionArea`, and `actionCard` vocabulary so WoofGuide does not drift into a separate chat-app visual system.
- Added a mobile readiness test that protects WoofGuide prompt and action board anatomy.

## 2026-06-14 Premium Board Anatomy Pass

Moved the mobile revenue and launch-trust screen onto the shared board system:

- Converted Why Upgrade into a `BoardCard` with internal value tiles.
- Kept Plans under a board section header and converted individual plan cards to shared `BoardCard` shells.
- Converted Launch Entitlements into a `BoardCard` while preserving Free/Plus/Family entitlement policy truth.
- Kept the payment boundary honest with "Checkout gated" and the existing Premium launch checklist instead of implying live subscription checkout.
- Removed the old local `sectionHeader`, `sectionTitle`, and `signalCard` vocabulary from the Premium screen.

## 2026-06-14 Privacy Board Anatomy Pass

Moved the mobile privacy and launch-safety screen onto the shared board system:

- Converted Export Summary into a `BoardCard` with internal count tiles.
- Converted Launch Safety Gates into a `BoardCard` while preserving export, deletion, AI, document-storage, and payment gate status rows.
- Converted Before Public Launch blockers into a `BoardCard` so the release blockers read as a first-class safety surface.
- Preserved owner data export and deletion-request share actions.
- Removed the old local `sectionHeader`, `sectionTitle`, and `statCard` vocabulary from Privacy & Safety.

## 2026-06-14 Avatar Studio Board Anatomy Pass

Moved the mobile avatar creation route closer to the locked pixel-board system:

- Converted the working scan canvas and live/generated preview frames to shared `BoardCard` shells while preserving image content, scan beam, reticle, and generated-result state.
- Converted Generated Mood Set and current Mood Set into `BoardCard` sections with `BoardSectionHeader` copy.
- Converted the photo guidance tip into a soft board card.
- Removed unused legacy header/back/subtitle styles and the local preview shadow treatment so Avatar Studio does not carry a parallel card system.
- Remaining art task: replace default/static Phoenix images with final pixel state assets and motion-ready sprite or animation files.

## 2026-06-14 Setup Board Anatomy Pass

Moved the mobile onboarding route onto the shared board system:

- Replaced the local setup header with `BoardRouteHeader`.
- Converted setup progress into a `BoardCard` with a `BoardSectionHeader`.
- Converted the reusable setup `Section` component to `BoardCard`, covering Dog Profile, Diet Baseline, Starter Routine, and Household Caregiver.
- Kept draft hydration, save foundation, and finish-later behavior unchanged.
- Removed old local setup header and progress-card shell styles.

## 2026-06-16 Living Phoenix Runtime Pass

Moved Phoenix Home from a static board image toward a real care-twin runtime:

- Added `artifacts/woofwatcher-mobile/lib/avatarLifeEngine.ts` to map care state into room zones, motion modes, care cue labels, breathing pace, sleep/hearts/aura flags, and game-like activity labels.
- Rebuilt `LivingPhoenixRoom` as a single animated hero stage using the board-accurate pixel room art instead of layering a second Phoenix image over the room.
- Added Reanimated motion for breathing, light walking sway, eating/drinking cue movement, comfort aura, sleep `Zz`, sparkle feedback, press haptics, and post-log reaction bursts.
- Added a dynamic pixel speech bubble, `LIVE CARE TWIN` chip, zone chip, mood patch, presence/care/energy dock, and next-action chip while preserving the existing Home care workflows.
- Tightened local web auth so placeholder Clerk keys use the local auth adapter instead of blanking the preview when Clerk JS is unavailable.
- Added focused readiness coverage for the avatar life engine, Home room wiring, single-stage room implementation, and local Clerk placeholder behavior.

Remaining visual work:

- Replace the remaining fallback states with dogless room variants plus transparent Phoenix pixel sprite sheets.
- Add true sprite loops for walk, sit, ears/glance, eat/drink, proud sparkle, and home-alone waiting.
- Run native iOS/Android visual QA for motion timing, safe area, and frame rate once simulator/device access is available.

## 2026-06-16 Care Twin Engine And Sprite Manifest Pass

Locked the next video-game foundation without reintroducing a pasted-on second dog:

- Extended `avatarLifeEngine.ts` into a Care Twin scene engine with explicit scene phases, priority needs, HUD tones, tap verbs, recommended actions, and sprite actions.
- Added `CARE_TWIN_SPRITE_MANIFEST` as the production asset contract for transparent 256px bottom-center Phoenix sprite strips: idle breathing, tail wag, ear perk, walk, eat, drink, sleep, comfort, celebrate, and health watch.
- Kept `deriveAvatarLifePlan` as a compatibility wrapper while Home now uses `deriveCareTwinScene`.
- Updated `LivingPhoenixRoom` so the HUD, accessibility label, care cue, and mood patch read from the game-state plan instead of one-off display copy.
- Added focused tests for care-state-to-sprite mapping and manifest invariants, plus readiness checks that protect the Care Twin contract.

Implementation note:

- The app intentionally falls back to the single approved room art for actions whose dogless room or Phoenix strip is not ready. This keeps the main dog visually coherent and avoids the duplicate-avatar problem while allowing finished tracks to use layered sprite rendering.

## 2026-06-16 Layered Sprite Runtime Pass

Added the real runtime seam for video-game Phoenix animation:

- Added `SpriteSheetPlayer` to crop and animate PNG sprite strips using frame count, fps, loop mode, and 256px slot metadata.
- Added `careTwinAssets.ts` as the mobile asset registry for Phoenix sprite strips and dogless room layers.
- Wired `LivingPhoenixRoom` to switch to layered rendering only when both a dogless room layer and the selected Phoenix sprite strip are registered.
- Preserved the current single-stage room animation as the fallback so Home does not show duplicate Phoenix art while final assets are missing.
- Added `docs/design/CARE_TWIN_ASSET_PIPELINE.md` and `assets/avatar/phoenix/README.md` so Apollo, Fable, Replit, or an artist can generate and register the exact assets.

## 2026-06-18 PixelLab V2 Layered Asset Pass

Activated the first true game-style Phoenix layer:

- Registered PixelLab `idle-breathe`, `tail-wag`, and `sleep-loop` strips in `careTwinAssets.ts`.
- Registered `assets/avatar/rooms/phoenix-room-day.png` as the shared dogless day room layer.
- Kept the asset-readiness gate so unfinished sprite actions do not render over the baked room art.
- Updated the generation log, asset TODO, Avatar Studio notes, and care-twin pipeline docs with the live v2 asset state.

## 2026-06-18 PixelLab V2 Full Sprite Manifest Pass

Expanded the care-twin runtime from proof-of-life loops into full state coverage:

- Added and registered `ear-perk`, `walk-loop`, `eat-loop`, `drink-loop`, `comfort-loop`, `celebrate-hop`, and `health-watch` strips.
- Replaced the first seated walk attempt with a stronger full-body standing walk source and strip.
- Added a PixelLab strip builder that downloads `{i}.png` frame templates, normalizes them into 256px bottom-center slots, and scrubs transparent matte RGB for cleaner previews.
- Added first-pass dogless room variants for night, bedtime, health-watch, and home-alone, then routed sprite actions to the appropriate room mood.
- Kept final illustrated room variants and native device motion QA as the next visual quality gates.

## 2026-06-18 Avatar Studio Live Care Twin Preview Pass

Moved Avatar Studio closer to the selected neo-retro boards:

- Replaced the generic board hero preview on `/portrait` with the same `LivingPhoenixRoom` layered renderer used by Phoenix Home.
- Pointed the scan fallback image at the dogless PixelLab room instead of `assets/board/hero.png`.
- Derived Avatar Studio preview mood from the real care state via `derivePhoenixStatus` and `deriveAvatarMotion`, so the studio inherits the same living dog behavior as Home.
- Added readiness coverage that requires `LivingPhoenixRoom`, PixelLab room art, and the motion/status models on Avatar Studio while forbidding the old board hero reference.

Remaining visual work:

- Replace template tiles with real breed/template preview art instead of icon placeholders.
- Add accessory sprites for collars, bandanas, hats, glasses, and props.
- Run visual QA on a live device/browser preview once the local preview server and package-manager path are available.

## 2026-06-18 Avatar Studio Template Catalog Pass

Upgraded the Template tab from icon placeholders into a real character catalog:

- Generated and promoted a 12-item PixelLab template thumbnail pack covering Shepherd, Retriever, Husky, Bully, Doodle, Terrier, Hound, Dachshund, Spaniel, Toy, Slender, and Mixed Breed.
- Added `avatarTemplateAssets.ts` as the explicit app registry for `assets/avatar/templates/{templateId}/preview.png`.
- Replaced the template tile icon well in `/portrait` with the registered preview image, a stable art frame, and selected-state badge.
- Added readiness coverage that checks every template preview file exists as an 85x85 PNG and that Avatar Studio uses the preview registry.

Remaining visual work:

- Add template-specific emotes/sprites for launch body classes.
- Add accessory layer PNGs for neck/head/face/body/room/fx slots.

## 2026-06-18 Avatar Studio Base Art Pass

Turned the Template tab into a stronger character creator preview:

- Generated and promoted PixelLab 170x170 base stills for Shepherd, Retriever, Husky, Doodle, Bully, Terrier, Hound, Dachshund, Spaniel, Toy, Slender, and Mixed Breed.
- Split the template asset registry into `preview` and `base` tiers so thumbnails stay compact and hero previews use production-scale character art.
- Updated `/portrait` so the selected template renders its base still in the hero stage, with a subtle breathing motion and fallback to the live Phoenix room for future unfinished templates.
- Updated the template picker to prefer base art where available while keeping all 12 template previews registered.
- Added readiness coverage that checks all 12 base PNG files exist as 170x170 assets and that Avatar Studio uses the base/display registry.

Remaining visual work:

- Generate template-specific emote stills and sprite strips.
- Generate accessory overlay PNGs for neck/head/face/body/room/fx slots.

## 2026-06-18 Avatar Studio Phoenix Emote Pack Pass

Moved the Mood set from repeated head art into a real PixelLab state preview:

- Generated and promoted five new Phoenix emote stills: calm, excited, bored, hungry, and not-feeling-well.
- Normalized existing approved v2 states into the same emote folder for happy, anxious, sleepy, proud, and home-alone.
- Added `avatarEmoteAssets.ts` as the explicit app registry for the 10-state Phoenix/Shepherd pack.
- Updated `/portrait` so tapping a mood tile changes the selected-state art/copy for completed packs while the live Studio room remains the main hero surface.
- Removed the old mood-grid pattern that reused `PIXEL_HEAD_SOURCE` for every state with a color wash.
- Extended `verify-pixellab-assets.js` and mobile readiness tests so every Phoenix emote must exist as a 170x170 PNG.

Remaining visual work:

- Generate matching emote packs for remaining launch templates or decide on shared body-class packs.
- Add accessory overlay PNGs and anchor checks for emote states.
- Add short animation strips for mood transitions after still states are visually approved.

## 2026-06-18 Pixel Rendering And Studio Presentation Pass

Cleaned up the Avatar Studio runtime after Apollo's PixelLab subscription became active:

- Added `pixelRendering.ts` and applied it to room, sprite, template, accessory, and emote image paths so web previews keep nearest-neighbor pixel crispness instead of browser smoothing.
- Updated `LivingPhoenixRoom` with `presentation="studio"` so Avatar Studio can reuse the living care-twin renderer without Home-only HUD overlays, duplicate avatar framing, or clipped status docks.
- Updated `/portrait` to use the Studio presentation as the primary hero, keeping the top pixel ID card and concise hero copy while removing the old static preview/loadout hero path.
- Added the first subscription-backed PixelLab seed animation strips for future movement testing: `pixellab-idle-south-strip.png` and `pixellab-walk-south-strip.png`.
- Fixed the premium revenue builder worktree's Metro resolver and package-local Expo CLI path so Expo web export works again through the local dependency junction.
- Verified `/portrait` and Home with a headless Chrome visual smoke against the exported web build.

Remaining visual work:

- Run native iOS/Android safe-area and frame-rate QA.
- Replace first-pass derived room variants with final illustrated PixelLab/Figma-quality scenes.
- Generate remaining unfinished template emote/sprite packs and true overlay-aligned accessory layers.

## 2026-06-18 Option B Phoenix Source Pass

Recentered the Phoenix identity around Apollo's hard-pixel Option B board:

- Generated a focused PixelLab review pack targeting a crisp German Shepherd / Belgian Shepherd WoofWatcher mascot with sage bandana, copper heart tag, navy outline, and transparent background.
- Selected and downloaded `assets/avatar/phoenix/candidates/option-b-seated.png` and `assets/avatar/phoenix/candidates/option-b-standing.png`.
- Generated and normalized `assets/avatar/phoenix/candidates/option-b-idle-tail-wag-strip.png` and `assets/avatar/phoenix/candidates/option-b-walk-loop-strip.png`.
- Wired the common happy/tail-wag and walk room states to those Option B strips so the first-screen dog reads closer to the mockups.
- Added those source candidates and proof strips to asset verification and mobile readiness checks.
- Updated Avatar Studio so uploaded photos remain reference proof during scan assist instead of becoming the soft hero image.
- Follow-up completed 2026-06-19: expanded Option B into the live Home runtime family so common action states no longer fall back to the older v2 motion art.

Remaining visual work:

- Review the full Option B action family at native phone size.
- Review the dedicated Option B bark/tap reaction at phone size with the rest of the action family.
- Promote approved Option B paths out of `candidates/` after Apollo signs off on the full set.

## 2026-06-19 Option B Phoenix Runtime Pack Expansion

Expanded the selected Option B proof into a practical live runtime family:

- Added a corrected curled rest source at `assets/avatar/phoenix/candidates/option-b-sleep-source.png`.
- Generated and normalized Option B `ear-perk`, `bark-reaction`, `eat-loop`, `drink-loop`, `sleep-loop`, `comfort-loop`, `health-watch`, and `celebrate-hop` strips.
- Rewired `careTwinAssets.ts` and `avatarLifeEngine.ts` so common Home states use Option B strips instead of older v2 action art.
- Replaced the temporary bark fallback with the dedicated Option B bark/tap reaction strip.
- Added readiness coverage for the Option B filenames, frame counts, and PNG dimensions.

Remaining visual work:

- Review all Option B loops on native iOS/Android or simulator-sized previews.
- Review the dedicated Option B bark/tap reaction at native phone size alongside the other loops.
- Promote approved Option B paths out of `candidates/` after phone-size approval.
- Replace first-pass room variants with final illustrated rooms that match the reference boards.

## 2026-06-18 Avatar Studio Live Template Routing Pass

Tightened the care-twin creator toward the Option B neo-retro digital pet boards:

- Updated the preview motion model so completed template sprite packs are treated as live animated previews instead of truthful-but-flat starter stills.
- Expanded the `/portrait` hero stage with a stronger pixel-room floor, frame lines, and a compact live status chip so the selected care twin reads as one in-scene game sprite.
- Kept the still template image hidden while a live sprite is active, preventing the double-avatar/ghost-avatar problem Apollo called out.
- Rebuilt the Expo static web export and verified the route is serving locally at `http://127.0.0.1:4192/portrait`.
- Browser DOM inspection confirmed the live Studio view is loading the Phoenix room, Shepherd base, and `tail-wag` sprite strip as the primary preview.

Remaining visual work:

- Capture native iOS/Android screenshots for final safe-area, animation pacing, and phone-size sprite proportion QA.
- Review all launch-template live sprite packs on native iOS/Android and refine weak gait loops.
- Add artist-reviewed overlay alignment for accessories so hats/collars/bandanas stay locked to each breed's body anchor.

## 2026-06-18 Dachshund Live Sprite Pack Pass

Added the first long-body Avatar Studio live template pack:

- Generated a PixelLab side-view Dachshund live source from the approved base template and accepted it over a prompt-only backup source because the silhouette and palette were stronger.
- Promoted two transparent 2048x256 sprite strips under `assets/avatar/templates/dachshund/sprites/`: `idle-tail-wag-strip.png` and `walk-loop-strip.png`.
- Registered the Dachshund pack in `avatarTemplateSpriteAssets.ts`, added it to the live-template preview model, and kept unfinished templates on honest still previews until their live packs were generated.
- Extended `verify-pixellab-assets.js` and mobile readiness coverage so Dachshund live strips must remain present at 8-frame, 256px-slot dimensions.

Remaining visual work:

- Run native phone-size QA across every completed template sprite pack and refine any weak gait loops.
- Add Dachshund emote stills and overlay-aligned accessories after the remaining body-class motion packs are complete.
- Native phone-size QA should confirm the short-leg walk loop reads clearly in the Avatar Studio room.

## 2026-06-18 Spaniel Live Sprite Pack Pass

Added a long-ear sporting-body Avatar Studio live template pack:

- Generated a PixelLab side-view Spaniel live source from the approved front-facing base template so the walk loop starts from a real game-sprite stance.
- Promoted two transparent 2048x256 sprite strips under `assets/avatar/templates/spaniel/sprites/`: `idle-tail-wag-strip.png` and `walk-loop-strip.png`.
- Registered the Spaniel pack in `avatarTemplateSpriteAssets.ts`, added it to the live-template preview model, and kept the still-preview regression test on the remaining unfinished launch templates until the final packs were generated.
- Extended `verify-pixellab-assets.js` and mobile readiness coverage so Spaniel live strips must remain present at 8-frame, 256px-slot dimensions.

Remaining visual work:

- Run native phone-size QA across every completed template sprite pack and refine any weak gait loops.
- Add Spaniel emote stills and overlay-aligned accessories after the remaining body-class motion packs are complete.
- Native phone-size QA should confirm the floppy-ear idle and walk rhythm stays readable in the Avatar Studio room.

## 2026-06-18 Toy, Slender, and Mixed Live Sprite Pack Pass

Completed the remaining launch-template live rig coverage:

- Generated PixelLab side-view live sources for Toy Breed, Slender, and Mixed Breed from their approved front-facing base templates.
- Promoted six transparent 2048x256 sprite strips under `assets/avatar/templates/{toy,slender,mixed}/sprites/`: `idle-tail-wag-strip.png` and `walk-loop-strip.png` for each template.
- Registered Toy, Slender, and Mixed in `avatarTemplateSpriteAssets.ts` and `avatarPreviewModel.ts`, so every non-Phoenix launch template now routes to a live sprite pack.
- Replaced the old unfinished-template regression test with a catalog-level test that asserts every non-Phoenix launch template is live.
- Extended `verify-pixellab-assets.js` and mobile readiness coverage so all launch-template live strips must remain present at 8-frame, 256px-slot dimensions.

Remaining visual work:

- Run native iOS/Android phone-size QA for all template idle/walk loops, especially Toy's small contact-shadow frames and the long-leg Slender gait.
- Generate remaining template emote still packs or shared body-class emote packs.
- Add overlay-aligned accessory layers so collars, hats, bandanas, beds, and effects track each body type cleanly during animation.

## 2026-06-18 Retriever Starter Emote Pack Pass

Expanded Avatar Studio beyond a Phoenix-only mood system:

- Generated and promoted a complete 10-state Retriever emote still pack for Happy, Calm, Excited, Bored, Hungry, Anxious, Sleepy, Proud, Home Alone, and Not Feeling Well.
- Added `retriever-starter` to the avatar config contract and made the Retriever template recommend that pack.
- Updated `avatarEmoteAssets.ts` with selected-template routing so Phoenix/Shepherd uses Phoenix states, Retriever uses Retriever states, and unfinished templates fall back to their own base stills instead of displaying the wrong dog.
- Updated `/portrait` mood previews and accessibility labels to refer to the selected template instead of hard-coded Phoenix.
- Extended readiness coverage and PixelLab asset verification so all Retriever emote PNGs are checked as 170x170 assets.

Remaining visual work:

- Generate emote packs for the remaining launch templates or shared body classes.
- Add short sprite strips for Retriever/body-class motion once still states are approved.
- Add true overlay-aligned accessory layers across templates.

## 2026-06-18 Husky Starter Emote Pack Pass

Added a visually distinct spitz/working-body Avatar Studio pack:

- Generated and promoted a complete 10-state Husky/Spitz emote still pack for Happy, Calm, Excited, Bored, Hungry, Anxious, Sleepy, Proud, Home Alone, and Not Feeling Well.
- Added `husky-starter` to the avatar config contract and made the Husky / Spitz template recommend that pack.
- Extended `avatarEmoteAssets.ts` selected-template routing so Husky uses Husky states, Retriever uses Retriever states, Phoenix/Shepherd uses Phoenix states, and unfinished templates keep honest base-art fallback.
- Extended readiness coverage and PixelLab asset verification so all Husky emote PNGs are checked as 170x170 assets.

Remaining visual work:

- Generate emote packs for the remaining launch templates or shared body classes.
- Add short sprite strips for Retriever/Husky/body-class motion once still states are approved.
- Add true overlay-aligned accessory layers across templates.

## 2026-06-18 Bully Starter Emote Pack Pass

Added the first compact-body Avatar Studio pack:

- Generated and selected a complete 10-state Bully emote still pack for Happy, Calm, Excited, Bored, Hungry, Anxious, Sleepy, Proud, Home Alone, and Not Feeling Well.
- Re-ran the Home Alone and Not Feeling Well prompts with stronger emotional reads before accepting the final files.
- Added `bully-starter` to the avatar config contract and made the Bully template recommend that pack.
- Extended `avatarEmoteAssets.ts` selected-template routing so Bully uses Bully states, Husky uses Husky states, Retriever uses Retriever states, Phoenix/Shepherd uses Phoenix states, and unfinished templates keep honest base-art fallback.
- Extended readiness coverage and PixelLab asset verification so all Bully emote PNGs are checked as 170x170 assets.

Remaining visual work:

- Generate emote packs for the remaining launch templates or shared body classes.
- Add short sprite strips for Retriever/Husky/Bully/body-class motion once still states are approved.
- Add true overlay-aligned accessory layers across templates.

## 2026-06-19 Quick Log Doctrine Pass

Locked the mobile logging UX to the product doctrine:

- Tap on Log launcher tiles now creates a structured quick log when it is safe to do so.
- Long press on a launcher tile opens the detailed composer instead of relying on unsupported hard-press behavior.
- Medication and health/vomit-style logs route to the detailed sheet by default so the app does not fake safety-critical proof.
- Meal quick logs now record `served` with `mealLifecycle: outcome-pending`, served amount, expected portion, household visibility, trust state, and confirmation metadata instead of pretending the dog ate everything.
- The Home quick-log buttons now use the same `buildQuickLogEntry` contract as the Log route, so Home, diet progress, Care IQ, pending meal loops, and reports consume the same event shape.
- Potty is now the launcher parent action; pee/poop remain outcomes inside the detailed potty model.
- The Log detail sheet can close an open meal loop with Ate all, Ate most, Refused, or Still grazing while preserving audit history.

Remaining UX work:

- Add a richer structured edit sheet for every log type, including exact eaten amount edits, medication proof/photo, potty consistency, and walk session updates.
- Continue detail/proof work for medication, potty, walk, photos, confirmation/rejection, and correction history.

## 2026-06-19 Alone Time Lifecycle Pass

Alone Time is now a first-class household status loop:

- Tapping Alone Time when no session is open starts a real `home-alone` session instead of saving a completed duration guess.
- The active Log card shows Phoenix is home alone, elapsed time, and the approved I'm Home return check-in outcomes: Calm, Excited, Anxious, Barking/whining, Accident, Vomit, Destructive, and Unknown.
- Return check-in can include recovery minutes and a note about what helped.
- The same original log is updated on return with duration, outcome, end time, returned-by, household visibility, and audit history.
- Home now reads the active session and changes the first-screen presence from "with human" to "home-alone" while routing the presence card back to Log.

Remaining UX work:

- Promote this pattern into a dedicated Household Pulse screen when that route becomes first-class.
- Add notification/reminder support for long active sessions after push notification permissions and settings exist.

## 2026-06-19 Care Log Trust Review Pass

The Log detail sheet now treats care-log trust as a real workflow instead of raw metadata:

- Pending, confirmation-required, proof-requested, rejected, corrected, and estimated logs show a compact `Trust review` panel near the top of the sheet.
- Adult owner and primary caregiver roles get four explicit actions: Confirm, Reject, Request photo, and Mark corrected.
- Kid, sitter, trainer, and vet-viewer roles see a locked review state and cannot mutate trust state from the UI.
- Request photo is intentionally a truthful proof-request status, not a fake upload claim; actual attachment capture/upload remains a later slice.
- Rejected logs stay in history with watch severity instead of being deleted, so reports and household review can see that a correction happened.
- Generic detail rows skip raw fields such as `trustState`, `confirmationRequired`, `confirmationReason`, and proof timestamps because those now belong to the review panel.

Design intent:

- Keep serious household trust visible without making everyday logging feel punitive.
- Use board-style panels, small uppercase kickers, status badges, and two-column action buttons so the review flow feels native to the neo-retro care console.
- Preserve the audit trail below the review panel so every correction stays explainable for owners, sitters, and later Care Pass exports.

## 2026-06-19 Detailed Log Trust Defaults And Timeline Attention Pass

Detailed composer logs now use the same trust contract as quick logs:

- Long-press/detail-sheet saves call the shared trust-default helper before the log is committed.
- Medication detail logs start with pending confirmation and a proof-needed placeholder state, without claiming a photo was attached.
- Safety-critical health logs start pending review, and kid/helper detail logs remain owner-reviewable even for casual care types.
- Timeline rows now show compact attention chips beside sync status so owners can spot unresolved loops before opening a sheet.
- Attention chips use direct labels: Needs review, Proof needed, Photo requested, Outcome pending, Rejected, Corrected, and Estimated.
- Raw proof policy metadata stays out of generic detail rows; it belongs in the Trust review panel and timeline attention state.

Design intent:

- Make the timeline feel operational, not just historical.
- Keep high-trust care moments visible while preserving the fast tap/long-press logging rhythm.
- Give Fable/Replit a clear chip vocabulary to polish without changing the underlying trust behavior.

## 2026-06-19 Medication Proof Attachment Seam Pass

The medication Trust review panel now has a real local proof attachment seam:

- Proof-needed medication logs can open the image picker from the detail sheet.
- Attaching a proof photo stores local URI/name/source metadata, attached-by/at metadata, local-only storage status, and an audit event.
- The log remains pending adult confirmation after proof is attached; a photo is evidence, not automatic approval.
- Timeline chips now include Proof attached so owners can tell that evidence exists before opening the sheet.
- The detail panel shows the attachment name and the explicit storage boundary: Local-only proof saved. Cloud storage is not enabled yet.
- Raw attachment URI and storage metadata stay hidden from generic detail rows so the UI remains owner-readable.

Design intent:

- Make medication proof feel serious and concrete without pretending cloud document storage exists.
- Keep the next visual pass focused on the Trust review panel, timeline chips, and attachment action as one coherent medication workflow.
- Preserve the future upload seam for Supabase/storage or another approved provider.

## 2026-06-19 Potty Detail Correction Pass

The Log detail sheet now supports a parent-potty clarification flow:

- Quick tap can still create a fast Potty attempt log.
- Opening that log later shows Clarify potty log with outcome, location, pee detail, stool consistency, stool color, and context.
- Saving details uses a tested helper that rewrites stale pee/stool fields when the outcome changes, so a corrected "Tried, nothing" log does not keep old diarrhea/dark-pee metadata.
- Accident, urgent, straining, and stool-watch details set watch/alert severity when warranted, but the copy stays observational and non-diagnostic.
- The update appends audit history and preserves routine/household visibility context.

Design intent:

- Keep the fast log action under five seconds.
- Let the household clarify real-life ambiguity later.
- Make the panel feel compact and operational, not like a medical form.

## 2026-06-19 Walk Session Lifecycle Pass

Walk now behaves like a live care session when started from Home or Log:

- Tapping Walk starts one household-visible in-progress walk log.
- Home shows Walk active in Phoenix's room, the presence strip, and Next Up instead of pretending the walk is already complete.
- Re-tapping Walk while a session is active routes toward the Log finish flow.
- Log shows a compact WALK ACTIVE panel with timer, route/place, distance, dog-interaction count, social outcome, and notes.
- Finishing the walk updates the same log with duration and audit history, so Records Walk Activity and Saved Routes get one coherent source event.

Design intent:

- Make the walk flow feel like a tiny real-world game session without adding GPS complexity yet.
- Preserve the fast tap behavior while keeping detail capture available at the meaningful finish moment.
- Give the next visual polish pass a clear active-state surface to animate around.

## 2026-06-19 Correction History Detail Pass

Log details now show a correction-first audit summary:

- Correction history appears above the raw Audit trail.
- The card summarizes whether the log is original or traceable, the latest update, the correction count, and changed-field chips.
- The full Audit trail still remains below for exact create/edit/sticky-note/delete/proof history.

Design intent:

- Make trust and corrections readable for normal household users.
- Keep the actual audit evidence intact for sitter, trainer, vet, and owner handoff contexts.
- Avoid turning every edit into a scary warning; corrections are framed as traceability.

## 2026-06-19 CareTwin Roster Readiness Pass

More now has a CareTwin Roster board card:

- The primary dog is the only live care twin.
- Future dogs can be staged through Add future dog.
- Future dogs render as provider-gated planned slots with a lock icon and explanatory tap behavior.
- The card shows Live, Future, and Gated counts so the state is understandable at a glance.
- The bottom sheet copy clearly says separate logs, routines, and records stay locked until multi-dog storage is approved.

Design intent:

- Make the long-term CareTwin platform visible without lying about current backend capability.
- Keep the roster compact and operational, like a professional household setting rather than a marketing teaser.
- Avoid a dead-end feeling by giving the user a useful action now: stage a future pet and understand what is required for true switching.

## 2026-06-17 Avatar Studio Lite Pass

Rebuilt the mobile Avatar Studio route from a one-photo portrait generator into a template-based care-twin creator:

- Added `PetAvatarConfig`, 12 dog templates, accessory slots, emote states, truthful scan-suggestion copy, and config normalization in `avatarStudio.ts`.
- Extended `AvatarContext` so the app stores an editable avatar config alongside the existing custom mood-image set.
- Reworked `/portrait` into Avatar Studio Lite with Scan, Template, Customize, and Emotes tabs.
- Added mock scan review for Phoenix that suggests the Shepherd template and detected traits without claiming perfect AI generation.
- Added coat-color, face-marking, accessory-slot, template, and emote preview controls.
- Connected the saved avatar identity to Home and More so the Studio feeds the visible app experience.
- Replaced the previous painted portrait fallback with pixel-derived Phoenix preview assets from the approved room board.
- Added pixel mood defaults and a pixel head asset so Avatar Studio, WoofGuide, and default avatar rendering stay in the neo-retro pixel direction.
- Added a no-dependency static preview server for Expo exports so stale dev tabs can be bypassed during design QA.

Design boundary:

- The route can say upload photos help suggest a care twin.
- It cannot claim live AI scan or full custom sprite generation until those provider-backed systems are implemented.
- Current previews use pixel-derived Phoenix placeholders until final template/sprite assets are produced.
