# Task 1 host-cleanup recovery ledger

Recorded after the Work Mode host removed the active scratch root during the final Task 1 repair.

## Durable boundary

- Remote branch before this ledger: `codex/woofwatcher-finish` at `2cd82061d51c6cf662f911130ee862019661b928`.
- Published reconstruction plan: `docs/superpowers/plans/2026-07-28-woofwatcher-finish-recovery.md`.
- The accepted-looking Task 1 local candidates `1c230a1` and `8648f868` were never published; their objects and the later dirty repair disappeared with the scratch worktree. Do not assume either object exists remotely.
- Reconstruct only Task 1 from the published branch and committed specifications. Do not restart the application or advance to Task 2 before Task 1 is freshly accepted and published.

## Proven pre-cleanup Task 1 state

The frozen local `8648f868` tree had previously reproduced:

- 65/65 affected checks
- 1,237/1,237 repository checks
- full workspace TypeScript
- a fresh 267-file Expo export
- beta doctor `READY_FOR_EXPORT`, 80 checks
- runtime browser execution explicitly blocked because no usable Chromium binary existed

Independent review rejected that local candidate for three real gaps:

1. scaled shell clearance blocked floating Today, Plan, and Calendar Month controls;
2. focused web keyboard rotation/dismissal could leave stale shell visibility state;
3. runtime-smoke phases were not all connected to one bounded real dispatcher.

Portrait toast clearance was also aligned for consistency. A claimed Calendar Month final-row content overlap was formally retracted; the existing `paddingBottom: bottomPadding + 80` already cleared the FAB and must not be treated as a product defect.

## Lost bounded repair ledger

The sole production writer had changed exactly these seven production files after `8648f868`:

- `artifacts/woofwatcher-mobile/app/(tabs)/(today)/index.tsx`
- `artifacts/woofwatcher-mobile/app/(tabs)/(plan)/calendar.tsx`
- `artifacts/woofwatcher-mobile/app/(tabs)/(plan)/calendar-month.tsx`
- `artifacts/woofwatcher-mobile/app/(tabs)/(more)/portrait.tsx`
- `artifacts/woofwatcher-mobile/lib/mobileLayout.ts`
- `artifacts/woofwatcher-mobile/components/navigation/CareShellHost.tsx`
- `artifacts/woofwatcher-mobile/scripts/smoke-runtime-preview.js`

Tests changed only in:

- `artifacts/woofwatcher-mobile/lib/mobileLayout.test.ts`
- `artifacts/woofwatcher-mobile/lib/task1ShellRepair.test.ts`

### Floating controls

- Add shared `TABBED_FLOATING_SURFACE_GUTTER = 8`.
- Add `getTabbedFloatingSurfaceBottomOffset(input)` returning `getFloatingTabChromeMetrics(input).shellTopClearance + 8`.
- Make tabbed `getFloatingFeedbackBottomOffset` delegate to that helper.
- Pass `fontScale` from Today and Plan calendar feedback surfaces.
- Use the shared helper for Calendar Month FAB and Portrait save toast.
- The iOS feedback expectation moved from 130 to 129.

### Runtime proof

- Add central `withDeadline` behavior.
- Add `createDeadlineBoundCdpClient`.
- Extend `createCdpClient(webSocketUrl, options)` with bounded open, command, and close operations plus injectable WebSocket.
- Reject and clear pending commands on socket error/close; clean listeners in every exit.
- Route `navigateAndWaitForLoad` through the bounded client.
- Export and connect `runRuntimeProofDispatcher` for prior route loop, accessibility, and Task 1 proof.
- Export `runRuntimeSmokeDispatcher` for setup plus the real proof dispatcher.
- Make real `runRuntimeSmoke` call that single dispatcher.
- Keep raw `Page.navigate` only inside the bounded navigation helper.
- Fake-CDP tests covered setup/route/a11y/Task1 phase stalls, load-before-stalled navigation, never-open/never-close, pending-command error/close, and the real shell matrix.
- `node --check` was green.

### Keyboard state

The latest lost reducer state was:

```ts
{
  baselineHeight,
  keyboardVisible,
  visualViewportWidth,
  visualViewportHeight,
  rotatedWhileKeyboardVisible,
}
```

Transitions were explicit viewport, focus-in, focus-transfer, and focus-out events using `FocusEvent.relatedTarget`, with no timer-based recovery. Covered cases included normal open/close, focused orientation without keyboard, rotate while open, rotate back while open, repeated post-rotate samples, offsetTop-only pan, atomic rotate+dismiss in both directions, focus transfer, true blur, and listener symmetry.

The last connected local gate before host cleanup was 31/31 across `task1ShellRepair` and `mobileLayout`, plus mobile TypeScript and `git diff --check`.

## Single remaining RED before reconstruction can be accepted

Independent review found one valid false-negative that had not yet been patched when the directory vanished:

- baseline width 390 / height 844;
- first keyboard-open sample raw `visualViewport.height = 500` and `offsetTop = 300`;
- the lost detector incorrectly used visible-bottom (`height + offsetTop = 800`) and reported no keyboard.

Add the causal failing test before production edits. All occlusion and baseline logic—including host initialization—must use raw `visualViewport.height`; `offsetTop` is pan and must not reduce measured occlusion on the initial or later sample. Preserve the separate offsetTop-only-pan no-keyboard case.

## Required acceptance sequence

1. Recreate an isolated checkout from the current remote branch.
2. Rebuild the prior Task 1 topology/shell candidate from the committed specifications and causal tests.
3. Rebuild only the seven-file lost repair above.
4. Capture the initial-panned-open RED, then apply the raw-height fix.
5. Run focused Task 1 tests, complete repository tests, workspace TypeScript, fresh Expo export, beta doctor, `node --check`, `git diff --check`, and runtime fail-fast when Chromium is absent.
6. Freeze the commit and obtain independent semantic review with zero open Critical/Important/Minor findings.
7. Publish the accepted commit immediately before starting Task 2.
