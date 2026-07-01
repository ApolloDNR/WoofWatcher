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
- Converted Alone Time, Grooming Care, Incident Watch, and Medication Plan into shared `BoardCard` sections.
- Preserved medication routine navigation, adherence stats, next-dose state, follow-ups, medication history search, outcome filters, and all medication accessibility labels.
- Removed the now-unused Records-only `padCard`, `sectionHeader`, and `sectionTitle` styles so the screen no longer carries a parallel card vocabulary.
- Added mobile readiness tests for Care Trends, Dog ID heading, Alone Time, Grooming Care, Incident Watch, and Medication Plan board anatomy.

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

## 2026-06-19 Access Pass And My Care Today Pass

More now separates three household concepts:

- Household Access is account/team readiness.
- Access Passes are temporary helper permission drafts.
- My Care Today is the current human's assigned care workload.

Design notes:

- Access Passes use a compact board-card model with Active, Upcoming, and Draft metrics, permission-boundary copy, local draft rows, and a Share Draft Summary action.
- The Access Pass bottom sheet follows the existing mobile sheet pattern with helper name plus role chips for sitter, trainer, vet viewer, and emergency helper.
- My Care Today uses routine-board truth to show assigned, open, overdue, and next assigned care without adding a new navigation dead end.
- The UI explicitly says provider-backed sharing is not live, so the app does not imply remote permissions before authorization rules exist.

## 2026-06-19 Adventure Mode Foundation Pass

Adventure Mode now exists as a real mobile route rather than a future idea:

- More links to Adventure Mode as a private care quest surface.
- The route frames Adventure as `Private RPG`, not public maps or AR.
- The hero shows Phoenix's current level, today's XP, memory count, and the next available quest.
- Quest cards show available, complete, and locked states from real household-visible care evidence.
- The proof section shows which care logs powered the current adventure state.
- Save Memory creates a local/private memory draft and adds it to the Memory shelf.
- Share copy is text-only and includes the private household boundary.

Design intent:

- Make the app feel more alive and game-like while staying grounded in real care.
- Keep the "wow" layer tied to actions the household actually performed.
- Leave room for future map/photo/community polish without implying those providers are already live.

## 2026-06-19 Home Adventure Entry Pass

Phoenix Home now exposes Adventure Mode inside the existing Care Quest board:

- Home derives `deriveAdventureMode` from the same care document as the dedicated Adventure route.
- The Care Quest board shows the next adventure quest, level, today's XP, and memory count.
- The strip routes directly to `/adventure`.
- The entry stays secondary to Phoenix Room, presence, Next Up, and Quick Log so Home remains navigable instead of becoming a marketing page.

Design intent:

- Make the real-care RPG loop visible in the first five seconds.
- Avoid burying Adventure Mode in More while still preserving the launch nav structure.
- Give the next design pass a focused strip to polish rather than an unbounded new section.

## 2026-06-20 Incident Watch Pass

Incident Watch is now a real behavior-safety workflow instead of a health-only proxy:

- Log includes Incident as a detail-first action for rough greetings, dog conflict, snap/bite, escape, injury, and other behavior-safety events.
- The Incident composer captures trigger/context, exposure, injury check, action taken, follow-up, sticky notes, and household visibility.
- Serious incident language routes through the same owner-review/trust model used for other safety-critical logs.
- Records now uses the shared Incident Watch model for status, 7/30/90-day counts, triggers/exposures, factual rows, and boundary copy.
- Care Pass reports include Incident Watch context for sitter, trainer, vet, and caregiver handoff.

Follow-up polish added 2026-06-20:

- The shared Incident Watch model now derives trend direction, follow-up tasks, and trainer goal suggestions.
- Records shows Trend signal, Follow-up plan, and Trainer goals inside the Incident Watch board.
- Follow-up rows route to the Incident composer or trainer Care Pass preview, keeping the screen actionable.
- Care Pass reports include trend, owner follow-up, and trainer goal lines for handoff context.

Design intent:

- Keep incident logging factual, calm, and easy to review.
- Avoid blame, diagnosis, or alarmist behavior language.
- Make the flow useful for real households, trainers, sitters, and vets without making the app feel scary.

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

## 2026-06-21 Mobile Interaction Contract Pass

The mobile UI now treats safe areas, keyboard offsets, modal reach, and tap
targets as part of the design system:

- `mobileLayout.ts` owns top safe-area padding for tabbed, standalone, setup,
  and auth surfaces.
- Modal sheets use shared bottom padding so bottom actions clear the home
  indicator on iOS and Android system navigation.
- Centered quick-note modals use shared top/bottom backdrop padding.
- Setup, Records sheets, Log quick-note prompts, and WoofGuide composer/review
  surfaces use shared keyboard offsets.
- Board route icon buttons, pills, and care rows now enforce 48px mobile touch
  targets.
- Inline action links use a shared hit slop constant instead of route-local
  `8` or `10` values.

Design intent:

- Make the app feel planned as one native mobile product instead of a collection
  of individually tuned screens.
- Keep the neo-retro board style while making touch, sheets, and keyboards feel
  App Store-ready.
- Leave the exact constants adjustable after native iOS/Android screenshot QA.

## 2026-06-21 Launch Readiness Cockpit

More now treats launch readiness as an operational cockpit, not a static badge:

- `launchReadiness.ts` derives the launch status from native evidence, local
  release foundations, provider configuration, safety/legal gates, payments, AI,
  storage, push notifications, account deletion, support, and store-account
  approval.
- The More screen renders six compact tiles: iOS + Android, Care Sync, Records
  Storage, WoofGuide, WoofWatcher Plus, and Store Gates.
- The badge can truthfully say Internal Preview, Native QA Open, Provider Gated,
  Approval Open, or Store Ready.
- Store Ready cannot appear until every required local, provider, native, and
  approval gate is satisfied.

Design intent:

- Give Apollo and future builders one clear place to see why the app is not
  launch-ready yet.
- Keep the card compact enough for mobile while still making every blocker
  actionable.
- Let the next visual polish pass improve the tile art/animation without
  weakening the truth model.

## 2026-06-21 Attachment Storage Queue

More's Launch Readiness card now gets concrete storage context from a shared
attachment manifest instead of generic copy:

- `attachmentManifest.ts` collects local medication proof photos, record
  attachments, Adventure memory photos, Care Pass print artifacts, and QA
  screenshots.
- Manifest items are classified as local-only, upload-ready, or provider-saved,
  keeping the UI truthful before cloud storage exists.
- The Records Storage launch tile can now say how many local files are gated and
  name the types of files involved.

Design intent:

- Make storage readiness feel operational and specific for Apollo and future
  builders.
- Preserve the local-first experience while making the future Supabase/storage
  migration path explicit.
- Avoid fake cloud sync, fake uploads, or hidden local-only media.

## 2026-06-21 Privacy Files Count

Privacy & Safety now uses the same attachment queue as Launch Readiness:

- The Export summary Files stat counts local proof photos, record attachments,
  Adventure memory photos, Care Pass print artifacts, and QA screenshots.
- Launch safety copy names the local queue when uploads are disabled.
- Deletion request copy explicitly asks for local attachment queue review before
  destructive deletion.

Design intent:

- Make data ownership feel complete and trustworthy.
- Keep the owner-facing privacy surface aligned with the real storage model.
- Avoid implying cloud deletion/export exists before provider object storage is
  implemented.

## 2026-06-21 Privacy Attachment Queue Review

Privacy & Safety now shows a real Attachment queue board:

- Each local file class is grouped by source: care proof photos, record
  documents, Adventure memories, Care Pass reports, and QA screenshots.
- Rows show count, status, safe action, storage-boundary detail, and sample
  filenames.
- Empty state copy stays explicit instead of implying hidden cloud sync.

Design intent:

- Make owner data control feel complete and navigable.
- Keep local-first storage limits visible without turning the screen into a
  technical admin console.
- Prepare the surface for provider object ids and signed downloads later.

## 2026-06-21 Release Packet Surface

More's Launch Readiness area now has an owner/operator handoff layer:

- A shared `releasePacket.ts` model converts launch readiness into a release
  score, verdict, gate rows, owner approvals, blockers, next actions, and
  handoff notes.
- The mobile More screen shows the score and verdict under the launch gates so
  the owner can tell the difference between internal-preview confidence and
  public-launch readiness.
- The Share Launch Packet action uses native sharing with safe text for Apollo,
  testers, future builders, or a store-prep collaborator.

Design intent:

- Make launch state feel like a professional release cockpit, not a vague card.
- Give Apollo a clean handoff artifact while keeping all provider/native/store
  blockers explicit.
- Avoid fake App Store, Play Store, payment, AI, storage, or deletion claims.

## 2026-06-21 Support Runbook Surface

Privacy & Safety now includes the support/legal launch gate:

- `supportRunbook.ts` derives the support inbox, refund/subscription policy,
  veterinary/emergency boundary, privacy/terms links, deletion escalation, and
  incident-response readiness.
- The Privacy screen renders a Support runbook card with a short launch-gate
  chip, verdict text, status rows, blocker callout, and native share action.
- The default state remains blocked/manual until Apollo supplies approved
  support, legal, refund, deletion, and incident-response details.

Design intent:

- Make launch blockers feel actionable instead of buried in docs.
- Keep payment/public-account readiness honest and owner-reviewed.
- Preserve the health boundary: WoofWatcher organizes dog care, but it is not
  veterinary advice, diagnosis, treatment, or emergency triage.

## 2026-06-21 Launch Support Profile Sheet

Privacy & Safety now makes the support runbook configurable instead of static:

- The Support runbook card reads from `state.launchSupportProfile`, so support
  email, policy URLs, refund/subscription approval, veterinary-boundary
  approval, deletion escalation, and incident response all come from persisted
  local care data.
- The new edit action opens a compact bottom sheet with release-style inputs and
  checkbox rows for the owner launch checklist.
- The sheet has separate draft and owner-reviewed saves, and the copy explicitly
  says local owner review does not equal legal, store, or provider approval.

Design intent:

- Let Apollo close real launch details inside the app without turning the screen
  into a technical settings dump.
- Keep the Support runbook card actionable and honest: the app can stage the
  packet locally, but public launch remains blocked until real approvals exist.
- Preserve mobile reachability by using the shared modal bottom-padding helper.

## 2026-06-21 Owner-Staged Launch Cockpit

More's Launch Readiness cockpit now understands staged owner review without
turning it into final launch approval:

- More derives the Support runbook from `state.launchSupportProfile`, then
  passes owner-reviewed privacy/legal and support-runbook flags into the shared
  launch-readiness model.
- The Store Gates tile can show `Owner packet staged` when Apollo has locally
  reviewed the support/privacy packet, while still keeping account deletion,
  push notifications, app-store setup, final legal/provider approval, and
  support approval open.
- Blocker copy now names staged packets separately from untouched approval
  gaps, which makes the release cockpit feel more professional and less vague.

Design intent:

- Reward real owner progress without fake App Store, Play Store, legal, support,
  notification, deletion, or provider readiness claims.
- Keep Apollo's next action clear: owner packet staged locally, final approvals
  still required before public launch.
- Preserve the app's launch-truth doctrine in both the UI and shared model.

## 2026-06-21 Store Submission Packet

More's Launch Readiness surface now includes a separate Store Submission prep
panel:

- `storeSubmissionPacket.ts` converts the release packet into store metadata,
  keyword draft, screenshot checklist, review notes, privacy disclosures, and
  blocked-until gates.
- The More screen shows the store-prep verdict, screenshot count, short
  description, and first review note directly under the release packet.
- A separate Share Store Packet action exports the store-prep text without
  mixing it up with the operator launch packet.

Design intent:

- Help Apollo and future store-prep collaborators move faster without hiding
  blockers.
- Keep App Store / Play Store submission copy truthful: preparation is allowed,
  approval is not implied.
- Make screenshot and privacy-review needs visible in the app, not just docs.

## 2026-06-21 Store Screenshot QA Cockpit

The internal `/care-twin-qa` route now turns store-submission screenshot needs
into real QA work, not a static checklist:

- `mobileReleaseQa.ts` maps the Store Submission screenshot checklist into
  phone-review surfaces with explicit iOS and Android evidence requirements.
- The QA cockpit now has a Store Screenshot QA section with a store-boundary
  card, share action, and per-screen Pass/Needs tune cards.
- Store screenshots feed the same platform evidence math as the launch workflow
  surfaces, so the cockpit can show how many iOS/Android slots remain open.
- Store prompts ask reviewers to avoid private household data and unfinished
  provider claims in screenshots.

Design intent:

- Make App Store / Play Store preparation operational and visual.
- Keep screenshot capture tied to the actual app routes Fable/Replit/Apollo will
  polish.
- Preserve trust: store screenshots are evidence for review, not submission
  approval.

## 2026-06-21 Saved QA Proof In Launch Readiness

More's Launch Readiness card now reacts to the saved `/care-twin-qa` session:

- `mobileLaunchQaEvidence.ts` builds the same launch/store QA surface set used
  by the QA cockpit and derives the native QA summary from saved status, notes,
  and screenshot evidence.
- More reloads that local QA session on focus, so returning from the QA route
  can update the iOS + Android launch tile from generic device-proof copy to the
  exact missing-evidence state.
- Empty sessions intentionally return no native QA summary. This prevents the UI
  from implying device proof exists just because a local QA route is present.

Design intent:

- Make launch readiness feel connected to real review work.
- Keep the visual system honest: progress is earned by attached device evidence,
  not decorative status badges.
- Give Apollo, Fable, and future QA collaborators a direct loop from screenshot
  capture to launch decision clarity.

## 2026-06-21 Native QA Next Captures

Launch Readiness now includes a compact capture queue:

- `mobileLaunchQaEvidence.ts` ranks open Mobile Release QA and Store Screenshot
  QA surfaces by launch-critical priority.
- More renders `Native QA Next Captures` below the launch notice with complete
  and open counts, the next target screens, missing evidence text, and route
  jumps.
- Rows stay concise and action-oriented so QA does not become another
  checklist page hidden away from the operator cockpit.

Design intent:

- Make the next device-testing move obvious in under five seconds.
- Keep the launcher useful even before provider-backed storage exists.
- Preserve the premium operating-system feel: every status points to a real
  next action.

## 2026-06-21 Native QA Share Plan

The launch cockpit can now hand off the next device-testing steps:

- `mobileLaunchQaEvidence.ts` formats the current capture queue into a
  shareable QA script with route targets, missing evidence, attached counts, and
  a clear done condition.
- More adds a compact `Share QA Plan` button inside `Native QA Next Captures`
  using the same dark primary action language as the launch packet controls.
- The action is intentionally attached to the live capture queue, not a static
  doc, so the shared checklist follows the saved local QA session.

Design intent:

- Let Apollo coordinate real-device QA from the phone without rewriting the
  checklist.
- Make tester handoff feel professional and operational.
- Keep the launch boundary explicit: the shared plan guides evidence capture,
  not App Store or Play Store approval.

## 2026-06-21 Provider Launch Setup

Launch Readiness now includes an operator-grade provider setup panel:

- The panel shows Provider Launch Setup progress as a compact score plus the
  first open/ready production gates, matching the premium board-card visual
  language instead of adding a generic settings table.
- Edit Provider Plan opens a bottom sheet with checkbox-style production gates
  for auth, database, storage, AI, payments, push, store accounts, and account
  deletion.
- Share Provider Plan exports the same setup model as plain text for Apollo,
  Fable/Replit, or a developer handoff.
- The UI copy keeps the boundary visible: provider setup is not App Store or
  Play Store approval, and partial approval is treated as owner-reviewed until
  every gate is actually ready.

Design intent:

- Move launch work from vague blocker lists into the app's actual operating
  cockpit.
- Keep final production setup calm, serious, and truthful while still feeling
  like part of the WoofWatcher system.
- Make the final handoff easier for Apollo: one screen now shows native QA,
  provider setup, launch packet, and store packet.

## 2026-06-22 Home Care-RPG Mission Deck

Phoenix Home now has a real command-center layer between the living room hero
and the older utility cards:

- `homeMissionDeck.ts` builds four missions from local-first product state:
  My Care Today, Adventure, Health Watch, and Care Pass.
- Pending care loops stay operational. A served meal with outcome pending routes
  to `/log?type=meal`; active walk or alone-time sessions route to Log; ordinary
  next care routes to Plans.
- Adventure, Health, and Care Pass missions route to `/adventure`, `/health`,
  and Records so the Home screen mirrors the final care-RPG boards without
  creating dead panels.
- The UI uses a dark navy pixel-console treatment with compact rows, status
  labels, pixel icons, and short CTAs. It is intentionally not a marketing hero
  and does not claim live cloud sync or provider readiness.

Design intent:

- Make Home answer "what should I do next?" in one glance while keeping Phoenix's
  room as the emotional center.
- Move the app closer to the saved mockups: premium, neo-retro, operational,
  and RPG-flavored without losing health/care seriousness.
- Give Fable/Replit/future design polish a stable, tested structure to style
  instead of asking them to invent navigation architecture.

## 2026-06-22 Home Mission Phone-Fit Contract

The Home mission deck now has a shared layout model for phone-size QA:

- `homeMissionLayout.ts` derives compact versus regular mission density from
  viewport width.
- Small iPhone-class widths hide the secondary Care RPG badge, tighten row
  height, use one-line mission details, and keep icons/CTAs compact.
- Regular phone and web-preview widths keep the richer two-line mission detail
  treatment from the mockups.
- The model estimates mission-deck height and keeps rows above the shared mobile
  touch-target floor.
- Home uses `useWindowDimensions` and attaches the layout QA label to mission
  rows, so testers can confirm whether they are reviewing the compact or regular
  treatment.
- Static readiness tests now protect the Home wiring so future polish cannot
  accidentally turn the mission deck back into an unbounded card stack.

Design intent:

- Make the first-screen command center more resilient before real device QA.
- Preserve the premium care-RPG look while avoiding small-phone overflow.
- Keep native screenshots as the required final proof; this contract is a
  pre-device guardrail, not a replacement for iOS/Android inspection.

## 2026-06-23 Home Mission Deck Native QA Gate

The Home mission deck is now part of the internal release QA cockpit:

- `mobileReleaseQa.ts` includes a launch-critical `Home Mission Deck` surface.
- `/care-twin-qa` inherits that surface automatically through the shared
  Mobile Release QA model.
- Required proof asks for iOS and Android compact-deck screenshots, floating
  paw-nav visibility, no-overflow review, and route checks for pending meal,
  active walk/alone, Adventure, Health, and Care Pass missions.
- `mobileReadiness.test.ts` now ties the Home mission deck, compact layout
  contract, and release QA surface together.
- `mobileLaunchQaEvidence.ts` preserves release-surface order within each
  priority group, so the shareable native QA plan starts with Phoenix Home and
  Home Mission Deck before lower-sequence launch-critical surfaces.

Design intent:

- Keep the flagship Home command layer aligned with the saved mockups and
  ready for real phone review.
- Make Fable/Replit/Apollo testing concrete: capture this exact section,
  verify the route behavior, then tune the first visible issue.
- Prevent later visual polish from treating the mission deck as decorative
  when it is actually a launch-critical care workflow surface.
- Keep the QA script aligned with the app's hierarchy: first prove the emotional
  Home experience, then the care-command layer, then the supporting surfaces.

## 2026-06-26 Care Pass Report History Storage Truth

Records now treats saved Care Passes as serious handoff artifacts without
pretending provider storage is already connected:

- Care Pass artifacts default to `local-only` storage state.
- The shared care-domain helper returns owner-readable storage labels/details
  for local-only, upload-ready, uploaded, and failed provider states.
- Records shows the storage label and `Cloud storage pending` detail directly in
  Report History, beside resend and printable-source share actions.
- Mobile readiness protects the storage helper import and UI wiring so later
  visual polish cannot hide the local/provider boundary.

Design intent:

- Make the report history feel more professional and honest for sitters, vets,
  trainers, and Apollo's beta helpers.
- Preserve the premium app-store polish while clearly separating local artifacts
  from future cloud/PDF storage.

## 2026-06-26 Provider-Aware Report Storage Status

Records now uses the Provider Launch Setup storage state when describing saved
Care Pass report history:

- If storage provider setup is not configured, saved Care Passes still show as
  device-local print sources.
- If storage provider setup is configured, the same local print source shows as
  ready to upload instead of pretending it has already uploaded.
- The storage detail keeps the product boundary visible: signed access,
  retention, export, and deletion rules are still required before cloud storage
  can be treated as provider-backed.

Design intent:

- Give beta helpers a clearer production-readiness signal inside the app.
- Keep the UI polished and useful while preventing false cloud/PDF claims.
- Connect Records, Care Pass, and Provider Launch Setup into one coherent
  handoff story for Replit/Fable/native implementation work.

## 2026-06-27 Phoenix Home First-Screen Layout Contract

Phoenix Home now has a responsive first-screen composition helper instead of a
single hardcoded room aspect ratio:

- `homeFirstScreenLayout.ts` owns compact/balanced/showcase density,
  hero aspect ratio, Care Twin button sizing, presence-card overlap, status
  tile sizing, and a mission-deck peek estimate above the floating paw nav.
- The Home route consumes those values for the pixel room, presence card, and
  status tiles so the first viewport stays closer to Apollo's mockups on
  iPhone-class widths.
- `homeFirstScreenLayout.test.ts` protects iPhone preview, compact-phone, and
  touch-target constraints.
- `mobileReadiness.test.ts` now checks that Home stays wired to the first-screen
  layout contract and the real mission deck.

Design intent:

- Keep Phoenix Room as the emotional first impression while exposing enough of
  the care-command layer to feel like a polished app, not a static scene.
- Prevent the floating paw nav from visually eating the first useful mission
  content on owner-preview screens.
- Give Fable/Replit/native polish a stable tuning surface for later visual
  passes without weakening the care workflow.

## 2026-06-27 Health Watch Care Status Polish

Health Watch now follows the reference-board health screen more closely:

- The first Health card is a cream `CARE STATUS` console rather than a dark
  generic hero.
- A pixel medallion carries `GOOD`, `WATCH`, or `REVIEW` from the derived
  health score.
- The score is shown as both a number and a horizontal track, matching the
  retro HUD language from the boards.
- Appetite, hydration, energy, and vomiting use shared `StatusMeter` segmented
  rows instead of loose text badges.
- A 7-day rhythm strip uses recent care logs minus watch signals to give the
  screen a light RPG progress feel while staying tied to real care data.
- The page now says `Health observations, not diagnosis` directly inside the
  console so the serious health boundary is visible before the deeper pattern
  cards.

Design intent:

- Make Health feel calm, trustworthy, and premium without drifting into
  diagnosis or treatment claims.
- Bring the Health/Bile screen closer to the saved Option B boards and App
  Store-quality mobile hierarchy.
- Keep playful pixel meters connected to real care logs, not fake game chores.

## 2026-06-27 Quick Log Workflow Polish

Quick Log now teaches the core interaction model directly in the interface:

- A compact rail above the launcher grid says `Tap`, `Hold`, and `Edit later`,
  matching Apollo's locked logging doctrine.
- Launcher detail sheets now show the same mode rail from the shared
  `describeQuickLogDetailSheet` model, so safe quick logs and detail-first
  safety logs explain themselves consistently.
- The detail sheet now reminds owners that Timeline stays editable, so a fast
  meal, potty, walk, or training log can be corrected, confirmed, updated, or
  given sticky notes later.
- Safety-critical logs still route to full details first, while routine care
  keeps the quick-log path fast.

Design intent:

- Make the Log screen feel like a planned product workflow, not a grid of
  disconnected buttons.
- Preserve the under-five-second quick-log loop while making long-press detail
  and later edits discoverable.
- Keep the UI close to the premium neo-retro boards: compact, useful, playful,
  and trustworthy.

## 2026-06-27 Log Detail Control Polish

Log detail sheets now read more like durable care records:

- A compact `Review / Edit / Sticky / Audit` command rail appears near the top
  of each record so the owner immediately sees the available workflow.
- The Audit chip switches from generic guidance to the live event count when
  audit history exists.
- The bottom action cluster is labeled `Record controls`, then exposes handoff,
  sticky note, edit, and delete buttons with accessible labels.
- Primary and icon record controls now use the shared 48px mobile touch-target
  contract and tighter board-style 8px radius.

Design intent:

- Make every log feel editable, trustworthy, and navigable after the quick tap.
- Reinforce Apollo's doctrine that fast logging is safe because details,
  corrections, sticky notes, and audit history remain available afterward.
- Keep the Log/Timeline surface closer to an established App Store product:
  readable hierarchy, clear controls, no mystery icons, no dead ends.

## 2026-06-27 Avatar Studio Scan Truth Polish

Avatar Studio now explains the real scan-to-pixel pipeline directly in the UI:

- `AVATAR_SCAN_WORKFLOW_STEPS` locks the route to `Photo reference`, `Template
  match`, `Pixel twin`, and `Owner approval`.
- The Scan tab now shows truth chips for `PixelLab-backed template catalog` and
  `Not a photo filter`.
- A compact four-card pipeline appears before Gallery/Take Photo so owners know
  exactly what happens before they upload a reference photo.
- Scan suggestion copy now says photos guide a PixelLab template suggestion,
  then the owner approves the match before it becomes the live avatar.

Design intent:

- Make the avatar hook feel premium, magical, and honest: real dog photos
  guide a pixel care twin, but the current mobile app does not claim live AI
  generation.
- Keep the route strongly aligned to the saved mockups: pixel assets, live
  sprite packs, clear owner approval, and no blurry photo-as-avatar shortcut.
- Give Fable/Replit/native polish a durable product contract for later scan UI
  animation and PixelLab production work.

## 2026-06-27 Records Care Pass Export Manifest Polish

Records Report History now presents saved Care Pass artifacts as a clear export
manifest:

- `describeCarePassArtifactExport` returns four manifest rows: `Format`,
  `Source`, `PDF`, and `Storage`.
- Each row has a label, value, and short detail so the user can understand the
  printable HTML source, restored/generated source state, PDF boundary, and
  local/provider storage state at a glance.
- Records renders the manifest as a compact two-column board grid under the
  existing storage/PDF detail copy and above resend/print-source actions.

Design intent:

- Make Care Pass feel like a serious handoff product for vets, sitters,
  trainers, and owners.
- Keep export truth visible: printable HTML exists today; generated PDF and
  provider upload remain pending until real services are configured.
- Improve scanability for App Store-quality Records without adding fake cloud
  or fake PDF claims.

## 2026-06-27 Living Care Twin Motion Recipe Polish

Phoenix's room now has a stronger one-dog animation contract:

- `motionRecipeForSpriteAction` defines action-specific body motion for every
  runtime sprite action: bob, sway, tilt, scale pulse, and shadow pulse.
- `LivingPhoenixRoom` applies that recipe to the single layered sprite rig,
  making happy idle, walking, eating, drinking, sleeping, comfort, health watch,
  celebration, and tap bark states feel different in motion.
- The ground shadow now pulses with the same recipe so Phoenix feels grounded
  in the room instead of pasted over the background.

Design intent:

- Move closer to the video-game/Tamagotchi feel Apollo wants without adding a
  second dog avatar or fake decorative mascot.
- Keep the real care twin as the main character: all reactions happen on
  Phoenix's primary sprite rig.
- Leave native `/care-twin-qa` as the final proof path for phone-size crop,
  jitter, and motion readability.

## 2026-06-27 Provider Launch Setup Next-Gate Polish

More's Launch Readiness provider panel now behaves more like an operator handoff
instead of a passive checklist:

- `deriveLaunchProviderSetup` exposes `openCount` and a source-backed
  `nextGate`, so the UI and share packet agree on the next production provider
  blocker.
- The More panel highlights `Next provider gate` with owner, next action, and
  proof required before the row list.
- The visible provider rows prioritize open gates before ready gates, so a
  partially configured setup does not hide later production blockers.
- The share packet adds a `Next Provider Gate` section and still states that
  provider setup is not App Store or Play Store approval.

Design intent:

- Make the launch cockpit clearer for Apollo and outside builders during the
  two-day beta push.
- Preserve the truthful boundary: Clerk, Supabase, storage, AI, payments, push,
  store accounts, and deletion only become ready when real proof is entered.
- Keep the provider panel compact and mobile-readable while making the next
  action obvious.

## 2026-06-28 Health Review Packet Share Polish

Health Watch now turns the review packet into a shareable owner handoff:

- The Health Review Packet section keeps the current calm status, suggested
  prompts, vet-share checklist, and boundary copy.
- A compact `Share review` button sits directly under the boundary so the user
  can send the packet without hunting through Records or Care Pass first.
- The share text is generated by `buildHealthReviewPacketShareText`, so the UI
  action and tests agree on the same non-diagnostic language.
- The action uses the shared 48px mobile touch-target contract to stay
  thumb-safe on phone-sized Health Watch.

Design intent:

- Make Health Watch feel like a serious App Store-quality care surface, not a
  passive dashboard.
- Give owners a fast way to send organized observations to a vet or caregiver
  while preserving the boundary that WoofWatcher does not diagnose.
- Keep the Health tab aligned with the product promise: pattern organization,
  caregiver clarity, and useful handoff, not medical certainty.

## 2026-06-28 Mood And Energy Trend Polish

Mood logging now behaves like a real care signal instead of a decorative
reaction:

- Quick Log Mood keeps the familiar fast mood selector but adds structured
  energy level, household visibility, care context, and a sticky-note prompt in
  the full composer.
- Records Mood Trend now uses a shared care-domain model to show status,
  average score, energy mix, latest caregiver/context, and next-step copy.
- The UI language stays observational: `Mood steady`, `Worth watching`, latest
  context, and household trend copy, not diagnosis or behavior certainty.
- The implementation avoids a broad `origin/main` merge that conflicted with
  the richer premium branch and instead ports the durable care logic cleanly.

Design intent:

- Make Phoenix's mood/energy loop feel connected to real household care, the
  living care twin, and future WoofGuide summaries.
- Keep detailed logging optional and fast enough for mobile, while still
  giving serious patterns enough evidence for caregiver, trainer, or vet review.
- Preserve the neo-retro board polish by showing compact status/energy chips
  and latest-context proof instead of a generic analytics block.

## 2026-06-28 Static Beta Preview Handoff

The exported web beta now has a first-class preview command instead of relying
on an ad hoc foreground Node process:

- Root `preview:mobile-beta` delegates to the mobile `preview:smoke` script.
- Mobile `preview:smoke` and `preview:web` both serve the `.expo-smoke` export
  at `http://127.0.0.1:4194/`, matching the in-app browser preview tab Apollo
  uses during design review.
- `serve-smoke-preview.js` defaults to port `4194`, blocks path traversal with
  a root-relative check, and clearly tells reviewers to keep the terminal open.
- The mobile beta doctor proof command list now includes `preview:smoke` after
  `smoke:web`, so Replit, Fable, or a device helper cannot stop at export-only
  evidence when the next step is owner visual review.

Design intent:

- Make previewing the exact exported beta boring and repeatable under the
  two-day deadline.
- Preserve truth: the static preview proves the local/PWA beta can open; it is
  not native iOS/Android proof, provider approval, or store approval.

## 2026-06-28 Home Immediate Action Reorder

Phoenix Home now puts the fast operational actions closer to the locked mobile
mockups:

- `Next Up` and `Quick Log` now render directly after the living Phoenix room
  and status strip.
- The richer navy care-RPG mission deck still exists, but it now follows the
  immediate care loop as premium context instead of blocking it.
- A mobile readiness guard protects this order so future visual polish cannot
  bury the under-five-second owner actions below secondary story/progress UI.

Design intent:

- Make the first owner-review path answer "what is next?" and "what can I log
  now?" faster.
- Keep the Home surface serious enough for real household care while preserving
  the neo-retro game layer as delight.
- Move the screen closer to Apollo's selected reference boards without
  weakening the truthful launch boundaries around native, provider, and store
  proof.

## 2026-06-28 Home Quick Log Header Action

The Home Quick Log card no longer shows a dead-looking `Open` label:

- The header action is now a real `Pressable` route target that opens the full
  Quick Log screen at `/log`.
- The action uses the shared mobile touch-target minimum and inline hit slop so
  it stays thumb-safe beside the section title.
- A mobile readiness guard now protects the route target, accessibility label,
  and touch-target style.

Design intent:

- Remove a first-screen dead affordance before owner preview.
- Let users jump from the compact Home grid to the full detailed logging system
  without hunting for the bottom tab.
- Keep Home aligned with the premium-app rule that every visible control has a
  real purpose.

## 2026-06-28 Home Section Action Polish

Phoenix Home now removes two more mockup-style dead affordances:

- `Recent activity / View all` is a real `Pressable` accessory that opens the
  full Log timeline at `/log`.
- `Phoenix status / View full report` is a real `Pressable` accessory that
  opens Health Watch at `/health`.
- Both actions use the shared inline hit slop and minimum mobile touch target,
  so they remain thumb-safe in the compact board layout.
- A mobile readiness guard protects the route targets, accessibility labels,
  and shared touch-target style.

Design intent:

- Keep Home feeling like established app software, not a static presentation
  board.
- Make first-screen review actions navigable and purposeful while preserving
  the locked neo-retro pixel visual direction.
- Continue the screen-by-screen pass toward mockup accuracy without adding fake
  provider, native, store, or PDF readiness claims.

## 2026-06-28 Home Next Up Status Pill

Phoenix Home now treats the compact `Next Up` count as state, not a fake
action:

- `Next Up / 1 of N` now renders the count as a shared `BoardPill` accessory.
- The old `BoardSectionHeader action` label is test-blocked so the first screen
  does not regress to passive text that looks tappable.
- The Quick Log and owner-preview header actions remain real pressable route
  targets; only the passive count became a pill.

Design intent:

- Keep the first screen honest and polished at the App Store preview level.
- Preserve the five-second Home scan: what is next, how many care items are in
  the queue, and where to act.
- Continue aligning Home with the locked mockups without inventing provider,
  native, PDF, store, or AI readiness.

## 2026-06-28 Health Header Action Polish

Health Watch now treats compact header labels as real app actions:

- `Health Snapshot / 7-day view` is a thumb-safe `HealthHeaderAction` that
  returns the screen to the top health rhythm view instead of acting like static
  decorative copy.
- `Pattern Board / Owner notes` now opens the symptom/health note composer in
  Quick Log, so owners can add the observation evidence the screen asks for.
- Both actions use the shared inline hit slop and minimum mobile touch target.
- Mobile readiness now guards the reusable Health header action, route target,
  scroll target, accessibility labels, and shared touch-target style.

Design intent:

- Make Health Watch feel calmer and more established while preserving the
  non-diagnostic medical boundary.
- Keep mockup-style labels honest: if an element looks tappable, it must either
  route somewhere useful or stop looking like a control.
- Continue visible Health mockup accuracy without claiming native proof,
  provider-backed storage, generated PDF, store approval, or veterinary advice.

## 2026-06-28 Log Status Pill Polish

Quick Log now separates status labels from real actions:

- `Choose care type / Fast tap` now renders `Fast tap` as a `BoardPill`
  accessory, so it reads like a quick-mode status instead of a dead button.
- `Today at a glance / N logged` now renders the count as a success status pill
  instead of a section action.
- `Find care logs / Filtered` now appears only as a filter-state pill when
  filters are active.
- The mobile readiness guard now protects these status accessories and prevents
  the old mockup-style action labels from coming back.

Design intent:

- Keep the Log screen feeling like established mobile software: tappable things
  should perform an action, while passive state should look like passive state.
- Preserve the quick, game-like rhythm of logging without creating dead ends.
- Move the high-frequency Log workflow closer to the locked mockups while
  keeping the app truthful about provider, native, PDF, and store readiness.

## 2026-06-28 Records Status Pill Polish

Records and Care Pass now treat dense header metrics as status badges instead
of passive action text:

- `Care Trends`, `Weight Trend`, `Mood Trend`, `Hydration`, `Walk Activity`,
  `Training Progress`, `Alone Time`, `Grooming Care`, `Potty Health`,
  `Care Pass`, `Report History`, and `Records Cabinet` now render their
  compact labels through shared `BoardPill` accessories.
- The badge tones now match the care state: steady signals use sage, watch
  states use amber/rose, hydration/reporting use navy, and Care Pass uses
  copper.
- Real actions on Records remain real press targets, including dog ID share,
  printable credential share, Care Pass rows, report resend/print, report
  share, diet edit, and record creation.
- The mobile readiness guard now blocks `BoardSectionHeader action=` on the
  Records route and requires the key status labels to stay on `BoardPill`.

Design intent:

- Make Records feel like an established, high-density mobile product instead
  of a prototype with decorative labels.
- Keep the serious record, report, and Care Pass surfaces visually aligned with
  the neo-retro board system without creating dead ends.
- Preserve the truth boundary: no generated PDF, provider upload, native beta,
  or store approval is implied by these visual status badges.

## 2026-06-28 Premium Status Pill Polish

Premium now uses the shared board anatomy for revenue-facing status labels:

- `Why upgrade` shows the number of value signals as a `BoardPill` accessory
  instead of a passive section action.
- `Plans` shows `Checkout gated` as an amber `BoardPill`, keeping the screen
  honest that production checkout is not wired yet.
- `Launch entitlements` shows `Current: Free` as a primary `BoardPill` while
  preserving real actions for the launch checklist and back navigation.
- The mobile readiness guard now blocks `BoardSectionHeader action=` on the
  Premium route and requires the key Premium labels to stay on `BoardPill`.

Design intent:

- Keep the monetization surface polished without implying live payments.
- Make passive launch/revenue states look like status, not dead controls.
- Preserve the product truth boundary: no provider-backed checkout, app-store
  subscription, native beta, generated PDF, or store approval is implied by
  this visual polish.

## 2026-06-28 Adventure Status Pill Polish

Adventure Mode now treats quest and memory counts as status badges instead of
mockup-style action text:

- `Next quest` shows `Start simple` or `Ready` as an amber `BoardPill`
  accessory.
- `Quest board` shows the quest count as a primary `BoardPill`.
- `Care proof` shows today's proof count as a sage `BoardPill`.
- `Memory shelf` shows `Private` or `Empty` as a copper `BoardPill`.
- The mobile readiness guard now blocks `BoardSectionHeader action=` on the
  Adventure route and requires the key Adventure labels to stay on `BoardPill`.

Design intent:

- Keep Adventure Mode feeling like a polished care-RPG surface without fake
  buttons.
- Preserve the real actions: save private memory, share Adventure summary, and
  back navigation.
- Keep the product truth boundary clear: memories remain local/provider-gated
  until storage rules and account sync are actually approved.

## 2026-06-28 Avatar Studio Status Pill Polish

Avatar Studio now keeps scan, template, customization, and emote state in
shared `BoardPill` accessories instead of passive header actions:

- `Generated mood set` shows `Owner review` as a status badge.
- `Bring your dog in` shows `Start` or `Configured` as a status badge.
- `Choose base template` shows the live sprite-pack count as a status badge.
- `Coat colors`, `Face and ears`, `Accessories`, and `Mood set` render their
  editable/current state as badges.
- The mobile readiness guard now blocks `BoardSectionHeader action=` on the
  Avatar Studio route and requires the core studio labels to stay on
  `BoardPill`.

Design intent:

- Make Avatar Studio feel like a real product studio instead of a mockup with
  decorative labels.
- Keep real actions reserved for gallery, camera, template selection,
  customization controls, mood previews, save, reset, and back navigation.
- Preserve the scan-to-pixel truth boundary: this is PixelLab/template-assisted
  owner approval, not a fake live photo-to-avatar claim.

## 2026-06-28 WoofGuide Status Pill Polish

WoofGuide now keeps AI-assistant state labels visually honest through shared
`BoardPill` accessories instead of passive header actions:

- `Quick questions` shows `Tap to ask` as a sage status badge.
- `Suggested actions` shows `Owner reviewed` as an amber status badge.
- The real WoofGuide actions remain the quick-question chips, suggested action
  rows, text/send controls, owner-review modal, and back navigation.
- The mobile readiness guard now blocks `BoardSectionHeader action=` on the
  WoofGuide route and requires the core assistant labels to stay on
  `BoardPill`.

Design intent:

- Make WoofGuide feel like a polished in-app assistant surface, not a mockup
  with fake action text.
- Preserve the product truth boundary: the route remains owner-reviewed and
  non-diagnostic, with no fake live AI/provider/veterinary readiness implied by
  the visual polish.

## 2026-06-28 Privacy Status Pill Polish

Privacy & Safety now keeps launch-readiness and export state in shared
`BoardPill` accessories instead of passive header actions:

- `Export summary` shows `Local bundle` as a sage status badge.
- `Attachment queue` shows the local attachment count as a copper status badge.
- `Support runbook` shows `Launch gate` as an amber status badge.
- `Launch safety gates` shows the gate count as a primary status badge.
- The real Privacy actions remain close/back, export care data, deletion
  request, launch support profile edit, support runbook share, and modal save
  controls.
- The mobile readiness guard now blocks `BoardSectionHeader action=` on the
  Privacy route and requires the core launch-safety labels to stay on
  `BoardPill`.

Design intent:

- Make the launch trust surface feel like established product infrastructure
  instead of a checklist mockup.
- Preserve the product truth boundary: local export, local attachment queue,
  provider-gated storage, support readiness, deletion request, and launch
  policy status remain explicit without implying public-launch approval.

## 2026-06-28 Setup, Plans, and QA Status Pill Polish

Setup, Plans, and Care Twin QA now keep section state in shared `BoardPill`
accessories instead of passive header actions:

- Setup `Setup progress` shows the saved-foundation count as a primary status
  badge.
- Setup `After save` shows `Review` as an amber status badge.
- Plans `Upcoming Events` shows the upcoming-day count or `Add one` as a
  primary status badge.
- Plans `Reminder Center` shows `Clear` or the active reminder count as a
  status badge.
- Care Twin QA `Launch Workflow QA` shows platform-proof completion or the
  missing-proof label as a status badge.
- Care Twin QA `Store Screenshot QA` shows the store-submission verdict as a
  copper status badge.
- Care Twin QA `Device Review Matrix` shows the scenario count as a navy status
  badge.
- The mobile readiness guard now blocks `BoardSectionHeader action=` on Setup,
  Plans, and Care Twin QA and requires these labels to stay on `BoardPill`.

Design intent:

- Make the remaining setup, planning, and launch-review surfaces feel like
  established app infrastructure instead of decorative mockup labels.
- Keep real actions reserved for saving the foundation, finishing later,
  adding/editing plans, logging routines, reminder rows, attaching proof,
  sharing QA/store packets, opening review surfaces, and back navigation.
- Preserve the truth boundary: no provider-backed sync, native-device proof,
  store approval, generated PDF, AI/payment/push readiness, or public-launch
  approval is implied by this polish.

## 2026-06-28 Home Quick Log Long-Press Detail Polish

Home Quick Log now follows the locked logging doctrine more closely:

- Tap still performs the fast default quick-log behavior.
- Long press now opens the typed Log detail flow through `/log?type=...` for
  Meal, Walk, Potty, Water, Training, Treat, and Play.
- The `More` tile keeps routing to the full Quick Log surface.
- Shared `QuickActionTile` now supports `onLongPress`, `delayLongPress`, and
  explicit screen-reader hints so future quick-action surfaces can offer the
  same fast/detailed split without custom one-off code.
- The mobile readiness guard now protects the Home quick-log long-press
  contract and verifies the route target stays typed.

Design intent:

- Keep common care logging under five seconds from Home.
- Give owners a clear path to add details without forcing every quick log into
  a full form.
- Preserve the truth boundary: this is detail routing into the existing Log
  workflow, not a fake Home bottom sheet or fake native haptic requirement.

## 2026-06-28 Home-to-Log Detail Sheet Intent Polish

Home long-press quick actions now open the compact Log launcher sheet directly
instead of only selecting the Log route:

- Home sends a unique detail intent through `/log?type=...&detail=1&intent=...`.
- Log reads `type`, `detail`, and `intent` route params, selects the matching
  launcher action, and opens the existing bottom-sheet launcher detail flow.
- Repeated Home long presses receive a fresh intent so the sheet can reopen
  cleanly after the user leaves and returns.
- The Log route guards against stale route params by remembering the last
  consumed detail intent.
- The mobile readiness guard now requires Home long press to target the
  detail-sheet route contract and requires Log to consume that intent through
  the launcher sheet.

Design intent:

- Match the product doctrine: tap is instant, hold is detail.
- Keep the detail UI compact and familiar by reusing the Log launcher sheet.
- Avoid a disconnected Home-only form that would drift from meal lifecycle,
  potty, medication, trust, sticky-note, and edit/audit logic.

## 2026-06-28 Home Quick Log Undo and Add Details Polish

Home quick taps now get the same safety affordance expected from the locked
logging doctrine:

- A successful Home quick log keeps a longer feedback toast with `Undo` and
  `Add details` actions.
- `Undo` deletes the just-created local care entry instead of asking owners to
  hunt through Timeline.
- `Add details` routes to `/log?entry=...` and Log opens the saved entry detail
  sheet for the exact event.
- Log now accepts an `entry` route param and ignores stale entry params after
  consuming them once.
- The feedback toast uses real pressable actions with mobile touch targets
  instead of a passive status-only notification.

Design intent:

- Make fast logging feel safe enough for real household use.
- Preserve speed while giving owners a clean recovery path for accidental taps.
- Keep follow-up details attached to the actual saved log so audit, sticky
  notes, trust review, and future corrections remain connected.

## 2026-06-28 Home Pending Meal Open-Loop Routing Polish

Home pending-meal cards now route to the exact saved meal log instead of a
generic Meal composer:

- When Home detects a served/grazing meal with an unresolved outcome, it builds
  `/log?entry=...` from that meal id.
- `Next Up` now uses a single `nextUpRoute`: pending meals open the exact log,
  active walk/alone loops open Log, and ordinary scheduled care opens Plans.
- The care-RPG mission deck accepts `/log?entry=...` routes so its open-loop
  mission can also point at the real record.
- Existing Log `entry` route handling opens the detail sheet for that exact
  event, where owners can update meal outcome, add sticky notes, correct, or
  review trust/audit context.

Design intent:

- Make "Dinner served - outcome pending" feel like a real workflow, not a
  decorative status.
- Keep the served-to-outcome meal lifecycle attached to one household record.
- Preserve the fast Home scan while sending follow-up taps to the right place.

## 2026-06-28 Home Recent Activity Exact-Log Routing Polish

Home `Recent activity` rows now open the exact saved care log instead of
staying passive:

- The Home recent activity view model keeps the source `entry.id`.
- Each recent activity row uses the entry id as its stable key.
- Tapping a row routes to `/log?entry=...`, using the existing Log entry-detail
  flow for sticky notes, outcome updates, corrections, trust review, and audit
  history.
- Rows carry explicit screen-reader labels such as `Open recent care log:
  Breakfast`.
- The shared `CareRow` primitive accepts an explicit `accessibilityLabel` so
  route-backed rows can describe their destination without inventing one-off
  wrappers.

Design intent:

- Make every visible care item on Home useful and navigable.
- Keep owner preview loops tight: see a recent log, tap it, edit the actual
  source record.
- Preserve the under-five-second Home scan while removing decorative dead ends.

## 2026-06-28 Home HUD Status Tile Routing Polish

Home's first-screen status HUD now behaves like a real care command surface:

- `Happiness` opens the Mood detail flow through
  `/log?type=mood&detail=1&intent=...`.
- `Energy` opens Health Watch.
- `Hunger` opens More with Diet Profile details expanded through
  `/more?section=diet`.
- `Bond` opens the Play detail flow through
  `/log?type=play&detail=1&intent=...`.
- Each HUD tile is a pressable, accessible button with a label that explains
  the visible value and destination.
- More reads the `section=diet` route param and expands the Diet Profile card
  without pretending a dedicated Diet route exists yet.

Design intent:

- Make the pixel HUD feel game-like without becoming decorative.
- Let owners jump from a status concern directly to the right care workflow.
- Preserve the current mobile nav while making Diet & Treats easier to reach
  from the Home screen.

## 2026-06-28 Health Snapshot Care Action Polish

Health Snapshot cards now act like care controls instead of static signals:

- `Activity` opens the Walk detail flow.
- `Appetite` opens the Meal detail flow.
- `Stool` opens the Potty detail flow.
- `Hydration` opens the Water detail flow.
- `Energy` opens the Mood detail flow.
- `Vomiting` opens the Symptom/Vomit detail path.
- The Health hero `Log health note` button and Pattern Board `Owner notes`
  action now use the same `/log?type=...&detail=1&intent=...` route contract.
- Each card has a small action chip and an accessibility label that names the
  signal, current status, evidence detail, and destination action.

Design intent:

- Make Health Watch feel like a calm command center instead of a passive
  report.
- Keep health language observational and non-diagnostic while making it easy to
  add the next piece of evidence.
- Reuse the existing Log detail-sheet flow so appetite, stool, hydration,
  energy, and vomiting context stays connected to Timeline, sticky notes, trust
  review, Care Pass, and reports.

## 2026-06-28 Plans Reminder Detail-Intent Polish

Plans Reminder Center now sends safety and follow-up reminders into the compact
typed Log detail flow:

- Medication reminder rows open `/log?type=medication&detail=1&intent=...`.
- Grooming reminder rows open `/log?type=grooming&detail=1&intent=...`.
- Routine reminders still open the routine editor because the owner may need to
  edit responsibility, time, or assignment.
- Record reminders still open Records because the owner needs the vault context.

Design intent:

- Keep Plans aligned with the locked logging doctrine: reminders should lead to
  the exact care workflow, not a generic screen.
- Preserve the shared Log detail sheet as the single source of truth for
  medication proof, grooming notes, sticky notes, trust review, audit history,
  Records, and Care Pass evidence.
- Reduce owner-preview dead ends before native iOS/Android capture while staying
  honest that provider sync, push notifications, payments, AI, PDFs, and store
  approval are still gated.

## 2026-06-28 Plans Routine Log Recovery Polish

Plans Daily Routine quick logging now uses the same recoverable logging doctrine
as Home:

- Tapping a routine `Log done` button still records the routine quickly.
- The created care entry id is captured immediately after `addEntry`.
- A bottom-safe feedback bar confirms the routine log and offers `Undo` plus
  `Add details`.
- `Undo` deletes the exact created entry, so accidental routine taps do not
  pollute household history.
- `Add details` routes to `/log?entry=...`, opening the real source log for
  notes, sticky notes, corrections, trust review, and audit history.
- The feedback bar uses strong navy/copper treatment, accessible labels, and
  minimum mobile touch targets.

Design intent:

- Keep routine completion under five seconds while making the action safe.
- Treat Plans as part of the same logging system as Home and Log, not a separate
  shortcut with weaker recovery.
- Preserve the care-operation feeling: visible routines should resolve into
  editable household evidence.

## 2026-06-28 Avatar Studio PixelLab Truth Polish

Avatar Studio no longer exposes mock-era scan language in the care-twin path:

- The template suggestion helper is named `buildTemplateScanSuggestion`.
- The working scan badge says `PixelLab template match`.
- The support copy says provider scanning can plug in later, while the current
  build ships the PixelLab template matcher, character creator, and emote
  preview system.
- The readiness contract guards against bringing back `Scan assist mock` or
  `True AI scanning plugs in later` copy.

Design intent:

- Keep the product promise truthful without making Avatar Studio feel temporary.
- Match Apollo's PixelLab direction: photos guide a pixel-template suggestion,
  but the saved care twin remains an editable pixel character.
- Preserve trust for store screenshots and owner previews by avoiding visible
  mock, fake AI, or fake provider readiness language.

## 2026-06-28 Adventure Quest Action Polish

Adventure Mode quests now behave like real care-operation cards:

- Each `AdventureQuest` has an action contract and visible action label.
- Sniffari walks start or reopen a walk-session proof log.
- Training and play quests create typed care evidence with adventure context.
- Memory-photo quests save the existing private adventure memory.
- Completed quests open their exact proof log through `/log?entry=...`.
- Newly-created quest evidence shows `Undo` and `Add details` recovery actions.
- `Undo` deletes the exact entry; `Add details` opens the real log for notes,
  sticky notes, trust review, corrections, and audit history.

Design intent:

- Make Adventure Mode feel like a care RPG without turning it into fake chores.
- Keep the game layer attached to real household evidence, reports, Timeline,
  and Care Pass sources.
- Preserve the under-five-second loop while giving owners a clean recovery path
  after quick quest actions.

## 2026-06-28 Adventure Next-Quest CTA Polish

The top `Next quest` card now uses the same action model as the Quest Board:

- The primary CTA no longer always says `Save Memory`.
- The CTA derives the current quest proof id before rendering.
- It shows `Start walk`, `Log training`, `Log play`, `Save memory`, `Open proof`,
  or `Locked` from the actual quest state.
- It calls `startQuest(availableQuest, availableQuestProofEntryId)` so the top
  card creates or opens the same source-backed evidence as the quest rows.
- Locked quests are disabled instead of acting like a fake action.

Design intent:

- Make the first Adventure action obvious and accurate.
- Keep the care-RPG promise tied to real logs instead of confusing owners with
  a memory button before a real outing exists.
- Reduce visible mockup drift by making the hero-level task behave like a
  polished App Store screen, not a prototype shortcut.

## 2026-06-28 Adventure Care Proof Routing Polish

Adventure Mode `Care proof` rows now behave like source evidence:

- Completed proof rows open `/log?entry=...` for the exact saved care log.
- Rows are pressable, haptic, screen-reader labeled, and use the shared 48px
  mobile touch-target contract.
- A chevron affordance makes the row feel inspectable instead of decorative.
- The proof still displays XP, but XP is treated as a reward attached to real
  household care evidence.

Design intent:

- Keep the care-RPG layer connected to editable logs, sticky notes, trust review,
  audit history, Reports, and Care Pass.
- Avoid a fake-game feeling where proof is only a badge and cannot be inspected.
- Make Adventure Mode feel more like professional app software wrapped in a
  playful pixel world.

## 2026-06-28 Adventure Quest Row Copy Polish

Quest Board action buttons now use the quest's actual action label:

- Available walk quests show `Start walk`.
- Available training quests show `Log training`.
- Available play quests show `Log play`.
- Memory quests can show `Save memory`.
- Completed and locked quests continue to show `Open proof` and `Locked`.

Design intent:

- Keep the Adventure screen scannable in under five seconds.
- Avoid vague prototype copy on a core game/care surface.
- Make every button read like a real next step, not a generic quest command.

## 2026-06-29 Adventure Memory Shelf Polish

Saved Adventure memories now behave like real care-story artifacts:

- Memory rows are pressable instead of static display rows.
- Each row opens the native share sheet with a private text summary.
- The share copy includes the saved title, note, humans, XP, storage status,
  media status, and the provider-gated photo/sync boundary.
- Rows use the shared 48px mobile touch-target contract and explicit
  screen-reader labels.
- A visible `Share` affordance makes the shelf feel like a usable collection,
  not a decorative archive.

Design intent:

- Make Adventure Mode feel alive and collectible while still grounded in real
  household care.
- Preserve privacy by sharing a text summary only; no fake cloud, public feed,
  location sharing, or provider upload is implied.
- Connect the RPG memory layer to practical handoff/sharing behavior the owner
  can understand immediately.

## 2026-06-29 Avatar Studio Creator Control Polish

Avatar Studio customization controls now feel more like deliberate mobile
product controls:

- Studio tabs, coat swatches, face markings, and mood preview chips use named
  handlers instead of anonymous state changes.
- Color, marking, tab, accessory, template, and mood selection all use haptic
  feedback where supported.
- Creator controls use shared inline hit slop in addition to protected 48px
  touch-target sizing.
- Face-marking chips, reset, and save actions now expose explicit labels and
  hints for screen readers.
- Reset clearly restores the draft; Save clearly persists the current local
  pixel-twin configuration.

Design intent:

- Make the editor feel confident and intentional, not like a prototype form.
- Preserve the current PixelLab template-matcher architecture while raising the
  craft of the live customization experience.
- Keep customization fun without hiding what is actually local and owner-saved.

## 2026-06-29 Care Intelligence Action Routing

The Care Intelligence card in More now routes open-loop actions to the right
source of truth:

- Pending meal outcomes open the exact saved meal log through `/log?entry=...`.
- Failed sync actions keep the retry workflow instead of pretending a route fix
  can solve provider/network state.
- Routine actions continue to open Plans/Calendar.
- The shared domain model now carries `targetEntryId` and `targetRoutineId` so
  future Home, WoofGuide, and handoff surfaces can use the same exact targets.

Design intent:

- Make the app feel planned and engineered: smart summaries should lead to the
  exact record that needs owner action.
- Preserve the routines/logs doctrine: open loops are closed on the original
  log or routine, not by creating disconnected duplicate evidence.
- Keep More useful as an owner operations screen, not just a settings drawer.

Verification:

- Focused red/green coverage passed for Care Intelligence and mobile readiness.
- Fresh local verification passed the 411-test mobile/domain behavior suite,
  root TypeScript, mobile TypeScript, PixelLab asset verification, Expo web
  export to `.expo-smoke`, and preview route smoke for Home, More, the targeted
  pending-log route, and Care Twin QA.
- The beta doctor is still environment-blocked until the local shell exposes
  exact `pnpm@10.24.0`; the current bundled CLI is `11.7.0`.

## 2026-06-29 Home Care Intelligence CTA

The Home `Care quest` card now has an actionable first-screen next step:

- The new `Next care move` CTA reads from `careIntelligence.nextAction`.
- Pending meal outcomes and log-detail open loops open the exact saved log with
  `/log?entry=...`.
- Failed sync keeps the refresh/retry workflow instead of pretending a route
  can fix provider state.
- Routine loops open Plans/Calendar, and general care prompts open Log.
- The CTA uses a compact pixel HUD row, haptic feedback, explicit accessibility
  label/hint copy, and the shared 48px mobile touch-target contract.

Design intent:

- Home should answer "what should I do now?" in seconds.
- Smart scores should always point to the real source log or routine that needs
  owner action.
- Keep the premium pixel style functional: the RPG layer should reduce care
  confusion, not decorate around it.

Verification:

- Red/green mobile readiness first failed on the missing Home routing contract,
  then passed 88/88.
- Fresh local verification passed the 411-test mobile/domain suite, root
  TypeScript, mobile TypeScript, PixelLab asset verification, Expo web export,
  preview route smoke for Home, targeted log entry, and Care Twin QA, plus
  `git diff --check`.

## 2026-06-29 Home Today Summary Metric Routing

The Home `Today at a glance` metrics now behave like compact care controls:

- Activity opens the Walk detail flow through
  `/log?type=walk&detail=1&intent=...`.
- Meals opens the Meal detail flow for portions and outcomes through
  `/log?type=meal&detail=1&intent=...`.
- Potty opens the Potty parent detail flow through
  `/log?type=potty&detail=1&intent=...`.
- Each metric cell is a pressable 48px mobile target with a clear
  accessibility label, hint, haptic selection, and route-specific pressed
  border color.
- The route mapping is typed as `TodayMetricTarget`, so future Home metrics can
  be added without turning the first screen into one-off button logic.

Design intent:

- Remove another owner-preview dead end from the flagship Home screen.
- Let Phoenix Home answer "what can I inspect or log now?" without sending
  owners hunting through the full Log tab.
- Keep the neo-retro HUD playful but operational: a metric is useful only if it
  leads to the exact care workflow behind it.

Verification:

- Red/green mobile readiness first failed on the missing Today metric route and
  touch-target contract, then passed 89/89.
- Fresh local verification passed the 412-test mobile/domain suite, root
  TypeScript, mobile TypeScript, PixelLab asset verification, Expo web export,
  and preview route smoke for Home plus Walk, Meal, and Potty detail-intent
  routes.

## 2026-06-29 Home Phoenix Status Meter Routing

The lower Home `Phoenix status` meter stack now behaves like a command surface:

- The shared `StatusMeter` component supports optional `onPress`,
  `accessibilityLabel`, and `accessibilityHint` props.
- Read-only meter usages remain read-only; the 48px pressable row and inline
  hit slop are only used when a caller provides `onPress`.
- Home's Energy meter opens Health Watch.
- Home's Hunger meter opens Meal detail for portions and outcomes.
- Home's Hydration meter opens Water detail.
- Home's Bile Risk meter opens Health Watch and Bile Watch context.
- Home's Bond meter opens Play detail for bond-building care.

Design intent:

- Remove passive duplication from the first screen.
- Let owners move from a status signal directly into the care workflow that can
  improve or explain that signal.
- Keep the premium pixel HUD useful without forcing every shared meter in the
  app to become interactive.

Verification:

- Red/green mobile readiness first failed on the missing pressable meter
  contract, then passed 90/90.
- Fresh local verification passed the 413-test mobile/domain suite, root
  TypeScript, mobile TypeScript, PixelLab asset verification, Expo web export,
  and preview route smoke for Home, Health, Meal detail, Water detail, and Play
  detail routes.

## 2026-06-29 Home Watch Card Deep Links

The Home `Health Watch`, `Bile Watch`, and `Alone Time` watch cards now route to
the specific workflow behind each signal instead of opening broad screens:

- Health Watch opens the Health overview tab with route state.
- Bile Watch opens `/health?tab=bile`, and Health reads the `tab` route param
  to land directly on the Bile Watch panel.
- Alone Time opens the Alone Time detail-intent flow through
  `/log?type=alone&detail=1&intent=...`, preserving the existing return
  check-in panel when a home-alone session is active.
- Each watch card now has an accessibility hint, inline hit slop, haptic
  selection, and a typed `HomeWatchTarget` route helper.

Design intent:

- Keep Home's lower signal row from becoming decorative status chrome.
- Make Bile Watch feel like a first-class product module, not just a Health
  alias.
- Make Alone Time behave like a real household workflow: leave, track, return,
  and log the outcome without duplicate records.

Verification:

- Red/green mobile readiness first failed on the missing watch-card deep-link
  contract, then passed 91/91.
- Fresh local verification passed the 414-test mobile/domain suite, root
  TypeScript, mobile TypeScript, PixelLab asset verification, Expo web export,
  and preview route smoke for Home, Bile Watch deep link, and Alone Time detail
  route.

## 2026-06-29 Home Health Signal Tab Routing

The remaining Home health signals now land on the exact Health Watch tab that
matches the owner's intent:

- Home's Health status tile opens `/health?tab=health`.
- Home's Energy status meter opens `/health?tab=health`.
- Home's Bile Risk status meter opens `/health?tab=bile`.
- The Home mission deck routes `Health Review` to `/health?tab=bile` when bile
  or watch evidence needs review.
- The stable `Health Watch` mission routes to `/health?tab=health`.

Design intent:

- Make Health Overview and Bile Watch feel like distinct, intentional modules.
- Reduce first-screen friction by putting owners exactly where the signal can be
  understood or updated.
- Keep the non-diagnostic health experience calm while making the app feel
  professionally routed rather than stitched together.

Verification:

- Red/green Home mission deck tests first failed on the old generic `/health`
  route, then passed 2/2 after the tab-specific route change.
- Mobile readiness passed 92/92 with a guard for the mission deck and Home
  status-meter route contracts.
- Fresh local verification passed the 415-test mobile/domain suite, root
  TypeScript, mobile TypeScript, PixelLab asset verification, Expo web export,
  and preview route smoke for Home, Health Overview, and Bile Watch routes.

## 2026-06-29 Home And Log Health Entry Routing

The remaining broad Health entry points now land on Health Overview with route
state:

- Home's top health/notification shortcut opens `/health?tab=health`.
- The Phoenix Status `View full report` action opens `/health?tab=health`.
- Quick Log's header Health action opens `/health?tab=health`.
- Bile-specific entry points continue to open `/health?tab=bile`.

Design intent:

- Treat Health Overview as a real destination, not a generic fallback.
- Keep top-bar and section-header actions consistent with the same tab-aware
  navigation contract used by Home cards, status meters, and mission rows.
- Preserve a calm health UX: broad health shortcuts go to overview, bile signals
  go to Bile Watch.

Verification:

- Red/green mobile readiness first failed on the remaining broad Health entry
  points, then passed 92/92 after the route updates.
- Fresh local verification passed the 415-test mobile/domain suite, root
  TypeScript, mobile TypeScript, PixelLab asset verification, Expo web export,
  and preview route smoke for Home, Log, Health Overview, and Bile Watch routes.

## 2026-06-29 Home Next Up Row Routing

The Home `Next Up` list now behaves like an intentional care queue instead of a
single broad shortcut:

- Each `Next Up` row carries its own typed route.
- Active walk rows open the exact source log when possible, or the Walk detail
  sheet when the imported/open session has no id.
- Active home-alone rows open the exact source log when possible, or the Alone
  Time detail sheet when the imported/open session has no id.
- Pending served meals open the exact meal log for outcome updates when
  possible, or the Meal detail sheet as an id-safe fallback.
- Routine rows still route to Plans.
- Starter rows route to the matching Walk, Meal, or Training detail composer.

Design intent:

- Remove a subtle dead-end where every visible row reused the first row's route.
- Keep the first screen dog-care promise direct: tap the row, land where that
  specific care item can be handled.
- Preserve compatibility with older local/imported entries that may not have an
  id.

Verification:

- Red/green mobile readiness first failed on the missing row-level route
  contract, then passed 92/92 after implementation.
- Focused Home/readiness verification passed 94/94.
- Fresh local verification passed root TypeScript, mobile TypeScript, the
  415-test mobile/domain suite, PixelLab asset verification, Expo web export,
  and preview route smoke for Home, source-log entry, Walk detail, Alone Time
  detail, Plans, Health Overview, and Bile Watch routes.

## 2026-06-29 Home Presence Panel Routing

The first-screen presence panel now opens the exact care state behind Phoenix's
status:

- Active home-alone sessions open the source `/log?entry=...` record when the
  entry id exists.
- Active walk sessions open the source `/log?entry=...` record when the entry id
  exists.
- Older imported/id-less active sessions fall back to the matching Alone Time or
  Walk detail sheet through `/log?type=...&detail=1&intent=...`.
- Normal household presence opens `/more?section=household`.
- More renders a top `Household focus` card for that route so the owner lands on
  care-team, household access, and Household Pulse context instead of a generic
  More screen.

Design intent:

- Keep the visual "Phoenix is with..." panel from becoming passive chrome.
- Make active care loops correctable from Home: finish a walk, complete an
  alone-time return check-in, or review the exact source log.
- Make household status discoverable without adding another primary tab.

Verification:

- Red/green mobile readiness first failed on the missing presence-panel route
  contract, then passed 93/93 after implementation.
- Fresh local verification passed root TypeScript, mobile TypeScript, the
  416-test mobile/domain suite, PixelLab asset verification, Expo web export,
  and preview route smoke for Home, Household focus, exact log entry, Walk
  detail, Alone Time detail, Health Overview, and Bile Watch routes.

## 2026-06-29 Home Active Walk Quick Tap

The Home Quick Log grid now treats an already-active walk as a source-backed
open care loop:

- Tapping Walk when no walk is active still starts a fast household-visible walk
  session.
- Tapping Walk while a walk is already active opens the exact saved walk log
  through `/log?entry=...` when the id exists.
- Imported/id-less active walk sessions fall back to the typed Walk detail sheet
  through `/log?type=walk&detail=1&intent=...`.
- The `Walk already active` toast remains, but the next view is now the real
  session that can be finished or corrected.

Design intent:

- Keep the fast tap/long press doctrine intact without creating duplicate walk
  sessions.
- Make the first-screen care loop feel deliberate: repeated Walk taps should
  continue the active session, not start a broad composer detour.
- Preserve edit history, trust review, route notes, and sticky notes on the
  original walk record.

Verification:

- Red/green mobile readiness first failed on the old generic active-walk route,
  then passed 93/93 after implementation.
- Fresh local verification passed root TypeScript, mobile TypeScript, the
  416-test mobile/domain suite, PixelLab asset verification, Expo web export,
  `git diff --check`, and preview route smoke for Home, exact log entry, Walk
  detail, and Household focus routes.

## 2026-06-29 Home Today Command Surface

Phoenix Home now turns the previously model-only Today Command into a visible
owner control:

- A compact `Today Command` strip appears under the four live status tiles.
- The strip uses the tested `deriveTodayCommand` model, not duplicate Home-only
  guesswork.
- Pending meal outcomes route to the exact `/log?entry=...` source log.
- Missed meal, walk, and potty commands route to the detail-first composer
  through `/log?type=...&detail=1&intent=today-command-...`.
- Handoff review routes to the exact latest care log when the day is caught up.
- The strip uses a mapped pixel icon, urgency color, concise CTA, two-line
  detail copy, screen-reader label/hint, and the shared 48px mobile touch
  target.

Design intent:

- Make the release-plan promise of "what should I do now?" visible on Home.
- Keep the mockup rhythm intact by using a compact command strip instead of a
  large new dashboard card.
- Reduce dead ends: every command either opens the source log, the exact detail
  composer, Plans, Records, More, or Log recovery.

Verification:

- Red/green tests first failed on broad `/log` Today Command routes and the
  missing Home render, then passed `todayCommand.test.ts` 8/8 and mobile
  readiness 94/94 after implementation.
- Fresh local verification passed root TypeScript, mobile TypeScript, the
  459-test mobile/domain/API/PWA suite, PixelLab asset verification
  `ok=149 missing=0 invalid=0`, package-local Expo web export, `git diff
  --check`, and preview route smoke for Home plus Today Command meal, walk,
  potty, and source-log routes.

## 2026-06-29 Avatar Studio Sprite-First Pixel Stage

Avatar Studio now treats the animated PixelLab sprite as the primary visual
surface when a live pack exists:

- The large care-twin hero no longer renders a hidden still dog behind the live
  sprite.
- Live templates render inside a dedicated
  `avatar-studio-pixel-sprite-viewport` with a 256px sprite frame so the stage
  reads as game UI instead of a soft portrait card.
- The live badge now says `PIXELLAB SPRITE`, matching the production asset
  source and avoiding fake scan/AI claims.
- Hungry, anxious, sleepy, home-alone, and not-feeling-well template previews
  stay animated through the idle loop instead of falling back to still art.

Design intent:

- Make the "real dog becomes a pixel care twin" promise visible on the Avatar
  Studio screen.
- Keep the current PixelLab limitation truthful: launch templates have idle and
  walk sprite rigs now; full emotion-specific gait/emote strips still need
  native phone-size QA and future asset passes.
- Preserve the mockup direction: a contained room, visible HUD/chip language,
  and a living sprite, not a generic uploaded-photo portrait.

Verification:

- Red/green mobile readiness first failed on the missing sprite viewport, then
  passed Avatar Studio-focused readiness after implementation.
- Fresh local verification passed root TypeScript, mobile TypeScript, the
  459-test mobile/domain/API/PWA suite, PixelLab asset verification
  `ok=149 missing=0 invalid=0`, package-local Expo web export, and preview
  route smoke for Home, Avatar Studio, Log detail, Health, and More.

## 2026-06-30 Health Watch Design-System Recovery

Apollo rejected the current mobile UI as too crowded, overlapping, and hard to
navigate. The design direction now prioritizes the dark RPG board and Paw
Friends simplicity reference saved under `docs/design/reference/`.

Health Watch is the first recovery slice:

- The hero now uses one pixel stage plus one compact care-status panel.
- The duplicate top metric rail and old status meter rail were removed.
- Dense health signals now render as scannable rows instead of cramped
  two-column cards.
- Bile Watch content stays inside the Bile Watch tab instead of repeating under
  the Health tab.
- The 7-day rhythm chart moved into Health Snapshot so it supports the page
  without crowding the hero.
- Review Packet now previews the most important prompts and checklist items
  instead of dumping everything into the first screen.

Design rule locked from this pass:

- Primary mobile screens must follow: route header, pixel scene, one status or
  command panel, one selected module, one action row, supporting detail below.
- Do not repeat the same data in multiple cards on one screen.
- Use list rows for operational health/care data when a grid would force text
  overlap.

Verification:

- Focused Avatar Studio/readiness tests passed 109/109.
- Mobile TypeScript passed with `tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit`.
- Broader focused mobile/domain/API/PWA suite passed 484/484.

## 2026-06-30 Quick Log Design-System Recovery

Quick Log is the second mobile design-system recovery slice after Health Watch.
The goal was to keep the advanced logging engine intact while making the first
screen feel like the reference boards: fast, intentional, and readable.

What changed:

- The pixel command stage now uses a smaller live `ear-perk` sprite footprint,
  a narrower speech bubble, and a shorter HUD offset so the dog, bubble, and
  console stop visually colliding on phone-sized screens.
- The primary launcher card is now a `Quick Log Flow` action console with a
  concise product rule: tap for safe defaults, hold for details, and detail-first
  for medication, vomit, and incidents.
- The action grid appears before the teaching rail, so the first thing a user
  sees after the hero is the thing they can do.
- Today support metrics were moved into a named `quickLogSupportRail` between
  the action console and the full composer.
- The full composer remains available for rich meal, potty, medication, vomit,
  trust, sticky-note, and edit workflows, but it now reads as a secondary detail
  dock instead of a second competing dashboard.

Design rule locked from this pass:

- Fast action surfaces should put the command grid before instructional copy.
- Detail-heavy forms belong below the first-screen command loop unless safety
  requires detail-first behavior.
- Pixel sprites and speech bubbles must have explicit responsive bounds; they
  cannot share the same visual space by accident.

Verification:

- Mobile readiness passed 102/102, including the new Quick Log recovery guard.
- Mobile TypeScript passed with `tsc -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit`.
- Broader focused mobile/domain/API/PWA suite passed 485/485.
- Expo web export refreshed `.expo-smoke` with 218 assets / 222 files.
- Live preview route smoke passed for `/`, `/health`, and `/log` at
  `http://127.0.0.1:4194/`.

## 2026-06-30 Health Watch Second Polish Pass

Apollo's latest feedback made the design bar explicit: the app must feel like a
planned App Store product, not a stack of useful but crowded widgets. Health
Watch now follows the stricter mobile recipe more closely.

What changed:

- The route header now behaves like the rest of the app shell instead of a
  centered floating title.
- A new `healthCommandActions` deck puts the four most common health follow-ups
  directly after the status boundary: Appetite, Potty, Vomit, and Water.
- The Health pixel stage is shorter and the live sprite is bounded more tightly
  so the stage does not dominate the whole first screen.
- Health Snapshot rows now use `healthSignalCopy` and
  `healthSignalTitleLine` to give label, status, detail, and action their own
  space.
- Review Packet spacing was compressed so it supports vet handoff without
  pushing the whole route into a wall of cards.

Design rule locked from this pass:

- If a row has icon, title, status, detail, and action, title/status must share
  one line, detail must sit below, and the action must be a short verb. Full
  action sentences belong in accessibility labels or detail views, not cramped
  visible row chrome.

Verification:

- Mobile readiness passed 102/102.
- Mobile TypeScript passed.
- Broader focused mobile/domain/API/PWA suite passed 485/485.
- Expo web export refreshed `.expo-smoke` with 218 assets / 222 files.
- Route smoke passed for Home, Health, Log, and Plans at
  `http://127.0.0.1:4194/`.

## 2026-06-30 Plans Mission Hierarchy Pass

Plans is the third route in the design-system recovery. The goal was to make
the schedule feel like a care mission cockpit instead of a stack of unrelated
planning cards.

What changed:

- Added a `PlanMissionRow` model and a `Today's Missions` board directly under
  the pixel command stage.
- The mission board connects the next schedule item, household responsibility
  status, and lead Reminder Center item into one first-screen decision layer.
- Added a `Mission Schedule` header with an open-count pill before the
  Today/Tomorrow/Week tabs.
- Preserved all existing routine behavior: open routine edit, one-tap done
  logging, undo/add-details recovery, Reminder Center routing, owner load
  chips, and Daily Routine responsibility metrics.
- Opened the in-app browser to `http://127.0.0.1:4194/calendar` for live
  review after export.

Design rule locked from this pass:

- A planning screen should lead with the next mission and ownership state
  before showing the full schedule. The user should understand what matters
  now in one glance, then scan the routine board below.
- Reminder, responsibility, and schedule data should be connected in one
  command layer when they answer the same question: "What needs care next?"

Verification:

- Mobile readiness passed 103/103, including the new mission-hierarchy guard.
- Mobile TypeScript passed.
- Broader focused mobile/domain/API/PWA suite passed 486/486.
- Expo web export refreshed `.expo-smoke` with 218 assets / 222 files.
- Route smoke passed for Home, Plans, Health, and Log at
  `http://127.0.0.1:4194/`.
- DOM verification on the in-app browser confirmed the command deck, Today's
  Missions, Mission Schedule, and Reminder Center text were present.
- Screenshot capture still timed out in local browser tooling, so native/browser
  visual proof remains a QA task.
