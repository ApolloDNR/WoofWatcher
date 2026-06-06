# WoofWatcher

WoofWatcher is a mobile-first shared dog care OS for coordinating routines,
logs, health patterns, records, handoffs, and AI-assisted care.

## Primary App

- Mobile app: `artifacts/woofwatcher-mobile`
- API server: `artifacts/api-server`
- Shared packages: `lib/*`
- Web app/dashboard prototype: `artifacts/woofwatcher`
- Design/mockup sandbox: `artifacts/mockup-sandbox`

The mobile app is the primary product surface. The web app is currently a
prototype/dashboard surface and should not be treated as the canonical product
experience until it is intentionally brought into parity.

## Local Setup

This repo is a pnpm workspace.

1. Install Node 24.
2. Enable pnpm with Corepack or install pnpm directly.
3. Copy `.env.example` to `.env.local` and fill required values.
4. Install dependencies with `pnpm install`.
5. Run typecheck with `pnpm run typecheck`.

## Important Scripts

- `pnpm run typecheck` checks workspace TypeScript.
- `pnpm run build` typechecks and builds packages with build scripts.
- `pnpm --filter @workspace/api-server run dev` starts the API server.
- `pnpm --filter @workspace/woofwatcher-mobile run dev` starts Expo.
- `pnpm --filter @workspace/care-domain test` runs zero-dependency domain tests.
- `pnpm --filter @workspace/api-spec run codegen` regenerates API client and Zod schemas.
- `pnpm --filter @workspace/db run push` pushes DB schema changes in development.

## Product Direction

The approved product direction is documented in:

`docs/superpowers/specs/2026-06-06-woofwatcher-dog-care-os-design.md`

The first implementation slice is documented in:

`docs/superpowers/plans/2026-06-06-woofwatcher-foundation-slice.md`

## Development Priorities

1. Keep the mobile app as the canonical user experience.
2. Keep event types and care-status logic in `lib/care-domain`.
3. Avoid adding UI elements that do not connect to a care action, explanation,
   handoff, record, insight, or assistant workflow.
4. Treat care logs as important user data. Failed sync should be visible and
   recoverable.
5. Keep medical guidance bounded: WoofWatcher tracks care patterns for caregiver
   and veterinarian review; it does not diagnose.
