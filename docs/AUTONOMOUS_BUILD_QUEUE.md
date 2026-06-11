# Autonomous Build Queue

## Operating Rule

Every autonomous run should improve at least one of: care workflow, household usefulness, premium feel, production safety, monetization path, or App Store readiness.

## Highest Priority Queue

1. DONE 2026-06-08: Routines/logs relationship: logs satisfy/update matching routines.
2. DONE 2026-06-08: Meal logging: expected portion, served amount, eaten amount, skipped/partial completion, notes, and household visibility.
3. DONE 2026-06-08: Subscription path: pricing screen, premium preview, and plan packaging without live payments.
4. DONE 2026-06-08: Today Command uses routine-board truth for partial meals, overdue assigned routines, routes, urgency, and explanation text.
5. DONE 2026-06-08: Home Quick Log now creates routine-aware meal and walk logs with meal portion, completion, eaten amount, and household visibility detail.
6. DONE 2026-06-08: Health Watch now produces non-diagnostic pattern cards with evidence, owner next steps, and visible vet boundary language.
7. DONE 2026-06-08: Care Pass handoffs now include audience-specific checklists and Health Pattern Review next steps for sitter, caregiver, trainer, and vet exports.
8. DONE 2026-06-08: Records now derives and displays expired, due-soon, and missing-critical record reminders; real document storage remains blocked on provider rules.
9. DONE 2026-06-08: WoofGuide now creates owner-reviewed drafts for missing meal logs, record reminders, vet notes, and Care Pass review.
10. DONE 2026-06-08: Privacy/account safety first pass now includes owner data export, deletion request preparation, AI disclosure, and document/payment safety gates.
11. IN PROGRESS, CI Expo web export smoke and critical accessibility label smoke shipped 2026-06-08: Mobile QA now checks route registration, tabs, router links, launch-blocking safety copy, an Expo web export bundle, and screen-reader labels for critical Privacy, Premium, WoofGuide, and More actions. Next: simulator/device smoke, full accessibility pass, visual regression, App Store prep.
12. DONE 2026-06-08: Premium entitlement policy now defines Free, Plus, and Family feature gates in shared domain logic, keeps checkout disabled, and shows the policy on the mobile Plus screen before payments are enabled.
13. DONE 2026-06-08: Expo app identity now uses release-grade WoofWatcher slug/scheme plus Pegasus Dreamscapes iOS bundle and Android package ids instead of Replit placeholders.
14. IN PROGRESS, avatar motion foundation shipped 2026-06-08: Home now derives a deterministic avatar motion state from health signals, recent care logs, routine due/overdue state, quiet hours, and energy. Next: Rive/Lottie/Reanimated asset pipeline, Figma/code design system, full screen-by-screen visual polish, and visual regression.
15. Premium design system and motion pass: component tokens, high-end screen polish, avatar state assets, transition rules, and accessibility review.
16. DONE 2026-06-09: Care Pass report artifacts now include escaped print-ready HTML and stable file names for future PDF generation, native sharing, and server-backed storage.
17. DONE 2026-06-09: Records Report History now shows print-ready/restored Care Pass metadata, exposes separate resend and printable-source share actions, and keeps older saved report artifacts printable through escaped fallback HTML.
18. DONE 2026-06-09: Dog ID credentials now have escaped print-ready HTML, stable file names, and separate Records actions for sharing the normal ID card text or printable source.
19. DONE 2026-06-10: Medication routines now derive taken, due, missed, and upcoming adherence status from household-visible medication logs, including dose, owner, logged-by context, next action, and a mobile Records Medication Plan surface.
20. DONE 2026-06-10: Medication logging now has Home quick-log access, routine-aware dose/outcome/visibility defaults, a Log composer Medication routine panel, and skipped-medication handling that does not count as taken.
21. DONE 2026-06-11: Medication follow-ups now derive missed, due-now, and refill due-soon/overdue actions from routines, logs, and medication records; Records shows Medication Follow-ups and Care Pass report language includes adherence plus refill next steps.
22. DONE 2026-06-11: Medication history now derives recent household-visible medication logs with dose, taken/skipped/missed outcome, caregiver, routine id, note, and Records Medication History UI.
23. DONE 2026-06-11: Water care now has Home quick-log access, household-visible refill defaults, shared daily hydration summary logic, Records Hydration UI, and Care Pass report language.
24. DONE 2026-06-11: Walk activity now derives daily duration, places/routes, dog interactions, social outcome notes, caregiver participation, Records Walk Activity UI, and Care Pass report language from household-visible walk logs.
25. DONE 2026-06-11: Potty Health now derives daily pee/poop counts, stool review signals, conditions, latest detail, caregiver participation, Records Potty Health UI, and Care Pass report language from household-visible potty logs.
26. DONE 2026-06-11: Potty logging now captures stool color and routine/accident/urgent/straining context, and Potty Health carries those details into Records and Care Pass reports.
27. DONE 2026-06-11: Durable sync outbox now derives retryable create/update work from local, pending, and failed care entries, exposes it through CareContext, and shows a Log screen recovery banner with retry counts and a retry action.

## Cadence

Recommended automation cadence from Apollo's shared thread: every 3 hours, using a dedicated Git worktree where the automation system supports it.

Operational manifest: `docs/operations/PREMIUM_REVENUE_PRODUCT_BUILDER.md`.

## Stop Conditions

Stop only for missing secrets, destructive data risk, app-store approval, legal/veterinary safety boundaries, production approval, or source-of-truth contradictions.
