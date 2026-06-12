# WoofWatcher v1.5 Build Plan

Date: 2026-06-12

## Product Target

Build a strong working v1.5 quickly without restarting the product. Preserve the existing local-first PWA architecture, mobile care model, localStorage behavior, backup/import behavior, reports, Health Watch/Bile Watch logic, records, and assistant routing.

## Build Order

1. App shell and navigation
   - Responsive AppShell.
   - Desktop left sidebar.
   - Mobile bottom nav: Home, Log, Plans, Health, More.
   - Top bar with greeting, search, notifications, date, profile, and theme toggle.
   - Shared tokens and reusable layout components.

2. Phoenix Home
   - Pixel room hero.
   - Phoenix status and presence.
   - Next Up.
   - Today at a Glance.
   - Quick actions.
   - Household Pulse mini-card.
   - Health/Bile snapshot.

3. Quick Log v2
   - Groups: Care, Mood & Behavior, Health, Household.
   - Potty parent flow: where, outcome, notes, save.
   - Meal served/outcome lifecycle: served, eaten, update earlier meal.

4. Editable logs and timeline
   - Filters: All, Care, Health, Notes.
   - Actions: details, edit, update outcome, add note, add photo, delete.
   - Trust states: Confirmed, Pending, Estimated, Corrected.

5. Household Pulse and Alone Time
   - Home/away/unknown state per human.
   - Phoenix with human, home alone, or unknown.
   - Leaving Home and I'm Home flows.
   - Return outcome capture.

6. Health Watch and Bile Watch
   - Tabs: Overview, Bile Watch, Trends.
   - Non-diagnostic language only.
   - Bile Watch: risk state, last yellow bile event, longest food gap, bedtime snack proof, appetite/energy after vomiting, 7-day trend.

7. Diet & Treats
   - Diet profile, portions, breakfast/dinner, bedtime snack, treats, toppers, supplements, avoid list, allergies/sensitivities, appetite quirks, vet notes.
   - Daily target, meals today, treats today, hydration, food notes.

8. Care Pass
   - Vet, Sitter, Trainer, and Emergency Care Pass types.
   - Preview before export/share.
   - Print/PDF-ready source path.

9. WoofGuide
   - Talk-to-log, pattern explanation, weekly summaries, vet questions, Care Pass help, owner-reviewed profile memory updates.
   - No veterinary claims.

10. Avatar Studio
    - Upload photo, detect traits, customize, generate emotes, save avatar.
    - Use static/mock pixel states until AI generation is real.

11. Achievements and family safety
    - Meaningful streaks and care milestones.
    - Role model: Adult Admin, Adult, Teen, Kid, Sitter, Trainer, Vet Viewer.
    - Kid logs can be pending confirmation; medication and serious health logs adult-only by default.

## Acceptance Criteria

- App is responsive.
- Desktop left nav works.
- Mobile bottom nav works.
- Every major page is reachable.
- Phoenix's status is understandable in five seconds.
- Common care can be logged in under five seconds.
- Meal served/outcome lifecycle exists.
- Potty parent/outcome flow exists.
- Logs are editable.
- Household Pulse and Alone Time exist.
- Health language is non-diagnostic.
- Bile Watch exists.
- Diet & Treats exists.
- Care Pass exists.
- Avatar Studio exists at least as a prototype.
- Light and dark modes work.
- localStorage backup/import is not broken.
- Existing tests pass or failures are documented.

