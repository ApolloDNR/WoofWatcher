# Premium Revenue Product Builder

## Purpose

`Premium Revenue Product Builder` is the recurring autonomous build loop for WoofWatcher. Its job is to keep moving the app toward a premium mobile-first dog-care operating system without requiring Apollo to approve routine engineering decisions.

## Operating Mode

- Name: Premium Revenue Product Builder
- Product: WoofWatcher
- Canonical app: `artifacts/woofwatcher-mobile`
- Shared domain logic: `lib/care-domain`
- API: `artifacts/api-server`
- Sandbox: workspace-write
- Approval policy target: approve for routine local work where the platform allows it; never request approval for normal code edits, tests, docs, commits, or queue updates
- Cadence target: every 3 hours
- Worktree target: `../woofwatcher-premium-revenue-product-builder`
- Branch target: `automation/premium-revenue-product-builder`

## Required Read Order

Every run must read:

1. `AGENTS.md`
2. `docs/APOLLO_VISION_SYNTHESIS.md`
3. `docs/30_YEAR_NORTH_STAR.md`
4. `docs/MONEY_RELEASE_PLAN.md`
5. `docs/AUTONOMOUS_BUILD_QUEUE.md`
6. `docs/QUALITY_GATES.md`
7. `docs/QA_TEST_PLAN.md`
8. `docs/ULTIMATE_RELEASE_PLAN.md`
9. `docs/DECISION_LOG.md`
10. `docs/BLOCKERS_FOR_APOLLO.md`

## Work Loop

1. Inspect `git status --short --branch`.
2. Pull `main`.
3. Ensure the dedicated worktree exists.
4. Read the required docs.
5. Pick the highest-impact unfinished task from `docs/AUTONOMOUS_BUILD_QUEUE.md`.
6. Write or update behavior tests before implementation when the slice changes behavior.
7. Implement the smallest complete product slice.
8. Run focused tests.
9. Run typecheck/build when dependencies are available.
10. Fix introduced failures.
11. Update docs, decisions, blockers, quality gates, and the queue.
12. Commit with a clear product-facing message.
13. Push.
14. Check GitHub Actions `WoofWatcher Verify`.
15. If CI fails, fetch logs, fix, commit, push, and re-check.

## Verification Commands

Focused behavior tests:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\*.test.ts lib\care-domain\test\*.test.ts
```

Full CI-equivalent command when `pnpm` and dependencies are installed:

```powershell
pnpm run build:ci
```

GitHub Actions:

```powershell
& "C:\Users\Apoll\OneDrive\Documentos\New project\tools\gh\bin\gh.exe" run list --repo ApolloDNR/WoofWatcher --limit 3
```

Manual verification trigger if a push updates `main` without creating an Actions run:

```powershell
& "C:\Users\Apoll\OneDrive\Documentos\New project\tools\gh\bin\gh.exe" workflow run verify.yml --repo ApolloDNR/WoofWatcher --ref main
```

## Normal Decisions The Automation May Make

- Implementation order within the active queue.
- Small UI copy, layout, routing, and empty-state decisions.
- Test additions and focused refactors.
- Domain helper extraction.
- Queue and docs updates after verified work.
- Bug fixes discovered while implementing the chosen slice.

## Stop Conditions

Stop only for:

- missing secrets or credentials,
- destructive database or user-data risk,
- production deployment approval,
- App Store or Play Store submission approval,
- legal/compliance review,
- money movement,
- regulated health advice boundaries,
- source-of-truth contradictions.

## Current Next Slice

As of 2026-06-22, the current queue points to native runtime QA and premium polish. The mobile app now has a registered full Phoenix sprite manifest, first-pass dogless room variants, PixelLab frame-to-strip tooling, room-variant tooling, a 12-item Avatar Studio template preview catalog, a full 12-template base still pack, full animated launch template packs, premium board anatomy across the core routes, release-grade Expo identity, EAS profiles, local-first care workflows, report/handoff surfaces, medication/water/walk/potty/training/alone-time/weight/grooming derivations, bounded WoofGuide drafts, and shared safe-area/accessibility contracts for bottom route clearance, composers, modal sheets, floating feedback, centered prompts, route top clearance, error-recovery debug controls, keyboard avoidance, inline hit slop, and 48px touch targets.

Latest completed local runtime/accessibility hardening:

- Home header navigation controls now use the shared `MIN_MOBILE_TOUCH_TARGET` 48px contract. The More menu and Health Watch notification buttons have mobile readiness coverage before native accessibility traversal is available.
- Error recovery debug and close controls now use the shared `MIN_MOBILE_TOUCH_TARGET` 48px contract. The development error-details button and error-details modal close control have mobile readiness coverage before native accessibility traversal is available.
- Calendar event discovery and upcoming-event controls use the shared `MIN_MOBILE_TOUCH_TARGET` 48px contract. The discover icon, suggested-event icon, upcoming-event icon, and remove-event control have mobile readiness coverage before native accessibility traversal is available.
- Plans routine/event modal controls use the shared `MIN_MOBILE_TOUCH_TARGET` 48px contract. Routine type chips, owner quick chips, save buttons, delete routine, and add-event save controls have mobile readiness coverage before native accessibility traversal is available.
- Auth onboarding action controls use the shared `MIN_MOBILE_TOUCH_TARGET` 48px contract. The primary auth button and Google SSO button have mobile readiness coverage before native accessibility traversal is available.
- Living Phoenix room tap cues use the shared mobile tap contract. The animated care-twin room pressable uses `MOBILE_INLINE_HIT_SLOP`, and the visible status/next-action cue chips use `MIN_MOBILE_TOUCH_TARGET` before native accessibility traversal is available.
- Remaining high-frequency route actions use the shared `MIN_MOBILE_TOUCH_TARGET` 48px contract. Quick Log launcher tabs and outbox retry, Records empty-add/delete controls, More Care Intelligence/tool/premium/profile-edit actions, and Privacy export/delete buttons have mobile readiness coverage before native accessibility traversal is available.
- Onboarding and Avatar Studio creation actions expose explicit screen-reader roles, labels, and state where relevant. Shared auth primary/Google buttons, Setup starter-routine/save/finish-later actions, and Avatar Studio reset/save controls now have mobile readiness coverage before native accessibility traversal is available.
- Avatar Studio owner-input controls now finish the shared mobile touch-target pass. Scan gallery/camera actions, template tiles, accessory tiles, and mood preview chips use the shared `MIN_MOBILE_TOUCH_TARGET` floor, and face-marking choices expose explicit screen-reader labels before native accessibility traversal is available.
- API route contract readiness now runs in the focused test suite before live database/provider integration tests are available. Authenticated household scoping, care-state optimistic conflicts, household-isolated care-entry writes, and the `/care-entries?limit=` query contract are covered across the API routes, OpenAPI, zod, and generated React client types.
- Server-backed care-entry deletes now retain a household audit note before final live retention policy work. The API creates a non-health audit note with the deleted-entry snapshot and audit trail after a scoped delete, and mobile Log avoids duplicate local audit notes for synced deletes while preserving local/offline deletion audits.
- Care-state optimistic writes now use an atomic household-and-version update before live database/provider integration tests are available. A raced write refetches the latest household care document and returns the existing recoverable 409 response shape instead of clobbering newer shared care data.
- Household member profile updates now stay active-household scoped before provider-backed role enforcement. `PATCH /me` keeps the global user display-name update, but the household member display-name row is constrained by both authenticated user id and active household id.
- Household rename is now owner/admin gated before provider-backed role enforcement. `PATCH /household` checks the authenticated user's active-household membership role and returns 403 for non-owner/admin members before changing the shared pack name.
- Household invite joins now avoid creating a throwaway default pack before accepting an invite. `POST /household/join` provisions the authenticated user directly, ensures the invited household has care state, avoids duplicate memberships, and adds first-time invitees as `member`.
- Household invite codes are now visible only to owner/admin members in `/me` before provider-backed role enforcement. Ordinary members still receive the shared household context, but invite sharing stays unavailable so care contributors cannot spread pack access.
- Household invite accepts now persist the joined pack as the user's active household before explicit household switching exists. Later active-household care-state, care-entry, profile, and household routes stay pointed at the joined pack when that membership is still valid.
- Active-household switching now has a membership-scoped API contract before mobile switching UI exists. `PATCH /me/active-household` only accepts households where the authenticated user is already a member, ensures care-state readiness, updates `users.activeHouseholdId`, and returns the selected household context across the OpenAPI/zod/generated React client contract.
- Mobile active-household switching now turns that API contract into an owner-visible More workflow. `/me` returns the authenticated user's existing household list with per-pack invite-code gating, the Care Team surface lets caregivers switch the active sync pack, and successful switches refresh `/me` plus care state so routines and logs stay pointed at the selected household.
- Household audit review now has an owner/admin API contract before final provider-backed account audit policy. `household_audit_events` is modeled as a durable household-scoped table, `GET /household/audit-events` requires owner/admin membership, normalizes list filters, and is documented across OpenAPI/zod/generated React client contracts.
- Sensitive household actions now write durable audit events before final provider-backed account audit policy. Default household creation, household rename, active-household switching, and invite acceptance insert `household.created`, `household.renamed`, `household.active_changed`, and `household.member_joined` events so owner/admin audit review has real household trust transitions to inspect.
- Mobile More now exposes Pack Audit review for those owner/admin household trust events. The board uses the generated `useListHouseholdAuditEvents` hook, lists recent pack creation, rename, active-household switching, and invite-join events, supports review filters, summarizes stored event details in owner-readable row and screen-reader copy, and keeps loading, empty, and offline states truthful while lifecycle changes, retention, export, and deletion remain provider-gated.
- Household member role updates now have a bounded owner/admin API contract before full provider-backed caregiver administration. `PATCH /household/members/{memberId}` updates existing active-household memberships to admin/member/sitter/trainer/vet viewer, refuses owner demotion, writes a durable role-change audit event, and is covered across OpenAPI, zod, generated React client, and focused API readiness.
- Mobile Care Team now exposes that bounded role-update contract for existing synced non-owner members. The More surface uses the generated role mutation, keeps admin/member/sitter/trainer/vet viewer chips 48px and accessible, refreshes `/me`, refetches Pack Audit on success, and keeps owner transfer, member removal, invite approval, and final permission policy provider-gated.
- Household Access now keeps the launch role set owner-readable before final provider enforcement. The shared domain helper labels owner, admin, sitter, trainer, and vet viewer roles with scoped permission summaries, and Mobile More displays those summaries under each Care Team person without leaking internal role ids.
- Vet viewer API memberships are now read-only for shared care writes before final provider-backed permission policy. Care-plan writes and care-log writes have separate role guards so `PUT /care-state` is limited to owner/admin/member roles, `POST/PATCH/DELETE /care-entries` remains open to owner/admin/member/sitter/trainer roles, and vet viewers receive a clear 403 on both mutation surfaces.
- Sitter and trainer API log corrections are now scoped to their own care-entry evidence. `POST /care-entries` remains available to those helper roles, but `PATCH` and `DELETE` add `caregiverUserId` matching for sitter/trainer members so they cannot alter another caregiver's log before final provider-backed permission policy exists.
- Mobile Pack Audit role-change rows now keep the trust trail owner-readable. Role-change audit details use launch role labels and previous-to-new copy instead of exposing internal ids such as `vet_viewer`, with mobile readiness coverage for rows and accessibility labels.
- Pack Audit role-change rows now name the affected caregiver. The API stores `targetDisplayName` and `targetEmail` in durable role-change audit details, and Mobile More renders caregiver-specific trust rows while preserving fallback copy for older audit events.
- Mobile Care Team role-management copy now uses the same launch role labels as Pack Audit and Household Access. Current-role rows and role-update success confirmations render owner-readable labels such as `Vet viewer`, with mobile readiness coverage so raw role ids do not drift back into the management surface.
- Mobile first-run Setup now confirms the saved care foundation before returning to Today. The confirmation summarizes the saved dog, starter routine, caregiver, and diet baseline, explains that Today, Log, Records, reports, and WoofGuide will use it, and keeps household invite/sync controls truthfully in More while provider-backed onboarding remains open.
- Mobile first-run Setup confirmation now includes active household context from `/me` when available. It names the selected pack and tells multi-household caregivers to manage invite, sync, and switching for their packs in More while clarifying setup only saved the care foundation.
- Mobile first-run Setup now captures household sync intent before provider-backed onboarding is complete. Share invite, Join pack, and Decide later choices keep actual invite/join/sync/switching work routed to More, and the post-save alert only offers Open More when the chosen next step needs those real household tools.
- Setup-to-More household handoff is now intent-aware before provider-backed onboarding is complete. Share invite and Join pack choices pass a `setupHandoff` route param into More, where a setup next-step card routes to the existing owner/admin invite share action or invite-code modal without claiming invite approval, cloud onboarding, or arbitrary membership changes are complete.
- Mobile More display-name copy now mirrors the active-household member update boundary. The display-name row, edit modal, and save confirmation name the active pack so multi-household caregivers are not told the name change applies to every household or future provider-backed surface.
- Animated care-twin taps now have an explicit screen-reader contract before native accessibility traversal. `AnimatedAvatar` exposes the full-scene response as a button, names Phoenix's current care-twin mood and visible speech fallback, and states that tapping only plays a gentle response without changing care records.
- Mood logging now captures structured energy and care context before deeper mood analytics. The Log composer saves low/steady/high energy, optional care context, sticky notes, and household visibility while preserving the top-level mood field used by Records Mood Trend and care-twin state.
- Records Mood Trend now derives from shared care-domain logic before deeper mood analytics. Private and stale mood logs are excluded, while low/steady/high energy counts, latest caregiver/context, watch status, summary, and next-step copy are visible in Records without diagnostic claims.
- Care Pass reports now include shared Mood & Energy handoff context before deeper mood analytics. `buildCarePass` reuses `deriveMoodTrend` so recent household-visible mood check-ins, energy counts, latest caregiver/context, and owner-reported/non-diagnostic boundary language reach sitter, trainer, and vet reports while private and stale mood logs stay excluded.
- WoofGuide now creates an owner-reviewed Mood & Energy summary from the same shared mood trend before provider-backed AI actions. The suggested action excludes private/stale mood logs, carries source entry ids, energy counts, and latest caregiver/context, and approving it only inserts a reviewed assistant message without changing care records.
- Records Mood Timeline now extends the same shared mood evidence into a longer-range mobile review surface. Records derives a 90-day, eight-item timeline from `deriveMoodTrend`, showing caregiver, relative date, energy, context, and notes for household-visible check-ins while keeping private/stale logs excluded and labeling mood/energy as owner-reported context, not diagnosis.
- Records Mood Trend now has accessible Week, Month, and Quarter filters plus compact period comparison visuals from `deriveMoodTrendPeriods`. The period views reuse the same household-visible mood evidence boundary as `deriveMoodTrend`, keep low/steady/high energy counts and latest context in the card, and stay explicitly non-diagnostic.
- Records Mood Trend now has caregiver and care-context filters from the same shared domain helper. Records narrows the summary, period comparison, latest context, and 90-day timeline through accessible chips while private/stale logs stay excluded and filtered empty states stay truthful.
- Records Mood Trend now has a compact Mood sparkline from `deriveMoodTrendSparkline`. It buckets the selected Week, Month, or Quarter mood evidence after the same caregiver/context filters and private/stale exclusions, then renders accessible bars for quick owner review without predictive or diagnostic claims.
- Progress Reports now include a report-ready Mood & Energy snapshot from `deriveMoodEnergyReportSnapshot`. The shared snapshot reuses the mood-trend evidence boundary, excludes private/stale mood logs, includes energy counts plus latest caregiver/context, and carries owner-reported/non-diagnostic boundary language into the shareable report.
- Progress Reports now save print-ready report-history artifacts with `createProgressReportArtifact`. The stored source uses escaped HTML, stable filenames, section metadata, and the same Mood & Energy owner-reported boundary, while Records can resend or share printable source for Care Pass and Progress Report artifacts before binary PDF/server storage exists.
- Records Vault now summarizes local receipt/document attachment readiness. `summarizeRecordVault` counts attachable records, local attachments, missing local file titles, and per-section attachment counts, while Mobile Records shows those counts with a local-only boundary before provider-backed document storage, retention, deletion, and cloud sharing are approved.
- Care Pass and Progress Reports now carry Records Attachment Prep handoff lines from the shared record-vault summary. Reports show attached-versus-attachable receipt/document counts, missing local file titles, and the local-only storage boundary without claiming provider-backed document storage, binary PDF export, retention, deletion, or cloud sharing is ready.
- WoofGuide now creates owner-reviewed Records Attachment Prep drafts from the same local record-vault summary. The suggested action appears only when receipt/document records are missing local files, routes owners to Records, inserts only a reviewed assistant note, and states that cloud storage is not enabled until provider-backed document storage is approved.
- Mobile Records Report History now supports removing only a selected local reusable source. Shared `describeReportArtifactRemoval` copy, the Records confirmation flow, mobile readiness coverage, and CI keep the boundary explicit: local Care Pass/Progress Report/Dog ID source removal does not delete cloud storage, revoke shares, alter retention, or enable native PDF/provider-backed lifecycle controls.
- The 2026-07-01 GitHub Actions `WoofWatcher Verify` run `28495997661` passed on `main` for commit `46df8b9` after repairing Mobile More's generated query-key contract and keeping Node-only PixelLab verifier scripts out of the Expo app typecheck scope.
- Records Dog ID now shows credential readiness before image/PDF/provider-backed credential export. `derivePetCredentialReadiness` combines Dog Profile fallbacks and saved records, counts ready-versus-missing credential fields, and Mobile Records lists missing Dog ID fields while repeating the local printable-source boundary.
- WoofGuide now creates owner-reviewed Dog ID Prep drafts from the same shared credential readiness. The suggested action appears only when some Dog ID context exists but credential fields are missing, routes owners to Records, inserts only a reviewed assistant note, and keeps image/PDF export plus provider-backed credential storage gated.
- Care Pass reports now carry Dog ID Prep from the same shared credential readiness. The report builder shows ready-versus-missing credential fields and the local printable-source boundary in sitter/vet/trainer/caregiver handoffs without claiming image/PDF export, provider-backed credential storage, retention, deletion, or cloud sharing is ready.
- Progress Reports now carry Dog ID Prep from the same shared credential readiness. Mobile Records saves ready-versus-missing Dog ID fields and the local printable-source boundary into print-ready Progress Report artifacts while image/PDF export, provider-backed credential storage, binary PDF export, and server-backed report storage remain gated.
- Dog ID card and printable-source shares now save local report-history artifacts before native credential/PDF export or provider-backed storage. `createPetCredentialArtifact` stores escaped Dog ID printable HTML with stable file names, and Mobile Records labels saved rows as Dog ID Credential while image/PDF export, cloud sharing, server-backed report storage, and provider-backed credential storage remain gated.
- WoofGuide now surfaces saved Dog ID credential history from local report-history artifacts before native credential/PDF export or provider-backed storage. `summarizePetCredentialArtifacts` identifies the latest local `pet_credential` source, and the owner-reviewed `pet_credential_history` draft routes owners to Records Report History for resend or printable-source sharing while credential storage, PDF/image export, cloud sharing, retention, and deletion policy remain gated.
- Records Report History now summarizes local handoff source readiness across Care Pass, Progress Report, and Dog ID artifacts before native PDF/export or server-backed report storage. `summarizeReportArtifacts` counts the saved local source mix, identifies the latest reusable source, and Mobile Records shows resend/printable-source guidance plus the local-only lifecycle boundary without claiming cloud sharing, retention, deletion, or native export is ready.
- WoofGuide now surfaces saved local report-history readiness from the same shared Report History helper before native PDF/export or server-backed report storage. The owner-reviewed `report_history` draft appears when Care Pass or Progress Report sources exist, routes owners to Records Report History for resend or printable-source sharing, inserts only reviewed assistant text, and keeps native PDF export, server-backed report storage, cloud sharing, retention, deletion, and unsupervised assistant actions gated.
- Records Report History rows and WoofGuide saved report-history drafts now share one report-source descriptor before native PDF/export or server-backed report storage. `describeReportArtifactSource` centralizes source kind, section count, print-ready/restored status, printable file name, and local-only lifecycle copy so Records and WoofGuide stay aligned without claiming cloud sharing, retention, deletion, native export, or server-backed storage is ready.
- Records Report History now removes selected local handoff sources through a provider-gated confirmation before native PDF/export or server-backed report storage. `describeReportArtifactRemoval` centralizes the removal copy, Mobile Records filters only the chosen local artifact from the care document, and the UI states that cloud deletion, share revocation, server retention, native PDF export, and provider-backed lifecycle controls are not enabled.
- Report History cleanup guidance now stays shared across Records and WoofGuide before provider-backed lifecycle controls. `summarizeReportArtifacts.cleanupLine` tells owners to remove obsolete local sources only after review and clarifies that local cleanup does not revoke shares or change provider retention.
- Report History pre-share review guidance now stays shared across Records and WoofGuide before native PDF/export or server-backed report storage. `summarizeReportArtifacts.reviewLine` tells owners to review the latest local source for stale routines, medications, records, and audience before resending, and the same line appears in Mobile Records plus the owner-reviewed WoofGuide report-history draft without claiming cloud sharing, retention, deletion, native export, server-backed storage, or unsupervised assistant actions are ready.
- Report History audience-prep guidance now stays shared across Records and WoofGuide before native PDF/export or server-backed report storage. `summarizeReportArtifacts.audienceLine` tells owners to pick the sitter, trainer, caregiver, or vet audience first because each may need different notes before sharing, and the same line appears in Mobile Records plus the owner-reviewed WoofGuide report-history draft without claiming cloud sharing, retention, deletion, native export, server-backed storage, or unsupervised assistant actions are ready.
- The 2026-07-01 GitHub Actions `WoofWatcher Verify` run `28525398502` passed on `main` for commit `5c60e01` after the Report History pre-share review guidance slice.
- The 2026-07-01 GitHub Actions `WoofWatcher Verify` run `28514313498` passed on `main` for commit `58d2381` after the Report History cleanup guidance slice.

Next highest-impact work:

1. Run native iOS/Android simulator or device QA when provider/runtime access is available.
2. Continue accessibility traversal and visual runtime inspection for the live mobile app and Avatar Studio once simulator/device access is available.
3. Add provider-backed document storage, retention/deletion policy, server-backed report storage, or native export/download only after Apollo approves storage/provider scope.
4. Add the next richer local report/Records trust layer, such as Records cabinet polish or owner-reviewed report prep, without claiming provider-backed storage, PDF generation, cloud sharing, or unsupervised assistant actions.
5. Replace first-pass derived room variants with final illustrated night, bedtime, health-watch, and home-alone room art, then continue screen-by-screen polish, accessibility traversal, and visual regression.
6. Add live API integration tests for care-state write races and care-entry delete retention once a test database and provider-auth harness are available.
7. Add live household provisioning, invite-join, active-household persistence, `/me.households`, active-household switching, role-gated household rename, owner/admin member role updates, split care-plan versus care-log write roles, sitter/trainer own-entry correction scoping, household audit review, sensitive household audit producer, invite-code visibility, mobile switcher, mobile Care Team role-management, Pack Audit, and multi-household membership integration tests once a test database and provider-auth harness are available.
8. Prepare provider-backed auth, storage, AI, notifications, checkout, and app-store submission only after Apollo approves those production decisions.
