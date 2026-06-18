# Blockers For Apollo

## Product Decisions

- Confirm launch target: Expo preview, TestFlight, App Store, web dashboard, or staged launch.
- Confirm subscription packaging and exact paid tiers.
- Confirm whether WoofWatcher should support multiple dogs before paid launch.
- Confirm whether Figma is the canonical visual design source.
- Confirm final high-end animation asset pipeline: code-only Reanimated first, Rive/Lottie assets, Figma-to-code design source, or hired illustrator/motion designer support.
- Confirm if/when saved walk routes should move from owner-entered route/place templates to GPS route recording, map previews, and location retention policy.

## Accounts And Secrets

- GitHub Actions billing/spending limit: the 2026-06-17 `WoofWatcher Verify` push run for commit `cd659a3` did not start because GitHub reported recent account payments failed or the spending limit needs to be increased. Local focused tests, mobile typecheck, Expo web export, and browser DOM verification passed, but CI cannot provide authoritative remote verification until GitHub billing is fixed.
- Clerk production configuration.
- Database/Supabase production configuration.
- Storage provider for records and generated reports.
- Document upload/storage rules for real record files; local metadata, reminders, and visible storage gates exist, but production file storage is not approved/configured.
- AI provider key and model policy.
- PixelLab token rotation and local MCP setup. A PixelLab bearer token was visible in a screenshot on 2026-06-17, so it should be revoked/regenerated before use. PixelLab is the preferred Phoenix sprite/template production path, but the MCP server is not callable in this Codex session until Apollo adds it to local Codex config and restarts Codex.
- Provider-backed WoofGuide generation, source citations, and permission-aware assistant writes require the AI provider key/model policy plus privacy/account safety rules. Current WoofGuide actions are deterministic owner-reviewed drafts only.
- Expo/EAS, Apple Developer, and Google Play Console accounts. The repo now has EAS build/submit profiles and a mobile release runbook, but no provider account credentials or store submission approval are available to Codex.
- Vercel/API deployment target if applicable.

## Development Environment

- Local Windows shell currently lacks `pnpm`, `npm`, `corepack`, and `node_modules`, so `pnpm run typecheck` cannot run locally even though zero-install Node behavior tests pass.
- Codex could not attach to the in-app Browser target during the 2026-06-13 visual QA attempt (`iab` unavailable), so local screenshot/runtime verification is still pending in Fable/Replit or another browser-capable environment.

## Legal, Privacy, And Safety

- Privacy policy for pet health notes, documents, AI usage, and household sharing.
- Terms and support scope before subscriptions.
- Provider-backed account deletion policy; mobile can export owner care data and prepare a non-destructive deletion request, but self-serve destructive deletion is not enabled.
- Veterinary disclaimer language.
- Document storage access rules.

## External Source Notes

The Apollo shared thread was reachable via approved network fetch on 2026-06-08. Standard unauthenticated web tooling did not render the conversation directly; extraction used embedded share-page data.
