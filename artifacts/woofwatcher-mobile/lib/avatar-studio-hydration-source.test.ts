import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const portrait = readFileSync(
  join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", "portrait.tsx"),
  "utf8",
);

function functionSource(name: string, nextName: string): string {
  const start = portrait.indexOf(`  const ${name} =`);
  const end = portrait.indexOf(`  const ${nextName} =`, start + 1);
  assert.notEqual(start, -1, `${name} must remain defined in Avatar Studio`);
  assert.notEqual(end, -1, `${nextName} must follow ${name}`);
  return portrait.slice(start, end);
}

test("Avatar Studio binds its draft only after Avatar and Care hydration succeed", () => {
  assert.match(
    portrait,
    /careScopeRevision,[\s\S]*hydrationStatus: careHydrationStatus,[\s\S]*retryHydration: retryCareHydration,[\s\S]*useCare\(\)/,
    "Avatar Studio identity must wait for the active Care scope, not the temporary profile default",
  );
  assert.match(
    portrait,
    /hydrationStatus: avatarHydrationStatus,[\s\S]*retryHydration: retryAvatarHydration,[\s\S]*useAvatar\(\)/,
  );
  assert.match(
    portrait,
    /const \[avatarDraftReady, setAvatarDraftReady\] = useState\(false\)/,
  );
  assert.match(
    portrait,
    /const \[boundCareScopeRevision, setBoundCareScopeRevision\] =\s*useState<\s*number \| null\s*>\(null\)/,
  );
  assert.match(
    portrait,
    /const \[boundPetName, setBoundPetName\] = useState<string \| null>\(null\)/,
    "the visible draft must also be bound to the canonical dog identity",
  );
  assert.match(
    portrait,
    /if \(\s*avatarHydrationStatus !== "ready" \|\|\s*careHydrationStatus !== "ready"\s*\) \{[\s\S]*?setAvatarDraftReady\(false\);[\s\S]*?setBoundCareScopeRevision\(null\);[\s\S]*?return;[\s\S]*?avatarDraftAuthorityRef\.current\.replace\(\{[\s\S]*?\.\.\.avatarConfig,[\s\S]*?petName,[\s\S]*?\}\);[\s\S]*?setDraft\(boundDraft\.draft\);[\s\S]*?setBoundCareScopeRevision\(careScopeRevision\);[\s\S]*?setAvatarDraftReady\(true\);/,
    "the temporary draft must stay hidden until both persisted inputs bind to the current Care scope",
  );
  assert.match(
    portrait,
    /const avatarStudioReady =\s*avatarHydrationStatus === "ready" &&\s*careHydrationStatus === "ready" &&\s*avatarDraftReady &&\s*boundCareScopeRevision === careScopeRevision &&\s*boundActivePetId === activePetId &&\s*boundPetName === petName;/,
    "a same-scope Dog Profile rename must close the old editor before it paints again",
  );
  assert.match(
    portrait,
    /activeSession\.careScopeRevision !== careScopeRevision \|\|[\s\S]*?activeSession\.activePetId !== activePetId \|\|[\s\S]*?activeSession\.petName !== petName/,
    "a scope or canonical dog-name change must invalidate the active editor session before async work resolves",
  );

  const failedGate = portrait.indexOf("if (studioLoadFailed)");
  const loadingGate = portrait.indexOf("if (!avatarStudioReady)", failedGate);
  const studio = portrait.indexOf("{avatarMutationError ? (", loadingGate);
  assert.ok(failedGate > 0, "Avatar Studio needs a terminal failure state");
  assert.ok(
    loadingGate > failedGate,
    "loading must remain gated after failure",
  );
  assert.ok(
    studio > loadingGate,
    "the editor must render only after both gates",
  );
  assert.equal(
    portrait.match(/<BoardRouteHeader\b/g)?.length,
    1,
    "all Avatar Studio states must share one route-header definition",
  );
  assert.match(
    portrait,
    /actionLabel=\{[\s\S]*?avatarStudioReady[\s\S]*?"Save avatar"[\s\S]*?\}\s*actionDisabled=\{avatarStudioBusy\}/,
    "the shared header must expose Save only after the editor is ready and lock it during work",
  );
  const componentEnd = portrait.indexOf(
    "\nconst s = StyleSheet.create",
    failedGate,
  );
  assert.doesNotMatch(
    portrait.slice(failedGate, componentEnd),
    /\buse[A-Z][A-Za-z]+\(/,
    "all screen hooks must remain before the hydration branches",
  );

  const failureState = portrait.slice(failedGate, loadingGate);
  assert.match(
    portrait,
    /const studioLoadFailed =\s*avatarHydrationStatus === "failed" \|\| careHydrationStatus === "failed";/,
    "either failed persisted input must stop the editor",
  );
  assert.match(
    portrait,
    /avatarHydrationStatus === "failed" && careHydrationStatus === "failed"[\s\S]*?saved care details and care twin could not be read/,
    "the combined failure must name both unavailable persisted inputs",
  );
  assert.match(failureState, /accessibilityRole="alert"/);
  assert.match(failureState, /accessibilityLiveRegion="assertive"/);
  assert.match(
    failureState,
    /accessibilityLabel="Retry loading Avatar Studio"/,
  );
  assert.match(
    failureState,
    /if \(avatarHydrationStatus === "failed"\) \{\s*retryAvatarHydration\(\);\s*\}/,
  );
  assert.match(
    failureState,
    /if \(careHydrationStatus === "failed"\) \{\s*retryCareHydration\(\);\s*\}/,
  );

  const loadingState = portrait.slice(loadingGate, studio);
  assert.match(loadingState, /accessibilityRole="progressbar"/);
  assert.match(loadingState, /accessibilityState=\{\{ busy: true \}\}/);
  assert.match(loadingState, /accessibilityLabel="Loading Avatar Studio"/);
});

test("Avatar Studio rejects stale edit events and handles storage write failures", () => {
  for (const [name, nextName] of [
    ["pick", "selectTemplate"],
    ["selectTemplate", "setAccessory"],
    ["setAccessory", "selectStudioTab"],
    ["selectStudioTab", "setCoatColor"],
    ["setCoatColor", "setFaceMarking"],
    ["setFaceMarking", "previewMoodState"],
    ["previewMoodState", "openAvatarSpriteProductionQa"],
    ["openAvatarSpriteProductionQa", "saveDraft"],
    ["saveDraft", "resetDraft"],
    ["resetDraft", "retryAvatarMutation"],
  ] as const) {
    assert.match(
      functionSource(name, nextName),
      /if \(!avatarStudioReady\) return;/,
      `${name} must fail closed until the hydrated draft is bound`,
    );
  }

  const saveSource = functionSource("saveDraft", "resetDraft");
  assert.match(saveSource, /const studioSession = getActiveStudioSession\(\)/);
  assert.match(saveSource, /await saveAvatarConfig\(nextAvatarConfig\)/);
  assert.match(
    saveSource,
    /avatarOperationGateRef\.current\.isCurrent\(operation\)[\s\S]*?studioSessionRef\.current === studioSession[\s\S]*?setAvatarMutationError\("save"\)/,
    "a rejected Avatar save must become owner-visible only for the current operation and session",
  );
  const resetSource = functionSource("resetDraft", "retryAvatarMutation");
  assert.match(resetSource, /const studioSession = getActiveStudioSession\(\)/);
  assert.match(resetSource, /await resetAvatarConfig\(petName\)/);
  assert.match(
    resetSource,
    /avatarOperationGateRef\.current\.isCurrent\(operation\)[\s\S]*?studioSessionRef\.current === studioSession[\s\S]*?setAvatarMutationError\("reset"\)/,
    "a rejected Avatar reset must become owner-visible only for the current operation and session",
  );
  assert.match(
    functionSource("pick", "selectTemplate"),
    /const studioSession = getActiveStudioSession\(\);[\s\S]*?await ensurePermission\(camera\);[\s\S]*?studioSessionRef\.current !== studioSession[\s\S]*?await ImagePicker\.[\s\S]*?studioSessionRef\.current !== studioSession/,
    "permission and picker completions from an old Care scope must be ignored",
  );
  assert.doesNotMatch(
    portrait,
    /The default is shown for now/,
    "a rejected write-first reset must not claim that the default is already visible",
  );
  assert.match(
    portrait,
    /The reset did not take effect\. Your current edits are still here/,
    "reset failure copy must describe the draft that actually remains on screen",
  );
  assert.match(
    portrait,
    /useEffect\(\(\) => \{\s*if \(!avatarStudioReady \|\| phase !== "working"\) return;[\s\S]*?const studioSession = studioSessionRef\.current;[\s\S]*?studioSessionRef\.current !== studioSession/,
    "a scan completion must not mutate the draft after hydration becomes unavailable",
  );
  const mutationStateStart = portrait.indexOf("{avatarMutationError ? (");
  const mutationStateEnd = portrait.indexOf(
    '{phase === "working"',
    mutationStateStart,
  );
  assert.ok(mutationStateStart > 0 && mutationStateEnd > mutationStateStart);
  assert.match(
    portrait.slice(mutationStateStart, mutationStateEnd),
    /avatarMutationError[\s\S]*accessibilityRole="alert"[\s\S]*accessibilityLabel=\{avatarMutationRetryLabel\}[\s\S]*onPress=\{retryAvatarMutation\}/,
    "write failure must provide a named in-app retry instead of an unhandled rejection",
  );
});

test("Avatar Studio binds sessions and drafts to the exact active pet", () => {
  assert.match(
    portrait,
    /const activePetId = state\.activePetId\.trim\(\) \|\| "primary"/,
  );
  assert.match(
    portrait,
    /type AvatarStudioSession = \{[\s\S]*?activePetId: string;/,
  );
  assert.match(
    portrait,
    /const \[boundActivePetId, setBoundActivePetId\] = useState<string \| null>\(null\)/,
  );
  assert.match(
    portrait,
    /boundCareScopeRevision === careScopeRevision &&\s*boundActivePetId === activePetId &&\s*boundPetName === petName/,
  );
  assert.match(
    portrait,
    /activeSession\.careScopeRevision !== careScopeRevision \|\|[\s\S]*?activeSession\.activePetId !== activePetId \|\|[\s\S]*?activeSession\.petName !== petName/,
    "a same-household active-dog change must synchronously retire the old studio session",
  );
  assert.match(
    portrait,
    /studioSessionRef\.current = \{[\s\S]*?careScopeRevision,[\s\S]*?activePetId,[\s\S]*?petName/,
  );
});

test("Avatar Studio serializes persistence, preserves later edits, and owns picker failures", () => {
  assert.match(
    portrait,
    /createAvatarStudioOperationGate<AvatarStudioOperation>\(\)/,
  );
  assert.match(portrait, /const avatarDraftDirtyRef = useRef\(false\)/);
  assert.match(
    portrait,
    /avatarDraftDirtyRef\.current &&[\s\S]*?boundActivePetId === activePetId[\s\S]*?return;[\s\S]*?avatarDraftAuthorityRef\.current\.replace\(\{[\s\S]*?\.\.\.avatarConfig,[\s\S]*?petName,[\s\S]*?\}\);[\s\S]*?setDraft\(boundDraft\.draft\)/,
    "an Avatar context update must not clobber a newer same-session draft",
  );

  for (const [name, nextName] of [
    ["pick", "selectTemplate"],
    ["saveDraft", "resetDraft"],
    ["resetDraft", "retryAvatarMutation"],
  ] as const) {
    assert.match(
      functionSource(name, nextName),
      /avatarOperationGateRef\.current\.begin\(/,
      `${name} must acquire the immediate single-flight gate before awaiting`,
    );
  }
  assert.match(
    functionSource("pick", "selectTemplate"),
    /try \{[\s\S]*?await ensurePermission\(camera\)[\s\S]*?await ImagePicker\.[\s\S]*?\} catch \{[\s\S]*?setAvatarMutationError\(\{[\s\S]*?kind: "photo"/,
    "permission and picker launcher rejections must become owner-visible retry state",
  );
  assert.match(
    portrait,
    /actionDisabled=\{avatarStudioBusy\}/,
    "the header save action must announce and enforce its locked state",
  );

  for (const marker of [
    "selectStudioTab(key as StudioTab)",
    "pick(false)",
    "pick(true)",
    "selectTemplate(template.id)",
    "setCoatColor(swatch, primary)",
    "setFaceMarking(marking.id)",
    "setAccessory(item)",
    "previewMoodState(emote)",
    "openAvatarSpriteProductionQa",
  ]) {
    const handler = portrait.indexOf(
      marker,
      portrait.indexOf("{avatarMutationError ? ("),
    );
    assert.ok(handler > 0, `${marker} control must remain rendered`);
    const tagStart = Math.max(
      portrait.lastIndexOf("<Pressable", handler),
      portrait.lastIndexOf("<PressScale", handler),
    );
    const tagEnd = portrait.indexOf(">", handler);
    assert.ok(tagStart > 0 && tagEnd > handler);
    const control = portrait.slice(tagStart, tagEnd);
    assert.match(
      control,
      /disabled=\{avatarStudioBusy\}/,
      `${marker} must lock during persistence`,
    );
    assert.match(
      control,
      /accessibilityState=\{\{\s*disabled: avatarStudioBusy/,
      `${marker} must expose its disabled state to assistive technology`,
    );
  }
});

test("Avatar Studio edits a synchronous versioned draft and accepts only its captured save", () => {
  assert.match(
    portrait,
    /createAvatarStudioDraftAuthority<PetAvatarConfig>\(avatarConfig\)/,
    "the rendered draft needs a synchronous authority independent of React's queued state",
  );
  assert.match(
    portrait,
    /const applyAvatarDraftEdit = \([\s\S]*?avatarDraftAuthorityRef\.current\.edit\(update\)[\s\S]*?avatarDraftDirtyRef\.current = true;[\s\S]*?setDraft\(editedDraft\.draft\)/,
    "every owner edit must synchronously update the authoritative draft before queuing its render",
  );

  for (const [name, nextName] of [
    ["selectTemplate", "setAccessory"],
    ["setAccessory", "selectStudioTab"],
    ["setCoatColor", "setFaceMarking"],
    ["setFaceMarking", "previewMoodState"],
  ] as const) {
    assert.match(
      functionSource(name, nextName),
      /applyAvatarDraftEdit\(/,
      `${name} must mutate the synchronous draft authority`,
    );
  }

  const saveSource = functionSource("saveDraft", "resetDraft");
  assert.match(
    saveSource,
    /const capturedDraft = avatarDraftAuthorityRef\.current\.capture\(\);[\s\S]*?\.\.\.capturedDraft\.draft/,
    "save must capture the synchronously current draft, including an edit queued in the same frame",
  );
  assert.match(
    saveSource,
    /const acceptedDraft =\s*avatarDraftAuthorityRef\.current\.replaceIfCurrent\([\s\S]*?capturedDraft,[\s\S]*?nextAvatarConfig[\s\S]*?\);[\s\S]*?if \(!acceptedDraft\) return;[\s\S]*?avatarDraftDirtyRef\.current = false;[\s\S]*?setDraft\(acceptedDraft\.draft\)/,
    "an old save completion must not clean or replace a newer edit",
  );
});
