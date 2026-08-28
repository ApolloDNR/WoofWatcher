# WoofWatcher: paste-ready continuation prompt

Updated 2026-08-28 for the canonical V1 release lane.

Use the prompt below in the next Work/Codex chat. After fetching, the SHA from
`git rev-parse origin/release/woofwatcher-v1` is authoritative. The parent
checkpoint for this handoff is
`dd5c6a55a26fe410ee119e1d7ffc9a0aa45c214b` (tree
`ef1fe872db7abf263cbaac6464690b887e65b21f`).

---

```text
Continue portfolio Priority 2 — WoofWatcher V1 release closeout.

Repository: ApolloDNR/WoofWatcher
Canonical branch: release/woofwatcher-v1
Canonical PR: #12
Release gate: Issue #13

Work only on release/woofwatcher-v1. Fetch it first and confirm that local HEAD
equals origin/release/woofwatcher-v1. Do not create another release branch. Do
not merge PR #12, mark it ready, submit to a store, or publish production until
Apollo personally approves the exact signed binary.

Read these before acting, in this order:
1. docs/release/STATUS.md
2. AGENTS.md
3. docs/ULTIMATE_RELEASE_PLAN.md
4. docs/design/WOOFWATCHER_UI_DIRECTION_LOCK.md
5. docs/design/APOLLO_MASTER_VISION_PROMPT.md
6. docs/APOLLO_VISION_SYNTHESIS.md
7. docs/QUALITY_GATES.md
8. docs/QA_TEST_PLAN.md

Dated handoffs are historical and cannot override STATUS.md or the fetched
branch. In particular, do not resume claude/mockup-parity-polish or its old
711-test baseline. WORK_MODE_HANDOFF_2026-08-20.md has useful acceptance lists
but names an obsolete head and unfinished reset state.

Durable handoff state:
- The starting parent checkpoint is dd5c6a55a26fe410ee119e1d7ffc9a0aa45c214b.
- At handoff there was one clean worktree, one local branch, no stash, no
  uncommitted/untracked files, no unreachable commits, and nothing stranded
  outside origin/release/woofwatcher-v1.
- The release branch was 52 commits ahead of main, and main was its ancestor.
- PR #12 was intentionally draft and unmerged.
- The verified engineering implementation checkpoint is
  57c5926ce844bef38c798069c602bc19dc09ad3c, tree
  98742050003dd59976073b4d0718ca21c1153b95.
- GitHub Actions WoofWatcher Verify #1028 passed on that exact implementation
  checkpoint: 1,528/1,528 focused tests, zero failures/skips, typecheck,
  CI-safe builds, production-profile web export, runtime checks, live-preview
  checks, candidate packaging, and artifact upload.
- Reset/deletion integrity is complete at the automated engineering boundary:
  277/277 adversarial cases passed. Preserve all owner attachment, drain,
  export/reset exclusion, stale-writer, file/cache/walk cleanup, and truthful
  partial-failure guarantees.
- Exact-head web artifact: ID 9507485215,
  woofwatcher-web-candidate-57c5926ce844bef38c798069c602bc19dc09ad3c,
  digest sha256:01d9b839919354c4a885f15575956762062358d5c472f5e47e991de76bfbb081.
  This is browser evidence only, not a signed native binary.
- No signed iOS or Android candidate, native build identifier, physical-device
  screenshots, or physical-device QA evidence exists yet.
- The anti-slop visual review is not current-head proof. Most major screens
  changed in 05172461 after the last broad design screenshots. Old screenshot
  and legacy web-workflow scripts do not cover the full canonical route set.

Apollo's expectation:
You own the cleanup and proof end-to-end. Do not make Apollo hunt bugs or find
AI inconsistencies. Bring him a coherent reviewable candidate for final taste
and approval, while reporting any real credential/device blocker honestly.

Execute the remaining gates in this order:

1. Reconcile current truth
   - Fetch the canonical branch and inspect PR #12, Issue #13, STATUS.md, and
     the latest exact-head CI result.
   - If the branch advanced beyond the starting parent, audit those commits;
     never reset, overwrite, or force-push them.

2. Full anti-slop product audit and repair
   - Build the production-profile web candidate with `pnpm run build:candidate`
     and serve it with `pnpm preview:mobile-beta`. Use the forwarded host URL,
     not localhost, for Apollo's preview.
   - Treat artifacts/woofwatcher-mobile/lib/universalNavigationManifest.json as
     the current route-coverage inventory. Upgrade or supplement old screenshot
     tooling when it misses canonical Health/More sections or boundary routes.
   - Inspect every primary and secondary route, not only source/tests. Capture
     empty and populated states, light and dark appearance, top and scrolled
     views, modal/keyboard, loading/error/offline/retry/permission states,
     direct/deep load, and back behavior at 390x844 plus compact/large widths.
   - Audit information hierarchy, spacing, typography, colors, icon language,
     card/button styles, touch targets, navigation, transitions, reduced motion,
     accessibility labels, large text, and copy tone.
   - Exercise Home, Log/Quick Log, Plans/Calendar, Health/Bile Watch, More,
     Records, Care Pass/export, Avatar Studio, WoofGuide, setup/auth, live walk,
     Privacy export, and coordinated reset.
   - Compare fresh renders with the locked design sources and reference assets.
     Fix every confirmed inconsistency on this same branch. Do not use fake
     data, dead interactions, weakened tests, or regex-only proof to get green.
   - Re-run the route sweep after fixes so one repair does not create another
     inconsistency elsewhere.

3. Deliver an accessible preview
   - Produce a real forwarded/hosted URL or downloadable candidate Apollo can
     open; do not hand him localhost.
   - Clearly label a web preview as web-only and list native behaviors it cannot
     prove.

4. Verify the exact resulting head
   - Use Node 24 and pnpm 10.24.0.
   - Run a frozen install, `pnpm run doctor:mobile-beta`,
     `pnpm run test:focused`, and `pnpm run build:ci`.
   - Keep the worktree byte-clean after generated builds.
   - Push only release/woofwatcher-v1 and require GitHub CI on the exact remote
     SHA. Record SHA, tree, run URL, counts, preview/artifact identifier,
     screenshots reviewed, and unresolved findings in STATUS.md and PR #12.

5. Native gate
   - If Expo/EAS and Apple access are available, create an internal signed iOS
     candidate without store submission. Never request passwords or secrets in
     chat; use authenticated provider flows.
   - Test the exact binary on a physical iPhone for safe areas, touch targets,
     VoiceOver, large text, haptics, permissions, native sharing/files,
     offline/background/relaunch, navigation/back/deep links, live walk,
     export, reset, and partial-failure retry.
   - Prepare Android internal QA only if its tooling/accounts are available.
   - If credentials or device access are missing, document the precise blocker
     and stop at that gate. Do not invent a build ID or native proof.

Completion standard:
- No Critical/Important review findings remain.
- Route-by-route visual/experience evidence is current and documented.
- Exact-head local verification and remote CI pass without weaker guarantees.
- A signed physical-device-tested binary exists, or the exact external blocker
  is documented.
- Apollo personally reviews and approves the exact binary before PR #12 can be
  merged or any release can occur.

Finish with a concise evidence handoff: exact branch/SHA/tree, PR state, CI run,
preview URL or artifact, native build ID, tested devices/flows, screenshots,
open blockers, and explicit merge/release approval state.
```

---

This prompt supersedes the previous July `claude/mockup-parity-polish` handoff.
That historical branch and its 711-test baseline are not the current release
lane.
