# WoofWatcher Native iOS Starter

This folder is a SwiftUI source handoff for a future native iOS app. The shipped v1 remains the tested PWA, but these files mirror the same Phoenix care model so a macOS/Xcode session can create the app without rethinking the product.

## Minimum Target

- iOS 17+
- SwiftUI
- Observation framework
- Local JSON persistence first

## Files

- `WoofWatcherApp.swift`: root app entry.
- `CareModels.swift`: Codable model types and Phoenix seed data.
- `CareStore.swift`: root-owned observable store with local JSON save/load, health watch, monthly summary, and caregiver handoff digest.
- `ContentView.swift`: TabView shell for Today, Log, Health, Records, Report, and Helper, including a shareable Today handoff section.

## Verification Still Needed On macOS

1. Create an Xcode iOS app target named `WoofWatcher`.
2. Add these Swift files to the target.
3. Build in Xcode.
4. Run on Simulator.
5. Add a care log, relaunch, and confirm persistence.
6. Confirm the report and helper boundary match the PWA behavior.
7. Confirm the Today handoff shows next routine, last meal, last walk, follow-ups, and caregiver load.
