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
  assert.match(source, /generationAuthority: runtime\.generationAuthority/);
});

test("the provider catches up state after attaching its passive subscription", () => {
  const source = readMobileSource("context", "LocalDataResetContext.tsx");

  assert.match(
    source,
    /const unsubscribe = runtime\.operations\.subscribe\(setOperationState\);\s*setOperationState\(runtime\.operations\.getState\(\)\);\s*return unsubscribe;/,
  );
});

test("the reset provider owns the preference store above Auth, Care, and Avatar", () => {
  const layout = readMobileSource("app", "_layout.tsx");
  const queryOpen = layout.indexOf("<QueryClientProvider client={queryClient}>");
  const resetOpen = layout.indexOf("<LocalDataResetProvider>");
  const preferencesOpen = layout.indexOf("<DevicePreferencesProvider>");
  const auth = layout.indexOf("<AuthBridge />");
  const careOpen = layout.indexOf("<CareProvider>");
  const avatarOpen = layout.indexOf("<AvatarProvider>");
  const preferencesClose = layout.indexOf("</DevicePreferencesProvider>");
  const resetClose = layout.indexOf("</LocalDataResetProvider>");
  const queryClose = layout.indexOf("</QueryClientProvider>");

  for (const [name, index] of [
    ["QueryClientProvider", queryOpen],
    ["LocalDataResetProvider", resetOpen],
    ["DevicePreferencesProvider", preferencesOpen],
    ["AuthBridge", auth],
    ["CareProvider", careOpen],
    ["AvatarProvider", avatarOpen],
    ["DevicePreferencesProvider close", preferencesClose],
    ["LocalDataResetProvider close", resetClose],
    ["QueryClientProvider close", queryClose],
  ] as const) {
    assert.ok(index >= 0, `missing ${name}`);
  }
  assert.ok(queryOpen < resetOpen);
  assert.ok(resetOpen < preferencesOpen);
  assert.ok(preferencesOpen < auth);
  assert.ok(auth < careOpen);
  assert.ok(careOpen < avatarOpen);
  assert.ok(avatarOpen < preferencesClose);
  assert.ok(preferencesClose < resetClose);
  assert.ok(resetClose < queryClose);
});

test("the inert provider owns no Care, Avatar, or Privacy implementation", () => {
  const source = readMobileSource("context", "LocalDataResetContext.tsx");

  assert.doesNotMatch(source, /CareContext|AvatarContext|PrivacyDataScreen/);
  assert.doesNotMatch(source, /multiRemove|deleteAsync|caches\.|serviceWorker/);
});
