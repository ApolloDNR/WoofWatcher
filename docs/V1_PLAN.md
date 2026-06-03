# WoofWatcher v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or equivalent disciplined implementation. This project is intentionally dependency-light and test-first.

**Goal:** Build an installable local-first Phoenix care app that helps two caregivers coordinate meals, walks, training, social exposure, health/vomit tracking, records, reports, and AI-ready care review.

**Architecture:** WoofWatcher v1 is a local-first PWA with a deterministic JavaScript care model, localStorage persistence, print/download reports, and an assistant panel that uses local rules mode unless a server-side OpenAI credential is configured. The app is deployable to Vercel with one optional serverless helper route and usable from iPhone Safari as an installed home-screen app.

**Tech Stack:** Vanilla HTML/CSS/ES modules, Node built-in test runner, localStorage, service worker, web manifest.

---

## Functional Scope

- Phoenix profile with rescue/anxiety-aware notes.
- Two-caregiver handoff visibility without requiring the caregivers to message each other directly.
- Copyable caregiver handoff digest covering the next care action, last meal, last walk, follow-ups, and today's caregiver load.
- Daily routine plan with completed and next care items.
- Quick logs for meals, walks, treats, training, social interactions, dog park visits, health, vomit, vet, weight, medication, and general notes.
- Health watch that highlights repeat vomiting, appetite refusal, urgent severity, and veterinary red flags without diagnosing.
- Records vault for vaccines, vet visits, weight goals, and care instructions.
- Monthly report with export/download and print/PDF behavior.
- Local persistence, JSON backup export/import, reset to demo state, installable PWA shell, offline page, and Vercel-ready static/API serving.
- AI-ready assistant panel that summarizes Phoenix context locally and can call `/api/care-helper` for a live OpenAI Responses API answer when `OPENAI_API_KEY` is configured server-side.

## Test Plan

- Core entry normalization and ID generation.
- Vomit/urgent health follow-up flags.
- Monthly summary aggregation.
- Daily plan completion/next item logic.
- Caregiver handoff digest logic.
- Health watch escalation.
- Export-ready report text with veterinary boundary.
- Syntax checks for all scripts.
- Local server HTTP smoke.
- Browser/Chrome rendered smoke when the runtime is available.
