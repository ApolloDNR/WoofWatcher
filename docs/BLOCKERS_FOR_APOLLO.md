# Blockers For Apollo

## Product Decisions

- Confirm launch target: Expo preview, TestFlight, App Store, web dashboard, or staged launch.
- Confirm subscription packaging and exact paid tiers.
- Confirm whether WoofWatcher should support multiple dogs before paid launch.
- Confirm whether Figma is the canonical visual design source.
- Confirm final high-end animation asset pipeline: code-only Reanimated first, Rive/Lottie assets, Figma-to-code design source, or hired illustrator/motion designer support.
- Confirm if/when saved walk routes should move from owner-entered route/place templates to GPS route recording, map previews, and location retention policy.

## Accounts And Secrets

- GitHub Actions billing/spending limit: the 2026-06-18/2026-06-19 `WoofWatcher Verify` push runs `27755647013` for commit `56096bf`, `27765664335` for commit `c6d4f45`, `27776366919` for commit `a43be6e`, `27801226615` for commit `08b5a61`, `27806984393` for commit `c1c3a54`, `27831252823` for commit `c2682d7`, `27839235544` for commit `dd3b24e`, and `27852588748` for commit `f2ce3de` all failed before job start because GitHub reported recent account payments failed or the spending limit needs to be increased. The newest run surfaced the annotation `The job was not started because recent account payments have failed or your spending limit needs to be increased.` Local focused tests and PixelLab asset verification passed for these slices, but CI cannot provide authoritative remote verification until GitHub billing is fixed.
- Clerk production configuration.
- Database/Supabase production configuration.
- Storage provider for records and generated reports.
- Document upload/storage rules for real record files; local metadata, reminders, and visible storage gates exist, but production file storage is not approved/configured.
- AI provider key and model policy.
- PixelLab secret hygiene. A PixelLab bearer token was visible in a screenshot on 2026-06-17, so it should stay revoked/regenerated and never be committed. PixelLab MCP is now callable in Codex, Apollo has an active subscription, and the Phoenix v2 seed/state pack, full registered sprite manifest, day dogless room, first-pass dogless room variants, 12 Avatar Studio template preview thumbnails, the full 12-template base still pack, the shepherd full live pack, and the full non-shepherd animated launch-pack set with live overlays, full mood stills, and animated preview strips now exist locally. Remaining asset blockers are final visual approval, replacing first-pass derived room variants with fully illustrated PixelLab/Figma-quality variants, and native runtime QA, not MCP access or credits.
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
