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
14. Premium design system and motion pass.

## Cadence

Recommended automation cadence from Apollo's shared thread: every 3 hours, using a dedicated Git worktree where the automation system supports it.

Operational manifest: `docs/operations/PREMIUM_REVENUE_PRODUCT_BUILDER.md`.

## Stop Conditions

Stop only for missing secrets, destructive data risk, app-store approval, legal/veterinary safety boundaries, production approval, or source-of-truth contradictions.
