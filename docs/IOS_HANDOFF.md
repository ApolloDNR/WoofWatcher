# Native iOS Handoff

WoofWatcher v1 ships first as an installable PWA. A native iOS version should mirror the same product model rather than invent a second app.

Starter SwiftUI source now lives at:

```text
ios/WoofWatcherNative
```

These files are a handoff pack for a macOS/Xcode session, not a verified App Store build.

## Recommended SwiftUI Shape

- `WoofWatcherApp`: root app entry.
- `AppTab`: `today`, `log`, `health`, `records`, `report`, `helper`.
- `CareStore`: `@Observable` root-owned model on iOS 17+; use SwiftData or file-backed JSON for persistence.
- `PhoenixProfile`: static profile plus editable care focus fields.
- `CareEntry`: meal, treat, walk, park, training, social, vomit, health, vet, weight, medication, note.
- `CareRecord`: vet, vaccine, weight, instruction.
- `CaregiverHandoff`: next routine, latest meal, latest walk, follow-ups, caregiver load, and a shareable message.
- `CareSummaryEngine`: native equivalent of `src/woof-core.js`.

## Navigation Pattern

- `TabView` for the six primary surfaces.
- Per-tab `NavigationStack` if detail/edit screens are added.
- `.sheet(item:)` for add/edit entry and add/edit record.
- Keep state local to the root store and pass bindings into focused subviews.

## iPhone-Specific Wins

- Local notifications for breakfast, dinner, bedtime snack, and medication reminders.
- Share sheet for the caregiver handoff and monthly report.
- Home-screen widgets for next routine and health watch.
- iCloud sync only after caregiver account/privacy choices are decided.

## Verification Gate

Native iOS should not be called shipped until it builds in Xcode, runs on Simulator, can add a care log, persists after relaunch, exports a report, shows the caregiver handoff, and shows the red-flag boundary in the helper.
