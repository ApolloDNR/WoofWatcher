# Blockers For Apollo

## Product Decisions

- Confirm launch target: Expo preview, TestFlight, App Store, web dashboard, or staged launch.
- Confirm subscription packaging and exact paid tiers.
- Confirm whether WoofWatcher should support provider-backed multi-dog switching before paid launch. Local CareTwin roster staging exists now, but scoped per-dog care documents still need provider/database approval.
- Confirm whether Access Pass should become a launch feature or post-launch feature. Local Access Pass drafts exist now, but real helper access requires provider-backed invites, revocation, role enforcement, helper audit trails, and legal/privacy approval.
- Confirm whether Adventure Mode should remain a private local memory feature for launch or include provider-backed photo storage, map/location retention, share links, or community discovery. The local quest/memory foundation exists now; cloud media, maps, public sharing, and community safety are not approved or live.
- Confirm whether Figma is the canonical visual design source.
- Confirm final high-end animation asset pipeline: code-only Reanimated first, Rive/Lottie assets, Figma-to-code design source, or hired illustrator/motion designer support.
- Confirm if/when saved walk routes should move from owner-entered route/place templates to GPS route recording, map previews, and location retention policy.

## Accounts And Secrets

- GitHub Actions billing/spending limit: the 2026-06-18 `WoofWatcher Verify` push runs `27755647013` for commit `56096bf`, `27765664335` for commit `c6d4f45`, `27776366919` for commit `a43be6e`, and later main runs remained blocked or failed before useful verification because GitHub reported recent account payments failed or the spending limit needs to be increased. The 2026-06-18 manual branch run `27796825751` for commit `b11f59b` failed with zero recorded job steps and unavailable logs, matching the latest main failure signature. The 2026-06-18 manual branch run `27798306159` for commit `8818776` also failed in 7 seconds, and `gh run view --log-failed` returned `log not found: 82262854559`. The 2026-06-20 manual branch run `27863411307` for commit `846eac7` failed before job start with GitHub's annotation that recent account payments failed or the spending limit needs to be increased. The 2026-06-20 manual branch run `27864618978` for commit `abfb266` repeated the same pre-start billing/spending-limit annotation. The 2026-06-20 manual branch run `27865616195` for commit `c5190ef` failed in 5 seconds, and `gh run view --log-failed` returned `log not found: 82469117700`, matching the same pre-job failure pattern. The 2026-06-20 manual branch run `27866723462` for commit `db218c8` failed in 5 seconds with the annotation: "The job was not started because recent account payments have failed or your spending limit needs to be increased," and `gh run view --log-failed` returned `log not found: 82471952018`. Local focused tests, 298 behavior/readiness tests, mobile typecheck, PixelLab asset verification at 149 files, Expo web export, and `git diff --check` passed for the latest slice, but CI cannot provide authoritative remote verification until GitHub billing/platform execution is fixed.
- Local Expo web export in the premium revenue builder worktree is no longer blocked. The package-local Expo CLI plus Metro resolver patch exported the app successfully on 2026-06-18 and again in the 2026-06-20 platform-evidence slice. A tested care-twin native QA matrix now exists in `docs/release/CARE_TWIN_NATIVE_QA_MATRIX.md`, and the app exposes it through `/care-twin-qa` in development/internal builds with Pass/Needs tune notes plus a native shareable QA report. As of 2026-06-20, that route also captures Mobile Release QA evidence for Phoenix Home, Care Twin State Lab, Avatar Studio, Incident Composer, Records Incident Watch, and Trainer Care Pass, autosaves the QA session locally, can attach local screenshot evidence from the device photo library to the matching surface/state, tracks iOS versus Android screenshot coverage separately, and shows tested Native proof open/ready plus missing iOS/Android/flexible evidence copy. Real iOS/Android simulator or device screenshots are still required before release confidence, and provider-backed QA screenshot storage is not enabled until storage/provider rules are approved.
- Clerk production configuration.
- Database/Supabase production configuration.
- Provider/database rules for multi-dog care document scoping, including per-dog logs, routines, records, reports, avatars, privacy export, and household permissions.
- Storage provider for records and generated reports.
- Document upload/storage rules for real record files; local metadata, reminders, visible storage gates, and local-only medication proof attachment now exist, but durable cross-device production file storage is not approved/configured.
- AI provider key and model policy.
- PixelLab secret hygiene. A PixelLab bearer token was visible in a screenshot on 2026-06-17, so it should stay revoked/regenerated and never be committed. PixelLab MCP is now callable in Codex, Apollo has an active subscription, and the Phoenix v2 seed/state pack, full registered sprite manifest, active Option B dogless day room, PixelLab final-candidate night/bedtime/health-watch/home-alone rooms, the full current Option B hard-pixel Phoenix runtime candidate family including a dedicated bark/tap reaction, 12 Avatar Studio template preview thumbnails, the full 12-template base still pack, the first shepherd accessory overlay PNG pack, the first shepherd 10-state emote still pack, and the Retriever, Husky/Spitz, and Bully 10-state template emote packs now exist locally, plus the 10-item inventory accessory pack, two subscription seed animation strips, live idle/walk sprite packs for every non-Phoenix launch template, and a live Shepherd/Phoenix Avatar Studio sprite registration backed by the approved Option B strips. The 2026-06-19 subscription-backed Phoenix replacement review archived one clean still reference but rejected the duplicate/cropped and identity-drift candidates, and a pro quadruped job `be24cc90-7a69-4859-b9b2-42e73a2124cd` is queued for later review only, so remaining asset blockers are final visual approval, native phone-size QA, remaining template accessory/emote packs, true overlay alignment, body-class refinements, stronger reference-guided generation prompts, and gait QA, not MCP access or credits.
- Provider-backed WoofGuide generation, source citations, and permission-aware assistant writes require the AI provider key/model policy plus privacy/account safety rules. Current WoofGuide actions are deterministic owner-reviewed drafts only.
- Provider-backed Adventure media, map/location services, share links, and community discovery require storage/provider selection, retention rules, household sharing permissions, moderation/safety policy, and App Store/Play privacy disclosure before launch.
- Expo/EAS, Apple Developer, and Google Play Console accounts. The repo now has EAS build/submit profiles and a mobile release runbook, but no provider account credentials or store submission approval are available to Codex.
- Vercel/API deployment target if applicable.

## Development Environment

- The local Windows shell still relies on the bundled Node runtime and package-local CLIs instead of a normal global `pnpm`/`npm` setup. Current focused tests, mobile TypeScript, PixelLab asset verification, and Expo web export pass through those paths.
- The 2026-06-13 in-app Browser attach blocker is superseded for web visual smoke: headless Chrome captured `/portrait` and Home from the exported build on 2026-06-18 and again supported the 2026-06-19 Option B living-room/Avatar Studio polish pass. Native iOS/Android visual QA is still pending, now with a concrete care-twin state matrix to execute once runtime access is available.

## Legal, Privacy, And Safety

- Privacy policy for pet health notes, documents, AI usage, household sharing, and temporary helper Access Passes.
- Privacy policy for Adventure photos, memory captions, location/map data, sharing, and any community discovery if Adventure grows beyond local private drafts.
- Terms and support scope before subscriptions.
- Provider-backed account deletion policy; mobile can export owner care data and prepare a non-destructive deletion request, but self-serve destructive deletion is not enabled.
- Veterinary disclaimer language.
- Document storage access rules.

## External Source Notes

The Apollo shared thread was reachable via approved network fetch on 2026-06-08. Standard unauthenticated web tooling did not render the conversation directly; extraction used embedded share-page data.
