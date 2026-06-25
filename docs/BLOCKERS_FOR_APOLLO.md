# Blockers For Apollo

## Product Decisions

- Confirm launch target: Expo preview, TestFlight, App Store, web dashboard, or staged launch.
- Confirm subscription packaging and exact paid tiers.
- Confirm whether WoofWatcher should support multiple dogs before paid launch.
- Confirm whether Figma is the canonical visual design source.
- Confirm final high-end animation asset pipeline: code-only Reanimated first, Rive/Lottie assets, Figma-to-code design source, or hired illustrator/motion designer support.
- Confirm if/when saved walk routes should move from owner-entered route/place templates to GPS route recording, map previews, and location retention policy.

## Accounts And Secrets

- GitHub Actions billing/spending limit: the 2026-06-18/2026-06-22 `WoofWatcher Verify` push runs `27755647013` for commit `56096bf`, `27765664335` for commit `c6d4f45`, `27776366919` for commit `a43be6e`, `27801226615` for commit `08b5a61`, `27806984393` for commit `c1c3a54`, `27831252823` for commit `c2682d7`, `27839235544` for commit `dd3b24e`, `27852588748` for commit `f2ce3de`, `27857157145` for commit `8014837`, `27861207712` for commit `197acce`, `27865345974` for commit `5159a3b`, `27865371635` for commit `24d8575`, `27869581404` for commit `8d08825`, `27873733286` for commit `f542db3`, `27878278274` for commit `c915eac`, `27882750930` for commit `de55710`, `27886985255` for commit `536351f`, `27890798715` for commit `0ce53ea`, `27894565111` for commit `0c6371b`, `27898593508` for commit `81647b3`, `27902673966` for commit `c0b1815`, `27907301395` for commit `9411286`, `27911939637` for commit `940a449`, `27916377118` for commit `a6b3951`, `27920782525` for commit `fbe03bb`, `27925717536` for commit `2fccfa2`, and `27931616821` for commit `755ed56` all failed before job start or without executing workflow steps because GitHub reported recent account payments failed or the spending limit needs to be increased. Checked runs surface the annotation `The job was not started because recent account payments have failed or your spending limit needs to be increased.` Runs `27882750930`, `27886985255`, `27890798715`, `27894565111`, `27898593508`, `27902673966`, `27907301395`, `27911939637`, `27916377118`, `27920782525`, `27925717536`, and `27931616821` completed in 3-6 seconds, their `Install, Test, Typecheck, Build` jobs had zero executable steps/logs, and `gh run view --log-failed` returned `log not found: 82513004434`, `log not found: 82523869064`, `log not found: 82533812340`, `log not found: 82543785134`, `log not found: 82554617883`, `log not found: 82565703256`, `log not found: 82578134839`, `log not found: 82590454777`, `log not found: 82602311337`, `log not found: 82614005423`, `log not found: 82627629662`, and `log not found: 82644483194`, matching the same pre-execution blocker shape. Local focused tests and PixelLab asset verification passed for these slices, but CI cannot provide authoritative remote verification until GitHub billing is fixed.
- Latest check, 2026-06-22: `WoofWatcher Verify` run `27939650557` for commit `3683979` failed in 5 seconds before executing `Install, Test, Typecheck, Build`; GitHub reported the same billing/spending-limit annotation, job `82669639349`, and `gh run view --log-failed` returned `log not found: 82669639349`.
- Latest check, 2026-06-22: `WoofWatcher Verify` run `27949441227` for commit `7f32bc9` failed in 4 seconds before executing `Install, Test, Typecheck, Build`; the job `82702372944` had `steps: []`, and `gh run view --log-failed` returned `log not found: 82702372944`, matching the same pre-execution blocker shape.
- Latest check, 2026-06-22: `WoofWatcher Verify` run `27960582957` for commit `448193e` failed in 5 seconds before executing `Install, Test, Typecheck, Build`; the job `82740673249` had `steps: []`, and `gh run view --log-failed` returned `log not found: 82740673249`, matching the same pre-execution blocker shape.
- Latest check, 2026-06-22: `WoofWatcher Verify` run `27971537534` for commit `f02d52f` failed in 5 seconds before executing `Install, Test, Typecheck, Build`; the job `82778705710` had `steps: []`, and `gh run view --log-failed` returned `log not found: 82778705710`, matching the same pre-execution blocker shape.
- Latest check, 2026-06-22: `WoofWatcher Verify` run `27991396683` for commit `2df98bf` failed in 5 seconds before executing `Install, Test, Typecheck, Build`; the job `82844390957` had `steps: []`, and `gh run view --log-failed` returned `log not found: 82844390957`, matching the same pre-execution blocker shape.
- Latest check, 2026-06-25: `WoofWatcher Verify` run `28153490064` for commit `6ea85f9` failed in 4 seconds before executing `Install, Test, Typecheck, Build`; the job `83376404341` had `steps: []`, and `gh run view --log-failed` returned `log not found: 83376404341`, matching the same pre-execution blocker shape.
- Clerk production configuration.
- Database/Supabase production configuration.
- Storage provider for records and generated reports.
- Document upload/storage rules for real record files; local metadata, reminders, and visible storage gates exist, but production file storage is not approved/configured.
- AI provider key and model policy.
- PixelLab secret hygiene. A PixelLab bearer token was visible in a screenshot on 2026-06-17, so it should stay revoked/regenerated and never be committed. PixelLab MCP is now callable in Codex, Apollo has an active subscription, and the Phoenix v2 seed/state pack, full registered sprite manifest, day dogless room, first-pass dogless room variants, 12 Avatar Studio template preview thumbnails, the full 12-template base still pack, the shepherd full live pack, and the full non-shepherd animated launch-pack set with live overlays, full mood stills, and animated preview strips now exist locally. Remaining asset blockers are final visual approval, replacing first-pass derived room variants with fully illustrated PixelLab/Figma-quality variants, and native runtime QA, not MCP access or credits.
- Provider-backed WoofGuide generation, source citations, and permission-aware assistant writes require the AI provider key/model policy plus privacy/account safety rules. Current WoofGuide actions are deterministic owner-reviewed drafts only.
- Expo/EAS, Apple Developer, and Google Play Console accounts. The repo now has EAS build/submit profiles and a mobile release runbook, but no provider account credentials or store submission approval are available to Codex.
- Vercel/API deployment target if applicable.
- Live API integration harness for concurrent care-state writes, care-entry delete retention, role-gated household rename, owner/admin member role updates, household audit review, sensitive household audit producers, invite-code visibility, invite-join provisioning, active-household persistence after invite accept, `/me.households`, active-household switching, the mobile switcher path, and the mobile Pack Audit review path. Focused readiness now protects the static API/mobile contracts and audit producer/review wiring, but a real test database and provider-auth harness are still required before calling those paths live-verified.

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
