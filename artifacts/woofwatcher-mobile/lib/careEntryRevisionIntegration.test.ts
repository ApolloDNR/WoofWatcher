import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const mobileRoot = join(process.cwd(), "artifacts", "woofwatcher-mobile");

function read(relativePath: string): string {
  return readFileSync(join(mobileRoot, relativePath), "utf8");
}

test("CareContext routes create-follow-up, direct, and retry updates through one revision queue", () => {
  const context = read(join("context", "CareContext.tsx"));

  assert.match(context, /createCareEntryMutationQueue/);
  assert.match(context, /revision\?:\s*number/);
  assert.match(context, /revision:\s*c\.revision/);
  assert.match(context, /expectedRevision:\s*number[\s\S]*expectedRevision,/);
  assert.match(context, /entryMutationQueue\.bindServerIdentity\(/);
  assert.match(context, /entryMutationQueue\.discard\(clientKey\)/);
  assert.match(context, /discardConflictedCareEntryMutations\(/);
  const syncStart = context.indexOf("const syncFromServer");
  const syncEnd = context.indexOf("const addEntry");
  const syncSource = context.slice(syncStart, syncEnd);
  assert.ok(
    syncSource.indexOf("entryMutationQueue.pause()") <
      syncSource.indexOf("entryMutationQueue.waitForInFlight("),
  );
  assert.ok(
    syncSource.indexOf("entryMutationQueue.waitForInFlight(") <
      syncSource.indexOf("careDocSyncCoordinator.syncFromServer("),
  );
  assert.match(
    syncSource,
    /careDocSyncCoordinator\.syncFromServer\(\s*syncHouseholdId,?\s*\)/,
  );
  assert.match(syncSource, /CARE_ENTRY_REFRESH_QUIESCENCE_TIMEOUT_MS/);
  assert.match(syncSource, /quiescence\s*===\s*"timeout"/);
  assert.ok(
    syncSource.indexOf('quiescence === "timeout"') <
      syncSource.indexOf("listCareEntryHistory("),
  );
  assert.match(context, /entryMutationQueue\.enqueue\(/);
  assert.match(context, /entryMutationQueue\.clear\(\)/);
  assert.match(context, /finalizeCareEntryMutation\(/);
  assert.match(context, /onFailed:\s*\(\{[^}]*expectedRevision/);
  assert.match(context, /revision:\s*expectedRevision/);
  assert.match(context, /runCareEntrySideEffectIfCurrent\(/);
  assert.match(context, /syncStatus:\s*"conflict"/);
  assert.doesNotMatch(context, /pendingPatch/);
  const refreshStart = context.indexOf("const syncFromServer");
  const refreshEnd = context.indexOf("const addEntry");
  const refresh = context.slice(refreshStart, refreshEnd);
  assert.ok(
    refresh.indexOf("mergeServerAndLocalEntries(") <
      refresh.indexOf("entryMutationQueue.bindServerIdentity("),
    "refresh must classify client-key divergence before a temp queue can drain",
  );

  const generatedUpdateCalls =
    context.match(/\bupdateCareEntry\(/g)?.length ?? 0;
  assert.equal(
    generatedUpdateCalls,
    1,
    "only the queue transport may call the generated PATCH client",
  );

  const updateStart = context.indexOf("const updateEntry");
  const updateEnd = context.indexOf("const resolveEntryConflict");
  const ordinaryUpdate = context.slice(updateStart, updateEnd);
  assert.match(ordinaryUpdate, /canApplyCareEntryUpdate\(current\)/);
  assert.ok(
    ordinaryUpdate.indexOf("canApplyCareEntryUpdate(current)") <
      ordinaryUpdate.indexOf("entryMutationQueue.enqueue("),
    "ordinary edits must reject conflicted rows before reaching the queue",
  );
});

test("entry conflict status is visible in Log and routes Sync Health to review", () => {
  const log = read(join("app", "(tabs)", "log.tsx"));
  const more = read(join("app", "(tabs)", "more.tsx"));

  assert.match(log, /status === "conflict"/);
  assert.match(log, /syncStatus === "conflict"/);
  assert.match(log, /Review conflict/);
  assert.match(more, /syncOutbox\.conflicted/);
  assert.match(more, /router\.push\([^)]*log/);
});

test("Log exposes explicit accessible recovery for either preserved conflict version", () => {
  const context = read(join("context", "CareContext.tsx"));
  const log = read(join("app", "(tabs)", "log.tsx"));

  assert.match(context, /resolveEntryConflict/);
  assert.match(context, /"keep-local"\s*\|\s*"use-household"/);
  assert.match(context, /resolveEntryConflict:[\s\S]*Promise</);
  assert.match(context, /conflictServerSnapshot/);
  assert.match(context, /parseCachedCareEntriesWithRecovery(?:<[^>]+>)?\(/);
  assert.match(context, /entryRefreshSerialRef/);
  assert.match(context, /resolvingEntryConflictIds/);
  assert.match(context, /refreshThenResolveCareEntryConflict(?:<[^>]+>)?\(/);
  assert.match(context, /refresh:\s*syncFromServer/);
  assert.match(
    context,
    /isCurrent:\s*\(\)\s*=>\s*lifecycle\.isCurrent\(lifecycleToken\)/,
  );
  assert.match(log, /accessibilityLabel="Keep my saved version"/);
  assert.match(log, /accessibilityLabel="Use household version"/);
  assert.match(
    log,
    /describeCareEntryConflictVersion\(\s*detailEntry\.conflictServerSnapshot,?\s*\)/,
  );
  assert.match(log, />\s*My saved version\s*</);
  assert.match(log, /Household version from last refresh/);
  assert.match(log, /numberOfLines=\{2\}/);
  assert.match(
    log,
    /disabled=\{\s*isSyncing\s*\|\|[\s\S]*conflictResolutionPending\s*\}/,
  );
  assert.match(log, /confirmThroughSteps\(/);
  assert.match(
    log,
    /This will replace the latest shared household version with your saved version\./,
  );
  assert.match(log, /WoofWatcher will refresh the household first\./);
  assert.match(log, /WoofWatcher kept both versions for review\./);
  assert.match(log, /Resolve this conflict before making other edits\./);
  assert.match(
    log,
    /Refresh to load a valid household version before\s+choosing\./,
  );
  assert.match(log, /accessibilityLabel="Refresh conflict versions"/);
  assert.match(log, /resolveEntryConflict\([^,]+,\s*"keep-local",?\s*\)/);
  assert.match(log, /resolveEntryConflict\([^,]+,\s*"use-household",?\s*\)/);
  assert.match(log, /notifyConflictEditBlocked/);
  assert.match(log, /Resolve this conflict before editing this care log\./);
  assert.match(log, /if\s*\(\s*!updateEntry\(promptId,/);
  assert.match(log, /if\s*\(\s*!updateEntry\(editEntry\.id,/);
  assert.match(
    log,
    /detailEntry\.syncStatus === "conflict"[\s\S]{0,300}notifyConflictEditBlocked\(detailEntry\)[\s\S]{0,500}ImagePicker\.launchImageLibraryAsync/,
  );
});

test("non-Log update callers do not announce or discard work after a rejected edit", () => {
  const home = read(join("app", "(tabs)", "index.tsx"));
  const recorder = read(join("components", "WalkRouteRecorder.tsx"));

  const finishStart = home.indexOf("const finishWalkFromHome");
  const finishEnd = home.indexOf("const recentQuickSave", finishStart);
  const finishWalk = home.slice(finishStart, finishEnd);
  const rejectedUpdate = finishWalk.indexOf("!updateEntry(");

  assert.ok(
    rejectedUpdate >= 0,
    "Home must inspect the walk completion result",
  );
  assert.ok(
    rejectedUpdate < finishWalk.indexOf("Haptics.impactAsync"),
    "Home must not play the success haptic before the update is accepted",
  );
  assert.ok(
    rejectedUpdate < finishWalk.indexOf('showRoomSpeech("Walk completed")'),
    "Home must not announce completion before the update is accepted",
  );
  assert.match(finishWalk, /Resolve this walk conflict/);
  assert.match(
    finishWalk,
    /router\.push\(homeLogEntryRoute\(openWalkSession\.id\)/,
  );

  assert.match(recorder, /pendingRouteAttachmentRef/);
  assert.match(recorder, /if\s*\(\s*!updateEntry\(/);
  assert.match(recorder, /syncStatus\s*===\s*"conflict"\)\s*return/);
  assert.match(recorder, /pendingRouteAttachmentRef\.current\s*=\s*null/);
});
