# WoofWatcher v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or equivalent disciplined implementation. This project is intentionally dependency-light and test-first.

**Goal:** Build an installable local-first Phoenix care app that helps two caregivers coordinate meals, walks, training, social exposure, health/vomit tracking, records, reports, and AI-ready care review.

**Architecture:** WoofWatcher v1 is a local-first PWA with a deterministic JavaScript care model, localStorage persistence, print/download reports, and an assistant panel that uses local rules mode unless a server-side OpenAI credential is configured. The app is deployable to Vercel with one optional serverless helper route and usable from iPhone Safari as an installed home-screen app.

**Tech Stack:** Vanilla HTML/CSS/ES modules, Node built-in test runner, localStorage, service worker, web manifest.

---

## Functional Scope

- Phoenix profile with rescue/anxiety-aware notes.
- Two-caregiver handoff visibility without requiring the caregivers to message each other directly.
- Editable care team profiles for caregiver names and roles, with rename continuity across matching logs and exact routine owners.
- Copyable caregiver handoff digest covering the next care action, last meal, last walk, follow-ups, and today's caregiver load.
- Importable care room transfer package containing Phoenix state, caregiver handoff, health context, and monthly report for caregiver/device handoff without accounts.
- Editable daily routine schedule with care times, owners, notes, completed items, and next care items.
- Reminder Center that derives completed, due, overdue, upcoming, and flexible care proof from the daily routine and today's logs, with one-tap routine logging.
- Local notification readiness for due/overdue reminders, including permission prompt, test alert, app-open nudges, and an explicit boundary that closed-app push requires hosted notification infrastructure.
- Editable goals and milestones for weight, training, anxiety, social exposure, health, and custom care targets.
- Monthly care calendar with day-level care density, vomit days, review days, walk/training/social markers, and selected-day timeline evidence.
- Training and social progress review with calm wins, struggle signals, dog-interaction counts, focus areas, and monthly report inclusion.
- Quick logs for meals, walks, treats, training, social interactions, dog park visits, health, vomit, vet, weight, medication, and general notes.
- Health watch that highlights repeat vomiting, appetite refusal, urgent severity, and veterinary red flags without diagnosing.
- Editable records vault for vaccines, vet visits, weight goals, medication, microchip details, and care instructions.
- Monthly report with export/download and print/PDF behavior.
- Local persistence, JSON backup export/import, care room transfer export/import, reset to demo state, installable PWA shell, offline page, and Vercel-ready static/API serving.
- AI-ready assistant panel that summarizes Phoenix context locally and can call `/api/care-helper` for a live OpenAI Responses API answer when `OPENAI_API_KEY` is configured server-side.

## Test Plan

- Core entry normalization and ID generation.
- Vomit/urgent health follow-up flags.
- Monthly summary aggregation.
- Monthly care calendar aggregation, day markers, review-day counts, and vomit-day counts.
- Training progress aggregation, calm/struggle signal detection, wins, focus areas, and report inclusion.
- Daily plan completion/next item logic.
- Reminder Center status classification, local-time due windows, overdue flags, and unscheduled/flexible item handling.
- Notification readiness status, permission state, due reminder payload, unsupported browser boundary, and app-open delivery boundary.
- Editable routine normalization, ordering, add/update, and removal.
- Caregiver profile add/update/removal, including rename migration for matching logs and exact routine owners.
- Goal normalization, add/update/removal, progress review, and report inclusion.
- Record normalization, add/update/removal, and backup restore safety.
- Caregiver handoff digest logic.
- Care room transfer package generation and import normalization.
- Health watch escalation.
- Export-ready report text with veterinary boundary.
- Syntax checks for all scripts.
- Local server HTTP smoke.
- Browser/Chrome rendered smoke when the runtime is available.
