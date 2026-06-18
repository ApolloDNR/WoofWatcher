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
