# Codex Progress Report - 2026-06-12

## Current Status

WoofWatcher is mid-upgrade toward v1.5 Premium Neo-Retro Pixel Care.

## Completed In This Pass

- Confirmed the repo source-of-truth docs and current CI state.
- Repaired the mobile v1.5 navigation CI regression by normalizing Home quick-log potty handling.
- Preserved the mobile bottom nav contract: Home, Log, Plans, Health, More.
- Added the v1.5 source docs requested by Apollo.
- Recorded the PWA/dashboard upgrade direction without demoting the canonical mobile app.
- Implemented the PWA v1.5 shell foundation: grouped desktop sidebar, five-item mobile bottom nav, top-bar search/reminder/date/profile/theme controls, persisted light/dark theme, grouped Quick Log v2, PWA product-view-model navigation groups, and localStorage-preserved meal/potty lifecycle fields.
- Added a PWA readiness test for v1.5 navigation, Potty parent quick log, and meal served-to-outcome lifecycle.
- Implemented the first Phoenix Home v1.5 workflow upgrade: a Phoenix Status card that answers presence, alone state, mood, next care, and open meal outcome state. Open meals can now be updated from Home with one tap.
- Implemented the Quick Log v2 detail-flow skeleton in the PWA: Meal now opens a served-to-outcome workflow with portion, food, caregiver, pending outcome, and update outcome fields; Potty now opens a parent/outcome workflow for location, pee/poop/both/tried/accident, caregiver, and notes. Other quick actions still save immediately.
- Implemented Household Pulse as a first-class PWA route with manual Leaving Home and I'm Home flows. Leaving Home starts an open household-visible alone timer; returning home closes it with outcome, duration, caregiver, recovery, and note context. The More screen now has a directory entry point back into Household Pulse and other secondary tools.
- Implemented scoped PWA Care Pass export cards for Vet, Sitter, Trainer, and Emergency audiences. Each card now uses the shared `buildScopedCarePass` source, exposes a copyable text payload, and downloads structured JSON for later premium PDF/server-backed report generation.
- Implemented Diet & Treats as a first-class PWA route. The screen now shows current food, daily meal target/progress, meals today, treats today, hydration context, avoid/sensitivity chips, diet profile editing, and direct actions to Log Meal, Log Treat, or edit the profile.
- Implemented WoofGuide as a first-class PWA route with owner-reviewed action cards. Actions now route into Meal Log, Care Pass review, Records review, and a bounded vet-note draft while keeping live OpenAI optional and clearly separated.
- Split PWA Timeline, Records, Reports, and Care Pass into directly routable desktop/sidebar work surfaces instead of collapsing them into More.
- Implemented Avatar Studio as a first-class PWA prototype route with local reference photo upload memory, selectable Phoenix template state, and the required future animation state inventory.
- Implemented Achievements as a first-class PWA route backed by `getAchievementReview`. The route derives meaningful milestones from real care evidence: routine streak, training consistency, happy tummy week, bedtime snack proof, calm alone time, and records completeness.
- Implemented Settings as a first-class PWA route that consolidates full backup, import, care-room transfer, reset, local-only provider readiness, AI mode, health boundary, reminder delivery truth, and sync blockers.
- Polished Phoenix Home with generated pixel-room state copy, a "Where Phoenix is" Household Pulse card, and a combined Health/Bile snapshot covering food gap, bedtime snack proof, vomiting, energy, and weight.
- Added `docs/design/FABLE_HANDOFF_2026-06-13.md` so Fable/Replit can polish the existing functional skeleton without breaking route structure, data hooks, local-first behavior, backup/import, or safety boundaries.
- Extended the Expo mobile board primitive system beyond Home. The shared mobile primitives now include route headers, status pills, and metric tiles, and core routes now adopt the board system across Log, Plans, Health/Bile, More, Records, WoofGuide, and Avatar Studio.
- Converted mobile Health Watch/Bile Watch to shared board cards, metric tiles, section headers, care rows, and status pills while preserving non-diagnostic health boundary language.
- Converted mobile Records Care Pass, Report History, and Progress Report into shared board-card sections while preserving preview, resend, print-source, period-filter, and share actions.
- Converted mobile Records Record Vault, Diet on File, and Records Cabinet into shared board-card sections while preserving add/edit/delete controls, attachment indicators, due labels, and diet context.
- Converted mobile Records Weight Trend, Mood Trend, and Hydration into shared board-card sections while preserving the chart, mood bars, hydration meter, latest-log context, and report-safe copy.
- Converted mobile Records Walk Activity, Training Progress, and Potty Health into shared board-card sections while preserving saved routes, training focus/latest context, stool color/context, and care-safe next steps.
- Completed the remaining mobile Records board unification: Care Trends, Dog ID heading, Alone Time, Grooming Care, Incident Lookback, and Medication Plan now use shared board primitives while preserving share/print actions, medication routine navigation, follow-ups, search/filter history, and non-diagnostic care copy.
- Converted the mobile More tab's primary household/system surfaces to shared board anatomy: Care Team, Household Access, Responsibility Center, Sync Health, Tools & Sharing, and Diet Profile now use `BoardCard`/`BoardSectionHeader` while preserving their real actions.
- Converted the mobile Plans tab's Reminder Center and Daily Routine surfaces to shared board anatomy while preserving reminder routing, routine editor actions, routine completion, owner load chips, household responsibility metrics, and empty routine setup.
- Converted the mobile Quick Log tab's Today at a Glance, Find Care Logs, empty timeline state, and grouped timeline day sections to shared board anatomy while preserving search, filters, sticky notes, edit/detail/delete actions, and sync status copy.
- Converted mobile WoofGuide's owner-reviewed intro, Quick Questions, and Suggested Actions into shared board sections while preserving prompt routing, generated action routing, owner-reviewed drafts, and bounded health language.
- Converted mobile Premium's Why Upgrade, Plans, and Launch Entitlements surfaces to shared board anatomy while preserving truthful checkout gating, launch checklist copy, and Free/Plus/Family entitlement policy.
- Converted mobile Privacy & Safety's Export Summary, Launch Safety Gates, and Before Public Launch blockers into shared board sections while preserving owner data export, deletion-request sharing, and provider-gated AI/document/payment safety copy.
- Converted mobile Avatar Studio's working scan canvas, live/generated preview, mood-state set, and photo guidance into shared board sections while preserving image generation, saved avatar state, revert-to-default, and scan animation behavior.
- Converted mobile Setup's care-foundation header, setup-progress meter, and profile/diet/routine/caregiver sections into shared board anatomy while preserving setup draft hydration, save foundation, and finish-later behavior.

## Verification

- Focused behavior tests passed locally after the CI repair: 178 passing tests.
- Focused behavior tests passed locally after the PWA shell slice: 181 passing tests.
- Phoenix Home open meal workflow verification is covered by the PWA readiness test.
- Quick Log v2 meal/potty flow verification is covered by the PWA readiness test.
- Focused behavior tests passed locally after the Quick Log v2 flow slice: 183 passing tests.
- Household Pulse manual alone-time workflow verification is covered by the PWA readiness test.
- Focused behavior tests passed locally after the Household Pulse slice: 184 passing tests.
- Scoped Care Pass audience export wiring is covered by the PWA readiness test.
- Focused behavior tests passed locally after the scoped Care Pass export slice: 185 passing tests.
- Diet & Treats route wiring is covered by the PWA readiness test.
- Focused behavior tests passed locally after the Diet & Treats route slice: 186 passing tests.
- WoofGuide owner-reviewed action routing is covered by the PWA readiness test.
- Timeline/Records/Reports/Care Pass direct routing is covered by the PWA readiness test.
- Avatar Studio prototype route and state inventory are covered by the PWA readiness test.
- Achievements direct routing is covered by the PWA readiness test, and achievement derivation is covered by `woof-achievements.test.js`.
- Focused behavior tests passed locally after the Achievements route slice: 191 passing tests.
- Settings direct routing and local safety controls are covered by the PWA readiness test.
- Phoenix Home household pulse and Health/Bile snapshot polish is covered by the PWA readiness test.
- Focused behavior tests passed locally after the Phoenix Home polish slice: 193 passing tests.
- JS syntax checks passed for `artifacts/woofwatcher/src/vanilla/app-entry.js`, `artifacts/woofwatcher/src/vanilla/woof-core.js`, and `artifacts/woofwatcher/src/vanilla/woof-product-view-model.js`.
- `git diff --check` passed.
- Local TypeScript could not run because this checkout did not have `node_modules/typescript`.
- Mobile board route adoption is covered by `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`.
- Focused zero-dependency suite passed locally after the board route adoption slice: 197 passing tests.
- Quick Log, Plans, and Records shared board-card anatomy is covered by `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`.
- Focused zero-dependency suite passed locally after the core workflow card anatomy slice: 199 passing tests.
- Records Care Pass, Report History, and Progress Report board anatomy is covered by `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`.
- Focused zero-dependency suite passed locally after the Records report board anatomy slice: 201 passing tests.
- Records Record Vault, Diet on File, and Records Cabinet board anatomy is covered by `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`.
- Focused zero-dependency suite passed locally after the Records vault board anatomy slice: 202 passing tests.
- Records Weight Trend, Mood Trend, and Hydration board anatomy is covered by `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`.
- Focused zero-dependency suite passed locally after the Records trend board anatomy slice: 203 passing tests.
- Records Walk Activity, Training Progress, and Potty Health board anatomy is covered by `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`.
- Focused zero-dependency suite passed locally after the Records activity board anatomy slice: 204 passing tests.
- Records Care Trends, Dog ID heading, Alone Time, Grooming Care, Incident Lookback, and Medication Plan board anatomy is covered by `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`.
- Focused mobile readiness suite passed locally after the Records completion board anatomy slice: 46 passing tests.
- More tab household, tools, and diet board anatomy is covered by `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`.
- Focused mobile readiness suite passed locally after the More board anatomy slice: 47 passing tests.
- Plans Reminder Center and Daily Routine board anatomy is covered by `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`.
- Focused mobile readiness suite passed locally after the Plans board anatomy slice: 48 passing tests.
- Quick Log search/filter and timeline board anatomy is covered by `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`.
- Focused mobile readiness suite passed locally after the Quick Log board anatomy slice: 49 passing tests.
- WoofGuide prompt and suggested-action board anatomy is covered by `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`.
- Focused mobile readiness suite passed locally after the WoofGuide board anatomy slice: 50 passing tests.
- Premium value, plan, and entitlement board anatomy is covered by `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`.
- Focused mobile readiness suite passed locally after the Premium board anatomy slice: 51 passing tests.
- Privacy export and launch-safety board anatomy is covered by `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`.
- Focused mobile readiness suite passed locally after the Privacy board anatomy slice: 52 passing tests.
- Avatar Studio preview, mood-state, and guidance board anatomy is covered by `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`.
- Focused mobile readiness suite passed locally after the Avatar Studio board anatomy slice: 53 passing tests.
- Setup onboarding board anatomy is covered by `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`.
- Focused mobile readiness suite passed locally after the Setup board anatomy slice: 54 passing tests.
- GitHub Actions full verification is the authoritative full typecheck/build gate after push.

## Current Implementation Focus

Next implementation slice:

1. Runtime/browser visual QA once a local package manager or dev server dependency install is available.
2. Provider-backed account/cloud/payment decisions after Apollo picks the release stack.
3. Native/mobile runtime QA and final visual system pass.
4. Deeper route-by-route visual polish now that Records, More, Plans, Quick Log, WoofGuide, Premium, Privacy, Avatar Studio, and Setup have been moved off the biggest old local card/header patterns and the remaining core routes have shared board chrome.
5. Fable/Replit visual polish using the new handoff file.

## Known Limitations

- Final pixel animation assets are not present.
- Browser screenshot verification was not possible in this checkout because `node_modules`, `pnpm`, `npm`, and the local app terminal helper were unavailable.
- Real AI, cloud sync, provider-backed roles, push notifications, payments, document storage, binary PDFs, and app-store release remain separate production slices.

## 2026-06-17 Avatar Studio Lite Release Slice

### Status

This slice moves Avatar Studio from a prototype portrait screen into the first shippable care-twin system. It is ready for internal review and the next visual-asset pass. It is not public live-ready yet because final production pixel sprite assets, store assets, production providers, and release-account setup are still open.

### Preview And Browser Proof

- Live local preview: `http://127.0.0.1:4192/portrait`
- Browser proof artifact: `docs/build/browser-proof-avatar-studio-lite-2026-06-17.json`
- Visible checks passed in the in-app browser:
  - `AVATAR STUDIO` renders on `/portrait`.
  - `Create the care twin` renders.
  - Upload copy says: "Upload photos to help us suggest your dog's pixel care twin, then approve and customize it."
  - Scan, Template, Customize, and Emotes tabs render.
  - Save Avatar renders.
  - The old `Portrait Studio` label is not visible.
  - Current browser console errors: none.
- Screenshot capture was attempted three ways: full-page, viewport, and clipped mobile capture. All timed out at the browser capture layer with `Page.captureScreenshot`, so no screenshot artifact was produced in this environment.

### Screens Completed

- Avatar Studio Lite on `/portrait`
  - Upload photo entry points for gallery and camera.
  - Truthful scan-assisted suggestion copy.
  - Template picker for the launch breed/body library.
  - Coat, marking, ear, and accessory customization.
  - Emote preview set for the living care twin.
  - Save/reset avatar config actions.
- Phoenix Home
  - Reads saved avatar configuration.
  - Shows the selected avatar identity and opens Avatar Studio.
- More
  - Renamed the old portrait entry to Avatar Studio.
  - Shows template identity and scan-assisted/template-ready status.

### Files Changed In This Slice

- `artifacts/woofwatcher-mobile/lib/avatarStudio.ts`
- `artifacts/woofwatcher-mobile/lib/avatarStudio.test.ts`
- `artifacts/woofwatcher-mobile/context/AvatarContext.tsx`
- `artifacts/woofwatcher-mobile/app/portrait.tsx`
- `artifacts/woofwatcher-mobile/app/(tabs)/index.tsx`
- `artifacts/woofwatcher-mobile/app/(tabs)/more.tsx`
- `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`
- `docs/design/AVATAR_STUDIO_IMPLEMENTATION.md`
- `docs/design/ASSET_TODO.md`
- `docs/design/UI_IMPLEMENTATION_NOTES.md`
- `docs/AUTONOMOUS_BUILD_QUEUE.md`
- `docs/DECISION_LOG.md`
- `docs/build/browser-proof-avatar-studio-lite-2026-06-17.json`
- `docs/build/CODEX_PROGRESS_REPORT_2026-06-12.md`

### Tests And Checks Run

- `pnpm run test:focused`
  - Result: could not run directly in this shell because `pnpm` is not installed or on PATH.
- Focused zero-dependency equivalent from `AGENTS.md`:
  - Command: `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/*.test.ts artifacts/woofwatcher/src/vanilla/*.test.js lib/care-domain/test/*.test.ts`
  - Result: passed, 234 tests.
- Mobile TypeScript:
  - Command: `artifacts/woofwatcher-mobile/node_modules/.bin/tsc.cmd -p artifacts/woofwatcher-mobile/tsconfig.json --noEmit`
  - Result: passed.
- Expo web export:
  - Command: `expo export --platform web --output-dir .expo-smoke --clear`
  - Result: passed, exported `.expo-smoke`.
- Browser verification:
  - Route: `http://127.0.0.1:4192/portrait`
  - Result: passed DOM/content checks and had zero console errors.

### Remaining Blockers

- Final dogless room backgrounds are still required before the layered sprite room can replace the baked hero art.
- Production Phoenix sprite strips are still required for true walking, breathing, eating, sleeping, anxious, proud, and not-well loops.
- Avatar templates currently ship as data/config and existing Phoenix art placeholders; App Store-quality per-template art packs remain a visual-asset task.
- Scan-to-avatar is intentionally not live AI yet. V1 uses a truthful mock/suggestion flow so the pipeline can receive real vision/image analysis later without changing the saved config model.
- Public launch still needs production auth/cloud storage decisions, privacy/legal review, App Store and Google Play account setup, icons, splash, screenshots, store copy, release signing, TestFlight/internal testing, and Apollo approval.

### Next Best Pass

1. Add the final Phoenix identity seed and dogless room background.
2. Register the first production sprite strip set in `careTwinAssets.ts`.
3. Give Avatar Studio production-ready template thumbnail art for Shepherd plus 2-3 other launch templates.
4. Run real-device Expo QA on iPhone and Android once release accounts/dev-client setup is available.
