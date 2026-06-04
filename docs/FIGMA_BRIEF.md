# WoofWatcher Figma Brief

Use this brief to recreate or refine the v1 screen in Figma.

## Product Direction

WoofWatcher is a calm care command center for Phoenix, an anxious rescued shepherd mix. It should feel useful to two adults coordinating real care, not like a cute pet novelty app.

## Required Screens

- Today dashboard: Phoenix profile, health status, routines, next handoff, quick log, recent timeline.
- Care Team: editable caregiver names/roles, today load, rename continuity, add/remove controls.
- Reminder Center: completed, due, overdue, upcoming, and flexible routine proof with one-tap logging plus local phone-alert readiness.
- Care Room Transfer: caregiver handoff package with current state, report context, import/export controls, and privacy boundary.
- Schedule: editable care routine list plus add-routine form for meals, walks, snacks, medication, training, and ownership.
- Goals: progress review plus editable milestones for weight, training, anxiety, social exposure, health, and custom targets.
- Calendar: monthly day grid with logged-day density, vomit/review days, care markers, and selected-day evidence.
- Progress: training/social review with calm wins, struggle signals, dog interactions, focus areas, and recent evidence.
- Quick Log: event form plus recent entries.
- Health Watch: signals, red flags, health timeline.
- Records: editable vet/vaccine/weight/instruction records plus add/remove controls.
- Report: monthly metrics, report preview, copy/download/print controls.
- Helper: local/AI-ready question box and care-context answer.

## Visual System

- Background: Midnight `#1A2332` and Navy `#243044`.
- Accent: Copper `#C87A3A`, used sparingly for action and status.
- Surfaces: Cream/off-white text and report panels.
- Supporting signals: sage for steady, amber for watch, rose for review.
- Radius: 8px or less for panels and controls.
- Typography: Inter or system UI; no playful pet-store type.

## Current Reference

Use `docs/woofwatcher-v1-concept.png` as the initial concept reference, but the implementation corrects detail drift from the generated image: Phoenix is referred to as a female rescued shepherd mix by context, and the app avoids fake medical certainty.

The existing Figma file `165jvlaygkksRtXW1bA1MA` includes:

- `WoofWatcher v1 - Goals & Milestones` at node `8:2`.
- `WoofWatcher v1 - Care Calendar` at node `9:2`.
- `WoofWatcher v1 - Training Progress` at node `11:2`.
- `WoofWatcher v1 - Care Room Transfer` at node `13:2`.
- `WoofWatcher v1 - Care Team` at node `20:2`.
- `WoofWatcher v1 - Reminder Center` at node `24:2`, updated with app-open notification readiness.
