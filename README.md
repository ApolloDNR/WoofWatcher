# WoofWatcher

WoofWatcher is a mobile-first care dashboard for Phoenix, a rescued shepherd mix who needs consistent shared routines, meal tracking, anxiety-aware notes, and health-event logging.

## What this prototype covers

- Shared daily schedule for meals, walks, enrichment, and bedtime snack reminders.
- Quick logging for meals, walks, health events, training, and social interactions.
- Monthly summary counts for care notes, meals, walks, and vomit/bile mentions.
- Timeline-style calendar that helps caregivers see who did what and when.
- Print/export flow for a simple PDF-style monthly care report.
- AI-ready prompt area showing how a future ChatGPT helper could use Phoenix's recent logs while still emphasizing veterinarian red flags.

## Run locally

```bash
npm install
npm run start
```

The app stores demo and new entries in `localStorage`, so it works as a front-end prototype without a backend.

## Product direction

Future iterations can add caregiver accounts, push reminders, vet/vaccine document storage, weight charts, richer PDF exports, and an OpenAI-powered care assistant that grounds answers in Phoenix's logged history.
