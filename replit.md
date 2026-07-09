# WoofWatcher

WoofWatcher is a mobile-first shared dog care OS for routines, logging, health
patterns, records, caregiver handoff, and AI-assisted care.

## Preview And Host On Replit

The fastest way to see the app in a browser is the static Expo **web export**
of the mobile app - no native tooling, no secrets, no backend required. It is
exactly the build used for QA screenshots.

- **Run button:** press Run. The `Project` workflow builds the web export the
  first time (a few minutes) and serves it on port 8080, which Replit maps to
  the webview. Later runs reuse the export and start instantly.
- **Manual (Replit shell):**
  - `pnpm install`
  - `pnpm run preview` - build-if-needed, then serve on `0.0.0.0:$PORT`
    (8080 via the Run button; falls back to 4194 locally).
  - `pnpm run preview:rebuild` - force a fresh export first.
- **Deploy (Publish):** the autoscale deployment builds `smoke:web` and serves
  the export via `preview:web`. It is a fully client-side single-page app
  (local-first storage), so it needs no server secrets to preview or host.

Notes:
- The web export is the **preview/host** surface. Native iOS/Android builds
  still go through EAS on an Apple/Google developer account - Replit cannot
  produce store binaries.
- Auth/cloud features are owner-gated and inert in the export, so the preview
  runs in local-first guest mode by design.

## Run And Operate

- `pnpm --filter @workspace/api-server run dev` - run the API server.
- `pnpm --filter @workspace/woofwatcher-mobile run dev` - run the Expo mobile app.
- `pnpm --filter @workspace/care-domain test` - run shared care-domain tests.
- `pnpm run typecheck` - full TypeScript check across referenced packages.
- `pnpm run build` - typecheck and build packages with build scripts.
- `pnpm run doctor:mobile-beta` - check the two-day mobile beta export handoff.
- `pnpm run doctor:mobile-beta:json` - emit machine-readable beta readiness for helpers.
- `pnpm --filter @workspace/api-spec run codegen` - regenerate API hooks and Zod schemas.
- `pnpm --filter @workspace/db run push` - push DB schema changes in development.

## Stack

- Workspace: pnpm 10.24.0, Node 24, TypeScript 5.9.
- Mobile: Expo, Expo Router, React Native, Clerk, React Query.
- API: Express 5, Clerk auth, Gemini integration.
- DB: PostgreSQL and Drizzle ORM.
- Contracts: OpenAPI, Orval-generated API client, Zod validation.
- Domain: `@workspace/care-domain` owns canonical care event types and care
  status helpers.

## Where Things Live

- `artifacts/woofwatcher-mobile` - primary mobile app.
- `artifacts/api-server` - backend API.
- `artifacts/woofwatcher` - web prototype/dashboard surface.
- `artifacts/mockup-sandbox` - design sandbox.
- `lib/care-domain` - shared care vocabulary and status logic.
- `lib/db` - Drizzle schema.
- `lib/api-spec` - OpenAPI source.
- `lib/api-client-react` - generated API hooks/client.
- `lib/api-zod` - generated validation schemas.
- `docs/superpowers/specs` - approved product/design specs.
- `docs/superpowers/plans` - implementation plans.
- `docs/operations/ENVIRONMENT.md` - env and deployment notes.

## Architecture Decisions

- The mobile app is the canonical product surface.
- The web app is not the source of truth for product UX until intentionally
  redesigned as a dashboard/admin surface.
- Care logs live as `care_entries` rows so simultaneous caregivers do not
  clobber each other.
- Shared dog profile, routines, records, diet, and calendar data live in
  `care_state`.
- Event taxonomy belongs in `lib/care-domain`, not in individual screens.

## Product

WoofWatcher should answer four questions quickly:

1. What does the dog need now?
2. What already happened?
3. What needs attention?
4. What should the next caregiver know?

Every button, card, empty state, motion, and AI response should connect to a
care action, explanation, handoff, record, insight, or assistant workflow.

## Gotchas

- Production API deployments must set `ALLOWED_ORIGINS`.
- Missing Clerk publishable key breaks the mobile auth flow.
- This repo currently requires pnpm 10.24.0; npm install is intentionally blocked.
  If pnpm is missing and Corepack is available, run `corepack prepare pnpm@10.24.0 --activate`.
- The local Codex environment may have Node available without pnpm/npm.
- Do not paste secrets into chat or commit env files.
