# Native iOS Handoff

WoofWatcher v1 ships first as an installable PWA. A native iOS version should mirror the same product model rather than invent a second app.

Starter SwiftUI source now lives at:

```text
ios/WoofWatcherNative
```

These files are a handoff pack for a macOS/Xcode session, not a verified App Store build.

## Recommended SwiftUI Shape

- `WoofWatcherApp`: root app entry.
- `AppTab`: `today`, `schedule`, `goals`, `calendar`, `progress`, `log`, `health`, `records`, `report`, `helper`.
- `CareStore`: `@Observable` root-owned model on iOS 17+; use SwiftData or file-backed JSON for persistence.
- `PhoenixProfile`: static profile plus editable care focus fields.
- `CareEntry`: meal, treat, walk, park, training, social, vomit, health, vet, weight, medication, note.
- `CareGoal`: weight, training, anxiety, social, health, and custom milestones with active/paused/done status.
- `CareRecord`: vet, vaccine, weight, instruction.
- `RecordDraft`: editable record form shape for vet, vaccine, weight, medication, microchip, and instruction records.
- `RoutineDraft`: editable schedule item for meals, walks, snacks, medication, training, and ownership.
- `CaregiverHandoff`: next routine, latest meal, latest walk, follow-ups, caregiver load, and a shareable message.
- `CareRoomTransferPackage`: shareable/importable state package for caregiver or device handoff before account sync exists.
- `CareCalendar`: monthly day summaries with review days, vomit days, care markers, and selected-day evidence.
- `TrainingProgressReview`: monthly training/social progress, calm wins, struggle signals, and next focus areas.
- `CareSummaryEngine`: native equivalent of `src/woof-core.js`.

## Navigation Pattern

- `TabView` for the ten primary surfaces.
- Per-tab `NavigationStack` if detail/edit screens are added.
- `.sheet(item:)` for add/edit entry and add/edit record.
- Keep state local to the root store and pass bindings into focused subviews.

## iPhone-Specific Wins

- Local notifications for breakfast, dinner, bedtime snack, and medication reminders.
- Share sheet for the caregiver handoff, care room transfer package, and monthly report.
- Home-screen widgets for next routine and health watch.
- iCloud sync only after caregiver account/privacy choices are decided.

## Verification Gate

Native iOS should not be called shipped until it builds in Xcode, runs on Simulator, can edit the schedule, add/edit/remove goals, add/edit/remove records, add a care log, shows the care calendar and selected-day timeline, shows training/social progress, persists after relaunch, exports a report, shares a care room transfer package, shows the caregiver handoff, and shows the red-flag boundary in the helper.
