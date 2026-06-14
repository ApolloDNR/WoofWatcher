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
- GitHub Actions full verification is the authoritative full typecheck/build gate after push.

## Current Implementation Focus

Next implementation slice:

1. Runtime/browser visual QA once a local package manager or dev server dependency install is available.
2. Provider-backed account/cloud/payment decisions after Apollo picks the release stack.
3. Native/mobile runtime QA and final visual system pass.
4. Deeper route-by-route visual polish now that board route headers, core workflow cards, Records report board sections, Records vault board sections, Records trend board sections, and the first Records activity board sections are in place.
5. Fable/Replit visual polish using the new handoff file.

## Known Limitations

- Final pixel animation assets are not present.
- Browser screenshot verification was not possible in this checkout because `node_modules`, `pnpm`, `npm`, and the local app terminal helper were unavailable.
- Real AI, cloud sync, provider-backed roles, push notifications, payments, document storage, binary PDFs, and app-store release remain separate production slices.
