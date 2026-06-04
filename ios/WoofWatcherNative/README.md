# WoofWatcher Native iOS Starter

This folder is a SwiftUI source handoff for a future native iOS app. The shipped v1 remains the tested PWA, but these files mirror the same Phoenix care model so a macOS/Xcode session can create the app without rethinking the product.

## Minimum Target

- iOS 17+
- SwiftUI
- Observation framework
- Local JSON persistence first

## Files

- `WoofWatcherApp.swift`: root app entry.
- `CareModels.swift`: Codable model types, Phoenix seed data, caregiver draft shape, routine draft shape, goal draft shape, and record draft shape.
- `CareStore.swift`: root-owned observable store with local JSON save/load, editable caregivers, editable routines, editable goals, editable records, health watch, monthly summary, care calendar, training progress, goal review, caregiver handoff digest, and care room transfer package generation.
- `ContentView.swift`: TabView shell for Today, Team, Schedule, Goals, Calendar, Progress, Log, Health, Records, Report, and Helper, including shareable Today handoff and care room transfer actions.

## Verification Still Needed On macOS

1. Create an Xcode iOS app target named `WoofWatcher`.
2. Add these Swift files to the target.
3. Build in Xcode.
4. Run on Simulator.
5. Add a care log, relaunch, and confirm persistence.
6. Add, edit, and remove a caregiver profile; confirm exact routine ownership migrates on rename and clears on removal.
7. Add and remove a schedule routine.
8. Add, edit, and remove a care goal.
9. Add, edit, and remove a care record.
10. Confirm the Calendar tab shows current-month logs, vomit days, review days, and selected-day evidence.
11. Confirm the Progress tab shows training sessions, social exposure, wins, focus areas, and recent evidence.
12. Confirm the report and helper boundary match the PWA behavior.
13. Confirm the Today handoff shows next routine, last meal, last walk, follow-ups, and caregiver load.
14. Confirm the care room transfer ShareLink exports importable JSON with Phoenix state and handoff context.
