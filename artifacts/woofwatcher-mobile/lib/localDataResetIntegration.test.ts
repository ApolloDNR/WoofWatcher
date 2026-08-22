import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

function readMobileSource(...segments: string[]): string {
  return readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", ...segments),
    "utf8",
  );
}

test("the root reset provider constructs its runtime lazily exactly once", () => {
  const source = readMobileSource("context", "LocalDataResetContext.tsx");

  assert.match(
    source,
    /const runtimeRef = useRef<LocalDataResetRuntime \| null>\(null\);/,
  );
  assert.match(
    source,
    /if \(runtimeRef\.current === null\) \{\s*runtimeRef\.current = createLocalDataResetRuntime\(AsyncStorage\);\s*\}/,
  );
  assert.doesNotMatch(source, /useRef\(createLocalDataResetRuntime\(/);
});

test("the provider preserves exact runtime delegation and deduplicates reset settlement", () => {
  const source = readMobileSource("context", "LocalDataResetContext.tsx");

  assert.match(source, /runExport: runtime\.operations\.runExport/);
  assert.match(source, /registerParticipant: runtime\.registerParticipant/);
  assert.match(source, /runTrackedLocalDataWork: runtime\.trackedWork\.run/);
  assert.match(
    source,
    /const observedResetPromisesRef = useRef\(new WeakSet<Promise<LocalDataResetResult>>\(\)\);/,
  );
  assert.match(source, /if \(!observedResetPromisesRef\.current\.has\(resetPromise\)\)/);
  assert.match(source, /observedResetPromisesRef\.current\.add\(resetPromise\)/);
  assert.match(source, /queueMicrotask\(\(\) => \{\s*setOperationSettledEpoch/);
  assert.match(source, /return resetPromise;/);
});

test("the provider subscribes to truthful operation state and exposes fail-closed predicates", () => {
  const source = readMobileSource("context", "LocalDataResetContext.tsx");

  assert.match(source, /runtime\.operations\.subscribe\(setOperationState\)/);
  assert.match(source, /operationState,/);
  assert.match(source, /isResetting: runtime\.operations\.isResetting/);
  assert.match(
    source,
    /isWriteAdmissionOpen: runtime\.operations\.isWriteAdmissionOpen/,
  );
  assert.match(source, /removableStorage: runtime\.removableStorage/);
  assert.doesNotMatch(source, /generationAuthority: GenerationPermitAuthority/);
  assert.equal(
    source.match(/generationAuthority: runtime\.generationAuthority/g)?.length,
    1,
  );
  assert.doesNotMatch(source, /\.invalidate\(/);
});

test("the provider catches up state after attaching its passive subscription", () => {
  const source = readMobileSource("context", "LocalDataResetContext.tsx");

  assert.match(
    source,
    /const unsubscribe = runtime\.operations\.subscribe\(setOperationState\);\s*setOperationState\(runtime\.operations\.getState\(\)\);\s*return unsubscribe;/,
  );
});

test("the reset provider constructs one stable local-data intent authority and delegates it", () => {
  const source = readMobileSource("context", "LocalDataResetContext.tsx");

  assert.match(
    source,
    /const intentAuthorityRef = useRef<LocalDataIntentAuthority \| null>\(null\);/,
  );
  assert.match(
    source,
    /intentAuthorityRef\.current = createLocalDataIntentAuthority\(/,
  );
  assert.match(
    source,
    /captureLocalDataIntent: intentAuthority\.capture/,
  );
  assert.match(
    source,
    /isLocalDataIntentCurrent: intentAuthority\.isCurrent/,
  );
  assert.match(source, /runWithLocalDataIntent/);
});

test("the reset provider owns web runtime, file facade, query cache, and preferences above consumers", () => {
  const layout = readMobileSource("app", "_layout.tsx");
  const queryOpen = layout.indexOf(
    "<QueryClientProvider client={queryClient}>",
  );
  const resetOpen = layout.indexOf("<LocalDataResetProvider>");
  const webRuntimeOpen = layout.indexOf("<WebRuntimeLocalDataResetProvider>");
  const filesOpen = layout.indexOf("<AppFileSystemProvider>");
  const queryCacheOpen = layout.indexOf("<QueryCacheLocalDataResetProvider>");
  const preferencesOpen = layout.indexOf("<DevicePreferencesProvider>");
  const auth = layout.indexOf("<AuthBridge />");
  const careOpen = layout.indexOf("<CareProvider>");
  const avatarOpen = layout.indexOf("<AvatarProvider>");
  const preferencesClose = layout.indexOf("</DevicePreferencesProvider>");
  const queryCacheClose = layout.indexOf("</QueryCacheLocalDataResetProvider>");
  const filesClose = layout.indexOf("</AppFileSystemProvider>");
  const webRuntimeClose = layout.indexOf("</WebRuntimeLocalDataResetProvider>");
  const resetClose = layout.indexOf("</LocalDataResetProvider>");
  const queryClose = layout.indexOf("</QueryClientProvider>");

  for (const [name, index] of [
    ["QueryClientProvider", queryOpen],
    ["LocalDataResetProvider", resetOpen],
    ["WebRuntimeLocalDataResetProvider", webRuntimeOpen],
    ["AppFileSystemProvider", filesOpen],
    ["QueryCacheLocalDataResetProvider", queryCacheOpen],
    ["DevicePreferencesProvider", preferencesOpen],
    ["AuthBridge", auth],
    ["CareProvider", careOpen],
    ["AvatarProvider", avatarOpen],
    ["DevicePreferencesProvider close", preferencesClose],
    ["QueryCacheLocalDataResetProvider close", queryCacheClose],
    ["AppFileSystemProvider close", filesClose],
    ["WebRuntimeLocalDataResetProvider close", webRuntimeClose],
    ["LocalDataResetProvider close", resetClose],
    ["QueryClientProvider close", queryClose],
  ] as const) {
    assert.ok(index >= 0, `missing ${name}`);
  }
  assert.ok(queryOpen < resetOpen);
  assert.ok(resetOpen < webRuntimeOpen);
  assert.ok(webRuntimeOpen < filesOpen);
  assert.ok(filesOpen < queryCacheOpen);
  assert.ok(queryCacheOpen < preferencesOpen);
  assert.ok(preferencesOpen < auth);
  assert.ok(auth < careOpen);
  assert.ok(careOpen < avatarOpen);
  assert.ok(avatarOpen < preferencesClose);
  assert.ok(preferencesClose < queryCacheClose);
  assert.ok(queryCacheClose < filesClose);
  assert.ok(filesClose < webRuntimeClose);
  assert.ok(webRuntimeClose < resetClose);
  assert.ok(resetClose < queryClose);
});

test("the file facade provider constructs one stable instance and attaches the required owner", () => {
  const source = readMobileSource("context", "AppFileSystemContext.tsx");

  assert.match(
    source,
    /const fileSystemRef = useRef<AppFileSystem \| null>\(null\);/,
  );
  assert.match(
    source,
    /if \(fileSystemRef\.current === null\) \{[\s\S]*fileSystemRef\.current = createAppFileSystem\(/,
  );
  assert.doesNotMatch(source, /useRef\(createAppFileSystem\(/);
  assert.match(
    source,
    /attachRequiredParticipant\(\s*"files",\s*fileSystemRef\.current!\.localDataResetParticipant,?\s*\)/,
  );
});

test("the file facade provider delegates root intent and tracked-work authority", () => {
  const source = readMobileSource("context", "AppFileSystemContext.tsx");

  assert.match(source, /captureLocalDataIntent/);
  assert.match(source, /isLocalDataIntentCurrent/);
  assert.match(source, /runTrackedLocalDataWork/);
  assert.match(source, /createExpoAppFileSystemAdapter/);
});

test("the inert provider owns no Care, Avatar, or Privacy implementation", () => {
  const source = readMobileSource("context", "LocalDataResetContext.tsx");

  assert.doesNotMatch(source, /CareContext|AvatarContext|PrivacyDataScreen/);
  assert.doesNotMatch(source, /multiRemove|deleteAsync|caches\.|serviceWorker/);
});
