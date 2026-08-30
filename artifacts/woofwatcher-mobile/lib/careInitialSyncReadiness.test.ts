import assert from "node:assert/strict";
import test from "node:test";

import { createCareInitialSyncReadiness } from "./careInitialSyncReadiness.ts";

test("initial Care readiness waits for late Clerk auth and the signed-in sync", () => {
  const readiness = createCareInitialSyncReadiness();

  readiness.observeAuth({
    clerkLoaded: false,
    isSignedIn: false,
    identityKey: null,
  });
  assert.equal(readiness.isSettled(true), false);
  assert.equal(readiness.captureSyncAttempt(), null);

  readiness.observeAuth({
    clerkLoaded: true,
    isSignedIn: true,
    identityKey: "user-a:session-a:household-a",
  });
  assert.equal(readiness.isSettled(true), false);
  const attempt = readiness.captureSyncAttempt();
  assert.equal(typeof attempt, "number");

  assert.equal(readiness.settleSuccessfulSync(attempt!), true);
  assert.equal(readiness.isSettled(true), true);
});

test("signed-out readiness still requires local hydration", () => {
  const readiness = createCareInitialSyncReadiness();
  readiness.observeAuth({
    clerkLoaded: true,
    isSignedIn: false,
    identityKey: null,
  });

  assert.equal(readiness.isSettled(false), false);
  assert.equal(readiness.isSettled(true), true);
});

test("signed-in auth stays pending until an exact nonblank identity key exists", () => {
  const readiness = createCareInitialSyncReadiness();
  readiness.observeAuth({
    clerkLoaded: true,
    isSignedIn: true,
    identityKey: "   ",
  });

  assert.equal(readiness.getStatus(true).state, "pending");
  assert.equal(readiness.captureSyncAttempt(), null);

  readiness.observeAuth({
    clerkLoaded: true,
    isSignedIn: true,
    identityKey: "user-a:session-a:household-a",
  });
  assert.ok(readiness.captureSyncAttempt());
});

test("a stale sync cannot settle a later signed-in auth cycle", () => {
  const readiness = createCareInitialSyncReadiness();
  readiness.observeAuth({
    clerkLoaded: true,
    isSignedIn: true,
    identityKey: "user-a:session-a:household-a",
  });
  const staleAttempt = readiness.captureSyncAttempt();
  assert.equal(typeof staleAttempt, "number");

  readiness.observeAuth({
    clerkLoaded: true,
    isSignedIn: false,
    identityKey: null,
  });
  readiness.observeAuth({
    clerkLoaded: true,
    isSignedIn: true,
    identityKey: "user-b:session-b:household-b",
  });
  assert.equal(readiness.isSettled(true), false);
  assert.equal(readiness.settleSuccessfulSync(staleAttempt!), false);
  assert.equal(readiness.isSettled(true), false);

  const currentAttempt = readiness.captureSyncAttempt();
  assert.equal(readiness.settleSuccessfulSync(currentAttempt!), true);
  assert.equal(readiness.isSettled(true), true);
});

test("repeated observations do not reopen a settled auth cycle", () => {
  const readiness = createCareInitialSyncReadiness();
  readiness.observeAuth({
    clerkLoaded: true,
    isSignedIn: true,
    identityKey: "user-a:session-a:household-a",
  });
  const attempt = readiness.captureSyncAttempt();
  assert.equal(readiness.settleSuccessfulSync(attempt!), true);

  readiness.observeAuth({
    clerkLoaded: true,
    isSignedIn: true,
    identityKey: "user-a:session-a:household-a",
  });
  assert.equal(readiness.isSettled(true), true);
  assert.equal(readiness.settleSuccessfulSync(attempt!), false);
});

test("a direct signed-in identity change requires its own successful sync", () => {
  const readiness = createCareInitialSyncReadiness();
  readiness.observeAuth({
    clerkLoaded: true,
    isSignedIn: true,
    identityKey: "user-a:session-a",
  });
  const firstAttempt = readiness.captureSyncAttempt();
  assert.equal(readiness.settleSuccessfulSync(firstAttempt!), true);

  readiness.observeAuth({
    clerkLoaded: true,
    isSignedIn: true,
    identityKey: "user-b:session-b",
  });
  assert.equal(readiness.isSettled(true), false);
  assert.equal(readiness.settleSuccessfulSync(firstAttempt!), false);

  const secondAttempt = readiness.captureSyncAttempt();
  assert.equal(readiness.settleSuccessfulSync(secondAttempt!), true);
  assert.equal(readiness.isSettled(true), true);
});

test("transient initial-sync failures retry boundedly before exposing an actionable error", () => {
  const readiness = createCareInitialSyncReadiness({
    retryDelaysMs: [25, 75],
  });
  readiness.observeAuth({
    clerkLoaded: true,
    isSignedIn: true,
    identityKey: "user-a:session-a",
  });

  const first = readiness.captureSyncAttempt();
  assert.ok(first);
  assert.deepEqual(readiness.settleFailedSync(first!, "offline"), {
    accepted: true,
    retryDelayMs: 25,
  });
  const second = readiness.captureSyncAttempt();
  assert.ok(second);
  assert.deepEqual(readiness.settleFailedSync(second!, "offline"), {
    accepted: true,
    retryDelayMs: 75,
  });
  const third = readiness.captureSyncAttempt();
  assert.ok(third);
  assert.deepEqual(readiness.settleFailedSync(third!, "offline"), {
    accepted: true,
    retryDelayMs: null,
  });
  assert.deepEqual(readiness.getStatus(true), {
    state: "error",
    isSettled: false,
    retryable: true,
    message:
      "WoofWatcher could not confirm the current household records. Try again.",
  });
});

test("manual retry reopens a terminal initial-sync failure", () => {
  const readiness = createCareInitialSyncReadiness({ retryDelaysMs: [] });
  readiness.observeAuth({
    clerkLoaded: true,
    isSignedIn: true,
    identityKey: "user-a:session-a",
  });
  const failed = readiness.captureSyncAttempt();
  assert.ok(failed);
  readiness.settleFailedSync(failed!, "offline");
  assert.equal(readiness.getStatus(true).state, "error");

  assert.equal(readiness.requestRetry(), true);
  assert.equal(readiness.getStatus(true).state, "pending");
  const retry = readiness.captureSyncAttempt();
  assert.ok(retry);
  assert.equal(readiness.settleSuccessfulSync(retry!), true);
  assert.equal(readiness.getStatus(true).state, "settled");
});

test("an exact-auth attempt can fail truthfully after write admission closes mid-refresh", () => {
  const readiness = createCareInitialSyncReadiness({
    retryDelaysMs: [25, 75],
  });
  readiness.observeAuth({
    clerkLoaded: true,
    isSignedIn: true,
    identityKey: "user-a:session-a:household-a",
  });
  const attempt = readiness.captureSyncAttempt();
  assert.ok(attempt);

  // A future-schema response deliberately closes Care writes before the
  // request settles. Readiness still has to release the exact attempt and
  // expose a retryable error instead of remaining pending forever.
  assert.deepEqual(
    readiness.settleFailedSync(attempt!, new Error("newer schema"), {
      terminal: true,
    }),
    { accepted: true, retryDelayMs: null },
  );
  assert.equal(readiness.getStatus(true).state, "error");
  assert.equal(readiness.getStatus(true).retryable, true);
  assert.equal(readiness.requestRetry(), true);
  assert.ok(readiness.captureSyncAttempt());
});

test("a same-user auth bounce starts a fresh attempt and cannot be settled by the old request", () => {
  const readiness = createCareInitialSyncReadiness();
  readiness.observeAuth({
    clerkLoaded: true,
    isSignedIn: true,
    identityKey: "user-a:session-1",
  });
  const oldAttempt = readiness.captureSyncAttempt();
  assert.ok(oldAttempt);

  readiness.observeAuth({
    clerkLoaded: false,
    isSignedIn: false,
    identityKey: null,
  });
  readiness.observeAuth({
    clerkLoaded: true,
    isSignedIn: true,
    identityKey: "user-a:session-2",
  });
  assert.equal(readiness.settleSuccessfulSync(oldAttempt!), false);
  const current = readiness.captureSyncAttempt();
  assert.ok(current);
  assert.equal(readiness.settleSuccessfulSync(current!), true);
  assert.equal(readiness.isSettled(true), true);
});
