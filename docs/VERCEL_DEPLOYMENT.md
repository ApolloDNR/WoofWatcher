# Vercel Deployment Notes

WoofWatcher v1 is a local-first PWA with one optional serverless API route for the live OpenAI helper. Vercel can serve the app without a framework build step.

## Project Settings

- Framework preset: Other
- Root directory: `projects/woofwatcher`
- Build command: leave empty
- Output directory: `.`
- Install command: leave empty

`vercel.json` rewrites unknown non-API routes to `index.html` while excluding `/api/*` so the live helper function can respond normally. PWA shortcut URLs such as `/?tab=log` do not require a path rewrite, but the fallback keeps future non-API app routes safe.

## Environment Variables

No environment variables are required for local-first mode.

For live OpenAI helper mode, add:

```text
OPENAI_API_KEY
OPENAI_MODEL
```

`OPENAI_MODEL` is optional and defaults to `gpt-5.5`. Do not expose the key to client-side JavaScript.

## Post-Deploy Smoke

1. Load `/`.
2. Load `/api/care-helper` and confirm it returns JSON with `configured` true or false.
3. Load `/?tab=schedule` and add a test routine.
4. Load `/?tab=goals` and add a test goal.
5. Load `/?tab=calendar` and confirm the current-month grid and selected-day panel render.
6. Load `/?tab=progress` and confirm the training/social progress review renders.
7. Load `/?tab=records` and add a test vaccine or vet record.
8. Load `/?tab=log`.
9. Add a test care log.
10. Confirm the Today routine, caregiver handoff, Calendar selected-day evidence, Progress evidence, and Records vault update.
11. Open `/?tab=report` and download the report.
12. Open `/?tab=assistant`; if `OPENAI_API_KEY` is not configured, confirm local mode still answers.
13. Open DevTools Application or the browser install prompt and confirm the manifest is detected.
