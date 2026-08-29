import assert from "node:assert/strict";
import test from "node:test";

import {
  createCareAuthIdentityBoundary,
  type CareAuthIdentityPermit,
} from "./careAuthIdentityBoundary.ts";
import { runAtomicCareInitialRefresh } from "./careInitialSyncReadiness.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function signedIn(
  userId: string,
  sessionId: string,
  householdId = `household-${userId}`,
) {
  return {
    clerkLoaded: true,
    isSignedIn: true,
    userId,
    sessionId,
    householdId,
  } as const;
}

function dataScope(userId: string, householdId: string) {
  return `care-v2:${JSON.stringify([userId, householdId])}`;
}

function identityKey(userId: string, sessionId: string, householdId: string) {
  return JSON.stringify([userId, sessionId, householdId]);
}

test("a direct signed-in A to B transition hides A and revokes every A permit synchronously", () => {
  const boundary = createCareAuthIdentityBoundary();
  const a = boundary.observe(signedIn("user-a", "session-a"));
  const aPermit = boundary.captureSignedIn();

  assert.equal(a.dataScope, dataScope("user-a", "household-user-a"));
  assert.equal(
    boundary.canDisplay(dataScope("user-a", "household-user-a")),
    true,
  );
  assert.ok(aPermit);

  const b = boundary.observe(signedIn("user-b", "session-b"));

  assert.equal(b.dataScope, dataScope("user-b", "household-user-b"));
  assert.equal(
    boundary.canDisplay(dataScope("user-a", "household-user-a")),
    false,
  );
  assert.equal(boundary.canContinue(aPermit!), false);
  assert.equal(boundary.captureSignedIn()?.userId, "user-b");
});

test("a session replacement for the same user keeps the data scope but revokes the old mutation generation", () => {
  const boundary = createCareAuthIdentityBoundary();
  boundary.observe(signedIn("user-a", "session-1"));
  const oldPermit = boundary.captureSignedIn();

  boundary.observe(signedIn("user-a", "session-2"));
  const newPermit = boundary.captureSignedIn();

  assert.equal(
    boundary.snapshot().dataScope,
    dataScope("user-a", "household-user-a"),
  );
  assert.equal(boundary.canContinue(oldPermit!), false);
  assert.equal(boundary.canContinue(newPermit!), true);
  assert.notEqual(newPermit?.generation, oldPermit?.generation);
});

test("a signed-in identity remains undisplayable until its exact household is resolved", () => {
  const boundary = createCareAuthIdentityBoundary();
  const pending = boundary.observe({
    clerkLoaded: true,
    isSignedIn: true,
    userId: "user-a",
    sessionId: "session-a",
    householdId: null,
  });

  assert.equal(pending.phase, "household-pending");
  assert.equal(pending.dataScope, null);
  assert.equal(boundary.captureSignedIn(), null);
  assert.equal(boundary.captureMutationOrigin(), null);
  assert.equal(boundary.canDisplay(dataScope("user-a", "household-a")), false);

  const resolved = boundary.observe(
    signedIn("user-a", "session-a", "household-a"),
  );
  assert.equal(resolved.phase, "signed-in");
  assert.equal(resolved.householdId, "household-a");
  assert.equal(
    resolved.identityKey,
    identityKey("user-a", "session-a", "household-a"),
  );
  assert.equal(resolved.dataScope, dataScope("user-a", "household-a"));
});

test("a same-session household switch revokes permits and render-origin callbacks synchronously", () => {
  const boundary = createCareAuthIdentityBoundary();
  boundary.observe(signedIn("user-a", "session-a", "household-a"));
  const remotePermit = boundary.captureSignedIn();
  const renderOrigin = boundary.captureMutationOrigin();
  assert.ok(remotePermit);
  assert.ok(renderOrigin);

  boundary.observe(signedIn("user-a", "session-a", "household-b"));

  assert.equal(boundary.canContinue(remotePermit!), false);
  assert.equal(boundary.canInvoke(renderOrigin!), false);
  assert.equal(boundary.captureSignedIn()?.householdId, "household-b");
  assert.equal(
    boundary.snapshot().dataScope,
    dataScope("user-a", "household-b"),
  );
});

test("render-origin permits stay referentially stable until the identity changes", () => {
  const boundary = createCareAuthIdentityBoundary();
  boundary.observe(signedIn("user-a", "session-a", "household-a"));

  const first = boundary.captureMutationOrigin();
  const second = boundary.captureMutationOrigin();
  assert.ok(first);
  assert.equal(second, first);

  boundary.observe(signedIn("user-a", "session-a", "household-b"));
  const nextHousehold = boundary.captureMutationOrigin();
  assert.ok(nextHousehold);
  assert.notEqual(nextHousehold, first);
  assert.equal(boundary.canInvoke(first!), false);
  assert.equal(boundary.canInvoke(nextHousehold!), true);
});

test("opaque delimiter characters cannot collide across identity or household scopes", () => {
  const first = createCareAuthIdentityBoundary();
  const a = first.observe(signedIn("a:b", "c", "d:e"));
  const second = createCareAuthIdentityBoundary();
  const b = second.observe(signedIn("a", "b:c", "d:e"));
  const third = createCareAuthIdentityBoundary();
  const c = third.observe(signedIn("a:b", "c", "d:e"));
  const fourth = createCareAuthIdentityBoundary();
  const d = fourth.observe(signedIn("a:b", "c", "d:e:"));
  const fifth = createCareAuthIdentityBoundary();
  const householdA = fifth.observe(signedIn("a:b", "session", "c"));
  const sixth = createCareAuthIdentityBoundary();
  const householdB = sixth.observe(signedIn("a", "session", "b:c"));

  assert.notEqual(a.identityKey, b.identityKey);
  assert.notEqual(c.dataScope, d.dataScope);
  assert.notEqual(householdA.dataScope, householdB.dataScope);
  assert.equal(a.identityKey, JSON.stringify(["a:b", "c", "d:e"]));
  assert.equal(c.dataScope, `care-v2:${JSON.stringify(["a:b", "d:e"])}`);
  assert.equal(householdA.dataScope, `care-v2:${JSON.stringify(["a:b", "c"])}`);
  assert.equal(householdB.dataScope, `care-v2:${JSON.stringify(["a", "b:c"])}`);
});

test("signed-out render-origin callbacks are also revoked when authentication changes", () => {
  const boundary = createCareAuthIdentityBoundary();
  boundary.observe({ clerkLoaded: true, isSignedIn: false });
  const localOrigin = boundary.captureMutationOrigin();
  assert.ok(localOrigin);
  assert.equal(boundary.canInvoke(localOrigin!), true);

  boundary.observe(signedIn("user-a", "session-a", "household-a"));
  assert.equal(boundary.canInvoke(localOrigin!), false);
});

test("an auth-loading or signed-out bounce revokes remote permits without assigning user data to local mode", () => {
  const boundary = createCareAuthIdentityBoundary();
  boundary.observe(signedIn("user-a", "session-a"));
  const aPermit = boundary.captureSignedIn();

  boundary.observe({
    clerkLoaded: false,
    isSignedIn: false,
    userId: null,
    sessionId: null,
  });
  assert.equal(boundary.snapshot().dataScope, null);
  assert.equal(boundary.canContinue(aPermit!), false);

  boundary.observe({
    clerkLoaded: true,
    isSignedIn: false,
    userId: null,
    sessionId: null,
  });
  assert.equal(boundary.snapshot().dataScope, "local");
  assert.equal(boundary.captureSignedIn(), null);
});

test("an atomic initial refresh cannot commit either half before doc and entries both resolve", async () => {
  const doc = deferred<{ version: number; name: string }>();
  const entries = deferred<readonly string[]>();
  const commits: unknown[] = [];
  let permitCurrent = true;
  const permit = { generation: 1 } as CareAuthIdentityPermit;

  const refresh = runAtomicCareInitialRefresh({
    permit,
    canContinue: () => permitCurrent,
    fetchDoc: () => doc.promise,
    fetchEntries: () => entries.promise,
    stage: (nextDoc, nextEntries) => ({ nextDoc, nextEntries }),
    commit: (staged) => commits.push(staged),
  });

  doc.resolve({ version: 4, name: "B's dog" });
  await Promise.resolve();
  assert.deepEqual(commits, []);

  entries.resolve(["b-entry"]);
  assert.equal(await refresh, "committed");
  assert.deepEqual(commits, [
    {
      nextDoc: { version: 4, name: "B's dog" },
      nextEntries: ["b-entry"],
    },
  ]);
});

test("an A refresh resolving after the direct switch to B commits neither A doc nor A entries", async () => {
  const boundary = createCareAuthIdentityBoundary();
  boundary.observe(signedIn("user-a", "session-a"));
  const permit = boundary.captureSignedIn()!;
  const doc = deferred<{ owner: string }>();
  const entries = deferred<readonly string[]>();
  const commits: unknown[] = [];

  const refresh = runAtomicCareInitialRefresh({
    permit,
    canContinue: (captured) => boundary.canContinue(captured),
    fetchDoc: () => doc.promise,
    fetchEntries: () => entries.promise,
    stage: (nextDoc, nextEntries) => ({ nextDoc, nextEntries }),
    commit: (staged) => commits.push(staged),
  });

  boundary.observe(signedIn("user-b", "session-b"));
  doc.resolve({ owner: "A" });
  entries.resolve(["a-entry"]);

  assert.equal(await refresh, "stale");
  assert.deepEqual(commits, []);
});
