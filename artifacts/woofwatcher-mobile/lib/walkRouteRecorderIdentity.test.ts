import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  captureWalkRouteOperationAuthority,
  isWalkRouteOperationAuthorityCurrent,
  planWalkRouteRecorderTransition,
  resolveWalkRouteRecorderIdentity,
} from "./walkRouteRecorderLifecycle.ts";
import * as walkRouteRecorderLifecycle from "./walkRouteRecorderLifecycle.ts";
import {
  cancelWalkRouteCapture,
  getWalkRouteCaptureSnapshot,
  retryRetainedWalkRouteStopHandles,
  startWalkRouteCaptureWithAdapter,
  type WalkRoutePoint,
} from "./walkRoute.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const source = readFileSync(
  new URL("../components/WalkRouteRecorder.tsx", import.meta.url),
  "utf8",
);

test("the shipping walk bridge binds capture to Care identity and reset permits", () => {
  assert.match(source, /identityScopeKey/);
  assert.match(source, /identityScopeStatus/);
  assert.match(source, /initialSyncStatus/);
  assert.match(source, /storageWarning/);
  assert.match(source, /isWalkRouteRecorderIdentityAdmitted/);
  assert.match(source, /isWalkRouteRecorderAuthorityCurrent/);
  assert.match(source, /captureCareOperationPermit/);
  assert.match(source, /isCareOperationPermitCurrent/);
  assert.match(source, /isLocalDataIntentCurrent/);
  assert.match(source, /isCarePermitCurrent:\s*isCareOperationPermitCurrent/);
  assert.match(source, /isLocalDataIntentCurrent,/);
  assert.match(source, /useLayoutEffect/);
  assert.match(
    source,
    /captureAdmissionGate\.commit\(captureAdmitted\)[\s\S]*captureAdmitted,[\s\S]*identityScopeKey/,
    "only a committed readiness/identity layout may open recorder admission",
  );
  assert.doesNotMatch(
    source,
    /captureAdmissionRef\.current\s*=\s*captureAdmitted/,
    "a discarded concurrent render must not mutate live callback authority",
  );
});

test("discarded recorder renders cannot open or close committed admission", () => {
  const createGate = (
    walkRouteRecorderLifecycle as typeof walkRouteRecorderLifecycle & {
      createWalkRouteRecorderAdmissionGate?: () => {
        commit(admitted: boolean): () => void;
        isAdmitted(): boolean;
      };
    }
  ).createWalkRouteRecorderAdmissionGate;
  assert.equal(
    typeof createGate,
    "function",
    "the shipping bridge needs a commit-owned admission gate",
  );
  const gate = createGate!();

  assert.equal(gate.isAdmitted(), false);
  const cleanupA = gate.commit(true);
  assert.equal(gate.isAdmitted(), true);

  // A speculative render computes false, but React never commits it. Merely
  // computing that render cannot mutate the gate.
  const discardedRenderAdmission = false;
  assert.equal(discardedRenderAdmission, false);
  assert.equal(gate.isAdmitted(), true);

  const cleanupB = gate.commit(false);
  assert.equal(gate.isAdmitted(), false);
  cleanupA();
  assert.equal(
    gate.isAdmitted(),
    false,
    "a stale layout cleanup cannot overwrite the newer committed generation",
  );

  const cleanupC = gate.commit(true);
  assert.equal(gate.isAdmitted(), true);
  cleanupB();
  assert.equal(gate.isAdmitted(), true);
  cleanupC();
  assert.equal(gate.isAdmitted(), false);
});

test("a readiness-generation transition revokes an otherwise-current location callback", () => {
  const current = (
    walkRouteRecorderLifecycle as typeof walkRouteRecorderLifecycle & {
      isWalkRouteRecorderAuthorityCurrent?: (
        authority: {
          identityKey: string;
          carePermit: { identityKey: string };
          localDataIntent: { generation: number };
        },
        input: {
          isRecorderAdmitted: () => boolean;
          isCarePermitCurrent: (permit: { identityKey: string }) => boolean;
          isLocalDataIntentCurrent: (intent: { generation: number }) => boolean;
        },
      ) => boolean;
    }
  ).isWalkRouteRecorderAuthorityCurrent;
  assert.equal(typeof current, "function");

  const carePermit = { identityKey: "user-a:session-a:household-a" };
  const localDataIntent = { generation: 4 };
  const authority = {
    identityKey: carePermit.identityKey,
    carePermit,
    localDataIntent,
  };
  let admitted = true;
  const check = () =>
    current!(authority, {
      isRecorderAdmitted: () => admitted,
      isCarePermitCurrent: (candidate) => candidate === carePermit,
      isLocalDataIntentCurrent: (candidate) => candidate === localDataIntent,
    });

  assert.equal(check(), true);
  admitted = false;
  assert.equal(
    check(),
    false,
    "pending/error/future-schema readiness must invalidate a late callback even before its Care permit changes",
  );
});

test("walk capture admission requires the current hydrated and authoritative Care generation", () => {
  const admission = (
    walkRouteRecorderLifecycle as typeof walkRouteRecorderLifecycle & {
      isWalkRouteRecorderIdentityAdmitted?: (input: {
        isLoaded: boolean;
        identityScopeState: "local" | "pending" | "resolved" | "error";
        initialSyncSettled: boolean;
        storageWarning: string | null;
      }) => boolean;
    }
  ).isWalkRouteRecorderIdentityAdmitted;
  assert.equal(
    typeof admission,
    "function",
    "the shipping bridge needs one explicit Care admission contract",
  );

  const admitted = admission!;
  assert.equal(
    admitted({
      isLoaded: true,
      identityScopeState: "resolved",
      initialSyncSettled: true,
      storageWarning: null,
    }),
    true,
    "a settled signed-in identity may record",
  );
  assert.equal(
    admitted({
      isLoaded: true,
      identityScopeState: "local",
      initialSyncSettled: true,
      storageWarning: null,
    }),
    true,
    "successfully hydrated local mode may record",
  );

  for (const blocked of [
    {
      isLoaded: true,
      identityScopeState: "resolved" as const,
      initialSyncSettled: false,
      storageWarning: null,
    },
    {
      isLoaded: true,
      identityScopeState: "pending" as const,
      initialSyncSettled: true,
      storageWarning: null,
    },
    {
      isLoaded: true,
      identityScopeState: "error" as const,
      initialSyncSettled: true,
      storageWarning: null,
    },
    {
      isLoaded: false,
      identityScopeState: "local" as const,
      initialSyncSettled: false,
      storageWarning: "read-failed",
    },
    {
      isLoaded: true,
      identityScopeState: "local" as const,
      initialSyncSettled: true,
      storageWarning: "newer-version",
    },
  ]) {
    assert.equal(
      admitted(blocked),
      false,
      `capture must stay closed for ${JSON.stringify(blocked)}`,
    );
  }
});

test("unloaded or identity-changing Care state cancels capture instead of returning early", () => {
  assert.doesNotMatch(source, /if \(!isLoaded\) return;/);
  assert.match(source, /cancelWalkRouteCapture\(\)/);
  assert.match(source, /activeKeyRef\.current\s*=\s*null/);
});

test("walk operation authority requires the exact Care permit and local reset intent", () => {
  const carePermit = { identityKey: "user-a:session-a:household-a" };
  const localDataIntent = { generation: 7 };
  let careCurrent = true;
  let localCurrent = true;
  const authority = captureWalkRouteOperationAuthority({
    isLoaded: true,
    identityScopeKey: carePermit.identityKey,
    captureCarePermit: () => carePermit,
    captureLocalDataIntent: () => localDataIntent,
  });
  assert.ok(authority);
  const check = () =>
    isWalkRouteOperationAuthorityCurrent(authority!, {
      isCarePermitCurrent: (candidate) =>
        candidate === carePermit && careCurrent,
      isLocalDataIntentCurrent: (candidate) =>
        candidate === localDataIntent && localCurrent,
    });

  assert.equal(check(), true);
  careCurrent = false;
  assert.equal(check(), false, "an A-to-B Care transition revokes the watch");
  careCurrent = true;
  localCurrent = false;
  assert.equal(
    check(),
    false,
    "a reset barrier independently revokes the watch",
  );
});

test("pending/unloaded or mismatched rendered identity cannot authorize capture", () => {
  const permit = { identityKey: "user-b:session-b:household-b" };
  assert.equal(
    resolveWalkRouteRecorderIdentity({
      isLoaded: false,
      identityScopeKey: null,
      carePermit: permit,
    }),
    null,
  );
  assert.equal(
    resolveWalkRouteRecorderIdentity({
      isLoaded: true,
      identityScopeKey: "user-a:session-a:household-a",
      carePermit: permit,
    }),
    null,
  );
  assert.equal(
    captureWalkRouteOperationAuthority({
      isLoaded: true,
      identityScopeKey: permit.identityKey,
      captureCarePermit: () => permit,
      captureLocalDataIntent: () => null,
    }),
    null,
  );
});

test("an exact household switch cancels A without finishing A under B", () => {
  assert.deepEqual(
    planWalkRouteRecorderTransition({
      active: {
        identityKey: "user-a:session-a:household-a",
        sessionKey: "shared-walk-key",
      },
      currentIdentityKey: "user-a:session-a:household-b",
      currentSessionKey: "shared-walk-key",
      captureStatus: "recording",
      careMutationsBlocked: false,
    }),
    {
      cancelCapture: true,
      finishSessionKey: null,
      startSessionKey: "shared-walk-key",
      next: {
        identityKey: "user-a:session-a:household-b",
        sessionKey: "shared-walk-key",
      },
    },
  );
});

test("unloaded Care clears both active keys while a same-identity reset pause is held", () => {
  const active = {
    identityKey: "user-a:session-a:household-a",
    sessionKey: "walk-a",
  };
  assert.deepEqual(
    planWalkRouteRecorderTransition({
      active,
      currentIdentityKey: null,
      currentSessionKey: null,
      captureStatus: "recording",
      careMutationsBlocked: false,
    }),
    {
      cancelCapture: true,
      finishSessionKey: null,
      startSessionKey: null,
      next: { identityKey: null, sessionKey: null },
    },
  );
  assert.deepEqual(
    planWalkRouteRecorderTransition({
      active,
      currentIdentityKey: active.identityKey,
      currentSessionKey: active.sessionKey,
      captureStatus: "paused",
      careMutationsBlocked: true,
    }),
    {
      cancelCapture: false,
      finishSessionKey: null,
      startSessionKey: null,
      next: active,
    },
  );
});

test("a deferred A watch cannot write into B and its late teardown retry leaves B active", async () => {
  const aSetup = deferred<() => void>();
  let aPoint: ((point: WalkRoutePoint) => void) | null = null;
  let bPoint: ((point: WalkRoutePoint) => void) | null = null;
  let aCurrent = true;
  let bCurrent = true;
  let localCurrent = true;
  let aStopCalls = 0;
  let bStopCalls = 0;
  const localDataIntent = { generation: 3 };
  const aPermit = { identityKey: "user-a:session-a:household-a" };
  const bPermit = { identityKey: "user-b:session-b:household-b" };
  const aAuthority = captureWalkRouteOperationAuthority({
    isLoaded: true,
    identityScopeKey: aPermit.identityKey,
    captureCarePermit: () => aPermit,
    captureLocalDataIntent: () => localDataIntent,
  })!;
  const bAuthority = captureWalkRouteOperationAuthority({
    isLoaded: true,
    identityScopeKey: bPermit.identityKey,
    captureCarePermit: () => bPermit,
    captureLocalDataIntent: () => localDataIntent,
  })!;
  const check = (authority: typeof aAuthority, careCurrent: () => boolean) =>
    isWalkRouteOperationAuthorityCurrent(authority, {
      isCarePermitCurrent: (permit) =>
        permit === authority.carePermit && careCurrent(),
      isLocalDataIntentCurrent: (intent) =>
        intent === localDataIntent && localCurrent,
    });

  try {
    const aStart = startWalkRouteCaptureWithAdapter(
      "walk-a",
      {
        async start(onPoint) {
          aPoint = onPoint;
          return aSetup.promise;
        },
      },
      () => check(aAuthority, () => aCurrent),
    );

    aCurrent = false;
    cancelWalkRouteCapture();

    await startWalkRouteCaptureWithAdapter(
      "walk-b",
      {
        async start(onPoint) {
          bPoint = onPoint;
          return () => {
            bStopCalls += 1;
          };
        },
      },
      () => check(bAuthority, () => bCurrent),
    );
    bPoint?.({ lat: 37.77, lon: -122.41, t: 100 });

    aSetup.resolve(() => {
      aStopCalls += 1;
      if (aStopCalls === 1) throw new Error("late A teardown failed once");
    });
    await assert.rejects(aStart, /late A teardown failed once/);
    retryRetainedWalkRouteStopHandles();

    aPoint?.({ lat: 38, lon: -123, t: 200 });
    bPoint?.({ lat: 37.771, lon: -122.41, t: 300 });
    assert.deepEqual(getWalkRouteCaptureSnapshot(), {
      status: "recording",
      sessionKey: "walk-b",
      pointCount: 2,
    });
    assert.equal(aStopCalls, 2);
    assert.equal(bStopCalls, 0, "retrying A must not stop B's subscription");
  } finally {
    aCurrent = false;
    bCurrent = false;
    localCurrent = false;
    aSetup.resolve(() => {});
    cancelWalkRouteCapture();
  }
});
