# Autonomous Build Queue

## Operating Rule

Every autonomous run should improve at least one of: care workflow, household usefulness, premium feel, production safety, monetization path, or App Store readiness.

## Highest Priority Queue

1. DONE 2026-06-08: Routines/logs relationship: logs satisfy/update matching routines.
2. DONE 2026-06-08: Meal logging: expected portion, served amount, eaten amount, skipped/partial completion, notes, and household visibility.
3. DONE 2026-06-08: Subscription path: pricing screen, premium preview, and plan packaging without live payments.
4. DONE 2026-06-08: Today Command uses routine-board truth for partial meals, overdue assigned routines, routes, urgency, and explanation text.
5. Next: Quick Log: make common care logging instant without losing detail.
6. Health Watch: symptom/vomit/stool/appetite pattern views with non-diagnostic boundaries.
7. Handoff: make sitter/family/trainer/vet reports valuable enough to pay for.
8. Records: document upload/storage, credential export, expiring-record reminders.
9. WoofGuide: structured owner-reviewed actions for log drafts, reminders, vet notes, and reports.
10. Privacy/account safety: data export, account deletion, AI disclosure, document storage rules.
11. Mobile runtime QA: Expo smoke, accessibility, visual regression, App Store prep.
12. Premium design system and motion pass.

## Cadence

Recommended automation cadence from Apollo's shared thread: every 3 hours, using a dedicated Git worktree where the automation system supports it.

Operational manifest: `docs/operations/PREMIUM_REVENUE_PRODUCT_BUILDER.md`.

## Stop Conditions

Stop only for missing secrets, destructive data risk, app-store approval, legal/veterinary safety boundaries, production approval, or source-of-truth contradictions.
