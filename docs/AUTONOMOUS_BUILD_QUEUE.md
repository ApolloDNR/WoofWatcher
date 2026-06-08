# Autonomous Build Queue

## Operating Rule

Every autonomous run should improve at least one of: care workflow, household usefulness, premium feel, production safety, monetization path, or App Store readiness.

## Highest Priority Queue

1. Routines/logs relationship: logs satisfy/update matching routines.
2. Meal logging: expected portion, served amount, eaten amount, skipped/partial completion, notes, and household visibility.
3. Today Command: make next action obvious, route to the right workflow, explain why.
4. Quick Log: make common care logging instant without losing detail.
5. Health Watch: symptom/vomit/stool/appetite pattern views with non-diagnostic boundaries.
6. Handoff: make sitter/family/trainer/vet reports valuable enough to pay for.
7. Records: document upload/storage, credential export, expiring-record reminders.
8. WoofGuide: structured owner-reviewed actions for log drafts, reminders, vet notes, and reports.
9. Subscription path: pricing screen, premium gates, and plan packaging.
10. Privacy/account safety: data export, account deletion, AI disclosure, document storage rules.
11. Mobile runtime QA: Expo smoke, accessibility, visual regression, App Store prep.
12. Premium design system and motion pass.

## Cadence

Recommended automation cadence from Apollo's shared thread: every 3 hours, using a dedicated Git worktree where the automation system supports it.

## Stop Conditions

Stop only for missing secrets, destructive data risk, app-store approval, legal/veterinary safety boundaries, production approval, or source-of-truth contradictions.
