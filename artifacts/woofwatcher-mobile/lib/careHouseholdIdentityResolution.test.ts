import assert from "node:assert/strict";
import test from "node:test";

import {
  admitCareHouseholdIdentityMe,
  createCareHouseholdIdentityResolution,
  createCareHouseholdExpiryRevocation,
  type CareHouseholdIdentityResolutionAttempt,
  type CareHouseholdIdentityResolutionRetry,
} from "./careHouseholdIdentityResolution.ts";
import { createCareAuthIdentityBoundary } from "./careAuthIdentityBoundary.ts";

const loading = {
  clerkLoaded: false,
  isSignedIn: false,
  userId: null,
  sessionId: null,
} as const;

const signedOut = {
  clerkLoaded: true,
  isSignedIn: false,
  userId: null,
  sessionId: null,
} as const;

function signedIn(userId: string, sessionId: string) {
  return {
    clerkLoaded: true,
    isSignedIn: true,
    userId,
    sessionId,
  } as const;
}

function identityKey(userId: string, sessionId: string): string {
  return JSON.stringify([userId, sessionId]);
}

function freshMe(userId: string, householdId: string) {
  return {
    authorityObservedAt: "2026-08-28T12:00:00.000Z",
    user: { id: userId },
    household: { id: householdId },
    members: [
      {
        userId,
        isSelf: true,
        role: "owner",
        accessPassExpiresAt: null,
        accessPassExpired: false,
      },
    ],
  } as const;
}

function failCurrentAttempt(
  resolution: ReturnType<typeof createCareHouseholdIdentityResolution>,
) {
  const attempt = resolution.captureAttempt();
  assert.ok(attempt);
  return resolution.settleFailure(attempt, new Error("offline"));
}

test("loading, local, pending, and resolved household states remain distinct", () => {
  const resolution = createCareHouseholdIdentityResolution();

  assert.deepEqual(resolution.snapshot(), {
    state: "pending",
    pendingFor: "auth",
    generation: 0,
    userId: null,
    sessionId: null,
    identityKey: null,
    householdId: null,
    retryable: false,
    message: null,
  });
  assert.equal(resolution.captureAttempt(), null);

  const local = resolution.observeAuth(signedOut);
  assert.equal(local.state, "local");
  assert.equal(local.pendingFor, null);
  assert.equal(local.identityKey, null);
  assert.equal(resolution.captureAttempt(), null);

  const pending = resolution.observeAuth(signedIn("user-a", "session-a"));
  assert.equal(pending.state, "pending");
  assert.equal(pending.pendingFor, "household");
  assert.equal(pending.userId, "user-a");
  assert.equal(pending.sessionId, "session-a");
  assert.equal(pending.identityKey, identityKey("user-a", "session-a"));

  const attempt = resolution.captureAttempt();
  assert.ok(attempt);
  const settlement = resolution.settleFreshMe(
    attempt,
    freshMe("user-a", "household-a"),
  );
  assert.deepEqual(settlement, {
    accepted: true,
    householdId: "household-a",
    retryDelayMs: null,
    retry: null,
  });
  assert.equal(resolution.snapshot().state, "resolved");
  assert.equal(resolution.snapshot().householdId, "household-a");
});

test("an attempt token is exact, single-flight, unforgeable, and bound to raw Clerk identity", () => {
  const resolution = createCareHouseholdIdentityResolution();
  resolution.observeAuth(signedIn("user-a", "session-a"));
  const attempt = resolution.captureAttempt();
  assert.ok(attempt);
  assert.equal(attempt.userId, "user-a");
  assert.equal(attempt.sessionId, "session-a");
  assert.equal(attempt.identityKey, identityKey("user-a", "session-a"));
  assert.equal(resolution.captureAttempt(), null);
  assert.equal(resolution.canContinue(attempt), true);

  const forged = Object.freeze({ ...attempt });
  assert.equal(
    resolution.canContinue(forged as CareHouseholdIdentityResolutionAttempt),
    false,
  );
  assert.deepEqual(
    resolution.settleFreshMe(
      forged as CareHouseholdIdentityResolutionAttempt,
      freshMe("user-a", "household-a"),
    ),
    {
      accepted: false,
      householdId: null,
      retryDelayMs: null,
      retry: null,
    },
  );
  assert.equal(resolution.canContinue(attempt), true);
});

test("transient failures schedule only 400 ms and 1200 ms retries before an actionable error", () => {
  const resolution = createCareHouseholdIdentityResolution();
  resolution.observeAuth(signedIn("user-a", "session-a"));

  const firstAttempt = resolution.captureAttempt();
  assert.ok(firstAttempt);
  const firstFailure = resolution.settleFailure(firstAttempt, "offline");
  assert.equal(firstFailure.accepted, true);
  assert.equal(firstFailure.retryDelayMs, 400);
  assert.ok(firstFailure.retry);
  assert.equal(resolution.snapshot().state, "pending");
  assert.equal(resolution.captureAttempt(), null);

  const secondAttempt = resolution.captureRetry(firstFailure.retry!);
  assert.ok(secondAttempt);
  assert.equal(resolution.captureRetry(firstFailure.retry!), null);
  const secondFailure = resolution.settleFailure(secondAttempt, "offline");
  assert.equal(secondFailure.retryDelayMs, 1200);
  assert.ok(secondFailure.retry);

  const thirdAttempt = resolution.captureRetry(secondFailure.retry!);
  assert.ok(thirdAttempt);
  const terminal = resolution.settleFailure(thirdAttempt, "offline");
  assert.deepEqual(terminal, {
    accepted: true,
    householdId: null,
    retryDelayMs: null,
    retry: null,
  });
  assert.deepEqual(resolution.snapshot(), {
    state: "error",
    pendingFor: null,
    generation: 1,
    userId: "user-a",
    sessionId: "session-a",
    identityKey: identityKey("user-a", "session-a"),
    householdId: null,
    retryable: true,
    message:
      "WoofWatcher could not confirm the active household for this sign-in. Check your connection and try again.",
  });
});

test("requestRetry clears the error and resets the complete automatic retry budget", () => {
  const resolution = createCareHouseholdIdentityResolution();
  resolution.observeAuth(signedIn("user-a", "session-a"));

  let result = failCurrentAttempt(resolution);
  let attempt = resolution.captureRetry(result.retry!);
  assert.ok(attempt);
  result = resolution.settleFailure(attempt, "offline");
  attempt = resolution.captureRetry(result.retry!);
  assert.ok(attempt);
  result = resolution.settleFailure(attempt, "offline");
  assert.equal(result.retryDelayMs, null);
  assert.equal(resolution.snapshot().state, "error");

  assert.equal(resolution.requestRetry(), true);
  assert.equal(resolution.snapshot().state, "pending");
  assert.equal(resolution.snapshot().pendingFor, "household");
  const manualAttempt = resolution.captureAttempt();
  assert.ok(manualAttempt);
  const restarted = resolution.settleFailure(manualAttempt, "offline");
  assert.equal(restarted.retryDelayMs, 400);
  assert.ok(restarted.retry);
  assert.equal(resolution.requestRetry(), false);

  const restoredSecond = resolution.captureRetry(restarted.retry!);
  assert.ok(restoredSecond);
  const restoredSecondFailure = resolution.settleFailure(
    restoredSecond,
    "offline",
  );
  assert.equal(restoredSecondFailure.retryDelayMs, 1200);
  assert.ok(restoredSecondFailure.retry);

  const restoredThird = resolution.captureRetry(restoredSecondFailure.retry!);
  assert.ok(restoredThird);
  const restoredTerminal = resolution.settleFailure(restoredThird, "offline");
  assert.equal(restoredTerminal.retryDelayMs, null);
  assert.equal(restoredTerminal.retry, null);
  assert.equal(resolution.snapshot().state, "error");
  assert.equal(resolution.snapshot().retryable, true);
});

test("a fresh /api/me response must exactly match the Clerk user and self membership", () => {
  const resolution = createCareHouseholdIdentityResolution();
  resolution.observeAuth(signedIn("user-a", "session-a"));

  const wrongUser = resolution.captureAttempt();
  assert.ok(wrongUser);
  const wrongUserResult = resolution.settleFreshMe(
    wrongUser,
    freshMe("user-b", "household-b"),
  );
  assert.equal(wrongUserResult.householdId, null);
  assert.equal(wrongUserResult.retryDelayMs, 400);

  const missingSelf = resolution.captureRetry(wrongUserResult.retry!);
  assert.ok(missingSelf);
  const missingSelfResult = resolution.settleFreshMe(missingSelf, {
    user: { id: "user-a" },
    household: { id: "household-a" },
    members: [{ userId: "user-a", isSelf: false }],
  });
  assert.equal(missingSelfResult.householdId, null);
  assert.equal(missingSelfResult.retryDelayMs, 1200);

  const valid = resolution.captureRetry(missingSelfResult.retry!);
  assert.ok(valid);
  assert.equal(
    resolution.settleFreshMe(valid, freshMe("user-a", "household-a"))
      .householdId,
    "household-a",
  );
  assert.equal(resolution.snapshot().state, "resolved");
});

test("expired, malformed, or non-authoritative self access never resolves Care authority", () => {
  for (const member of [
    {
      userId: "user-a",
      isSelf: true,
      role: "sitter",
      accessPassExpiresAt: "2026-08-28T11:59:59.999Z",
      accessPassExpired: true,
    },
    {
      userId: "user-a",
      isSelf: true,
      role: "expired access pass",
      accessPassExpiresAt: "2026-08-28T11:59:59.999Z",
      accessPassExpired: true,
    },
    {
      userId: "user-a",
      isSelf: true,
      role: "owner",
      accessPassExpiresAt: null,
      accessPassExpired: true,
    },
  ] as const) {
    const resolution = createCareHouseholdIdentityResolution({
      monotonicNow: () => 1_000,
    });
    resolution.observeAuth(signedIn("user-a", "session-a"));
    const attempt = resolution.captureAttempt();
    assert.ok(attempt);
    const settlement = resolution.settleFreshMe(attempt, {
      user: { id: "user-a" },
      household: { id: "household-a" },
      members: [member],
    });
    assert.equal(settlement.householdId, null);
    assert.equal(resolution.snapshot().state, "pending");
    assert.equal(resolution.activeAccessLeaseDeadlineMonotonicMs(), null);
  }
});

test("a future helper lease uses provider time, charges monotonic transit, and ignores device wall-clock skew", () => {
  const authorityObservedAt = "2026-08-28T12:00:00.000Z";
  const expiresAt = "2026-08-28T12:10:00.000Z";
  let monotonicNow = 1_000;
  const resolution = createCareHouseholdIdentityResolution({
    monotonicNow: () => monotonicNow,
  });
  const originalDateNow = Date.now;
  Date.now = () => Date.parse("1901-01-01T00:00:00.000Z");
  try {
    resolution.observeAuth(signedIn("user-a", "session-a"));
    const attempt = resolution.captureAttempt();
    assert.ok(attempt);
    monotonicNow = 1_250;
    const settlement = resolution.settleFreshMe(attempt, {
      authorityObservedAt,
      user: { id: "user-a" },
      household: { id: "household-a" },
      members: [
        {
          userId: "user-a",
          isSelf: true,
          role: "sitter",
          accessPassExpiresAt: expiresAt,
          accessPassExpired: false,
        },
      ],
    });
    assert.equal(settlement.householdId, "household-a");
    assert.equal(
      resolution.activeAccessLeaseDeadlineMonotonicMs(),
      601_000,
      "the 250ms request transit is already charged because the deadline is anchored at attempt start",
    );
    assert.deepEqual(resolution.activeAccessLease(), {
      observedAtMonotonicMs: 1_250,
      deadlineMonotonicMs: 601_000,
    });
    assert.equal(resolution.hasActiveTemporaryAccess(), true);
    assert.equal(resolution.restartResolution(), true);
    assert.equal(resolution.activeAccessLeaseDeadlineMonotonicMs(), null);
    assert.equal(resolution.hasActiveTemporaryAccess(), false);
  } finally {
    Date.now = originalDateNow;
  }
});

test("a helper join Exact Me with provider-authorized null expiry resolves mobile Care authority", () => {
  const originalDateNow = Date.now;
  try {
    for (const deviceNow of [
      "1901-01-01T00:00:00.000Z",
      "2201-01-01T00:00:00.000Z",
    ]) {
      Date.now = () => Date.parse(deviceNow);
      for (const role of [
        "sitter",
        "trainer",
        "walker",
        "vet viewer",
      ] as const) {
        let monotonicNow = 5_000;
        const resolution = createCareHouseholdIdentityResolution({
          monotonicNow: () => monotonicNow,
        });
        resolution.observeAuth(signedIn("helper-a", "session-helper"));
        const attempt = resolution.captureAttempt();
        assert.ok(attempt, `${deviceNow}: ${role}`);
        monotonicNow = 5_100;

        const settlement = resolution.settleFreshMe(attempt, {
          authorityObservedAt: "2026-08-29T12:00:00.000Z",
          user: { id: "helper-a" },
          household: { id: "joined-household" },
          members: [
            {
              userId: "helper-a",
              isSelf: true,
              role,
              accessPassExpiresAt: null,
              accessPassExpired: false,
            },
          ],
        });

        assert.equal(
          settlement.householdId,
          "joined-household",
          `${deviceNow}: ${role}`,
        );
        assert.equal(
          resolution.snapshot().state,
          "resolved",
          `${deviceNow}: ${role}`,
        );
        assert.equal(
          resolution.hasActiveTemporaryAccess(),
          true,
          `${deviceNow}: ${role}`,
        );
        assert.equal(
          resolution.activeAccessLease(),
          null,
          `${deviceNow}: ${role}`,
        );
      }
    }
  } finally {
    Date.now = originalDateNow;
  }
});

test("helper Exact Me malformed authority and a foreign self row fail closed independently", () => {
  const validHelper = {
    userId: "user-a",
    isSelf: true,
    role: "sitter",
    accessPassExpiresAt: null,
    accessPassExpired: false,
  } as const;
  const exactMe = (member: Record<string, unknown>) => ({
    authorityObservedAt: "2026-08-29T12:00:00.000Z",
    user: { id: "user-a" },
    household: { id: "household-a" },
    members: [member],
  });
  const timing = {
    requestStartedAtMonotonicMs: 1_000,
    responseReceivedAtMonotonicMs: 1_100,
  } as const;

  for (const [label, member] of [
    [
      "unknown role",
      { ...validHelper, role: "temporary helper" },
    ],
    [
      "malformed expiry",
      { ...validHelper, accessPassExpiresAt: "not-a-time" },
    ],
    [
      "noncanonical expiry",
      {
        ...validHelper,
        accessPassExpiresAt: "2026-08-29T12:05:00Z",
      },
    ],
    [
      "foreign self row",
      { ...validHelper, userId: "user-b" },
    ],
  ] as const) {
    assert.equal(
      admitCareHouseholdIdentityMe(exactMe(member), "user-a", timing),
      null,
      label,
    );
  }
});

test("temporary access fails closed after lease-consuming transit or a nonfinite/backwards monotonic clock", () => {
  const response = {
    authorityObservedAt: "2026-08-28T12:00:00.000Z",
    user: { id: "user-a" },
    household: { id: "household-a" },
    members: [
      {
        userId: "user-a",
        isSelf: true,
        role: "walker",
        accessPassExpiresAt: "2026-08-28T12:00:05.000Z",
        accessPassExpired: false,
      },
    ],
  } as const;

  for (const [label, start, finish] of [
    ["lease consumed in transit", 100, 5_100],
    ["clock moved backwards", 100, 99],
    ["nonfinite request start", Number.NaN, 100],
    ["nonfinite response time", 100, Number.POSITIVE_INFINITY],
  ] as const) {
    let monotonicNow = start;
    const resolution = createCareHouseholdIdentityResolution({
      monotonicNow: () => monotonicNow,
    });
    resolution.observeAuth(signedIn("user-a", "session-a"));
    const attempt = resolution.captureAttempt();
    assert.ok(attempt, label);
    monotonicNow = finish;
    const result = resolution.settleFreshMe(attempt, response);
    assert.equal(result.householdId, null, label);
    assert.equal(resolution.snapshot().state, "pending", label);
    assert.equal(resolution.hasActiveTemporaryAccess(), false, label);
  }
});

test("temporary access requires exact provider-observed authority time before expiry", () => {
  for (const authorityObservedAt of [
    undefined,
    "not-a-time",
    " 2026-08-28T12:00:00.000Z",
    "2026-08-28T12:00:00Z",
    "2026-08-28T12:10:00.000Z",
    "2026-08-28T12:10:00.001Z",
  ] as const) {
    let monotonicNow = 100;
    const resolution = createCareHouseholdIdentityResolution({
      monotonicNow: () => monotonicNow,
    });
    resolution.observeAuth(signedIn("user-a", "session-a"));
    const attempt = resolution.captureAttempt();
    assert.ok(attempt);
    monotonicNow = 101;
    const result = resolution.settleFreshMe(attempt, {
      authorityObservedAt,
      user: { id: "user-a" },
      household: { id: "household-a" },
      members: [
        {
          userId: "user-a",
          isSelf: true,
          role: "trainer",
          accessPassExpiresAt: "2026-08-28T12:10:00.000Z",
          accessPassExpired: false,
        },
      ],
    });
    assert.equal(result.householdId, null, String(authorityObservedAt));
    assert.equal(resolution.hasActiveTemporaryAccess(), false);
  }
});

test("permanent owner admission is unchanged when the monotonic clock is unavailable", () => {
  let monotonicNow = Number.NaN;
  const resolution = createCareHouseholdIdentityResolution({
    monotonicNow: () => monotonicNow,
  });
  resolution.observeAuth(signedIn("user-a", "session-a"));
  const attempt = resolution.captureAttempt();
  assert.ok(attempt);
  monotonicNow = Number.NEGATIVE_INFINITY;
  assert.equal(
    resolution.settleFreshMe(attempt, freshMe("user-a", "household-a"))
      .householdId,
    "household-a",
  );
  assert.equal(resolution.hasActiveTemporaryAccess(), false);
  assert.equal(resolution.activeAccessLeaseDeadlineMonotonicMs(), null);
});

test("permanent roles still require an exact provider authority timestamp", () => {
  for (const role of ["owner", "adult"] as const) {
    for (const authorityObservedAt of [
      undefined,
      null,
      "not-a-time",
      " 2026-08-28T12:00:00.000Z",
      "2026-08-28T12:00:00Z",
    ] as const) {
      const resolution = createCareHouseholdIdentityResolution({
        monotonicNow: () => Number.NaN,
      });
      resolution.observeAuth(signedIn("user-a", "session-a"));
      const attempt = resolution.captureAttempt();
      assert.ok(attempt);
      const result = resolution.settleFreshMe(attempt, {
        authorityObservedAt,
        user: { id: "user-a" },
        household: { id: "household-a" },
        members: [
          {
            userId: "user-a",
            isSelf: true,
            role,
            accessPassExpiresAt: null,
            accessPassExpired: false,
          },
        ],
      });
      assert.equal(result.householdId, null, `${role}: ${authorityObservedAt}`);
    }
  }
});

test("the exact helper-expiry callback revokes permits and cached Care visibility synchronously", () => {
  let monotonicNow = 2_000;
  let pending:
    | { callback: () => void; delayMs: number; handle: number }
    | null = null;
  let nextHandle = 0;
  const expiry = createCareHouseholdExpiryRevocation({
    monotonicNow: () => monotonicNow,
    setTimer(callback, delayMs) {
      nextHandle += 1;
      pending = { callback, delayMs, handle: nextHandle };
      return nextHandle;
    },
    clearTimer(handle) {
      if (pending?.handle === handle) pending = null;
    },
  });
  const resolution = createCareHouseholdIdentityResolution({
    monotonicNow: () => monotonicNow,
  });
  const auth = createCareAuthIdentityBoundary();
  const clerk = signedIn("user-a", "session-a");
  resolution.observeAuth(clerk);
  const attempt = resolution.captureAttempt();
  assert.ok(attempt);
  resolution.settleFreshMe(attempt, {
    authorityObservedAt: "2026-08-29T12:00:00.000Z",
    user: { id: "user-a" },
    household: { id: "household-a" },
    members: [
      {
        userId: "user-a",
        isSelf: true,
        role: "sitter",
        accessPassExpiresAt: "2026-08-29T12:01:00.000Z",
        accessPassExpired: false,
      },
    ],
  });
  auth.observe({ ...clerk, householdId: resolution.snapshot().householdId });
  const permit = auth.captureSignedIn();
  assert.ok(permit);
  assert.equal(auth.canContinue(permit), true);
  assert.equal(auth.canDisplay(permit.dataScope), true);

  expiry.arm(resolution.activeAccessLease(), () => {
    auth.observe({ ...clerk, householdId: null });
    resolution.restartResolution();
  });
  assert.equal(pending?.delayMs, 60_000);
  monotonicNow += 60_000;
  pending?.callback();

  assert.equal(auth.canContinue(permit), false);
  assert.equal(auth.canDisplay(permit.dataScope), false);
  assert.equal(resolution.snapshot().state, "pending");
  assert.equal(resolution.activeAccessLeaseDeadlineMonotonicMs(), null);
});

test("a repeated membership contradiction enters a retryable fail-closed terminal state", () => {
  const resolution = createCareHouseholdIdentityResolution();
  resolution.observeAuth(signedIn("user-a", "session-a"));
  const attempt = resolution.captureAttempt();
  assert.ok(attempt);
  resolution.settleFreshMe(attempt, freshMe("user-a", "household-a"));

  assert.equal(resolution.rejectAuthority(), true);
  assert.deepEqual(resolution.snapshot(), {
    state: "error",
    pendingFor: null,
    generation: 2,
    userId: "user-a",
    sessionId: "session-a",
    identityKey: identityKey("user-a", "session-a"),
    householdId: null,
    retryable: true,
    message:
      "WoofWatcher could not confirm active household access. Retry after reviewing this account's household access.",
  });
  assert.equal(resolution.activeAccessLeaseDeadlineMonotonicMs(), null);
});

test("a cancelled helper-expiry callback cannot revoke replacement authority", () => {
  let monotonicNow = 1_000;
  const callbacks: Array<() => void> = [];
  const expiry = createCareHouseholdExpiryRevocation({
    monotonicNow: () => monotonicNow,
    setTimer(callback) {
      callbacks.push(callback);
      return callbacks.length;
    },
    clearTimer() {},
  });
  let revoked = "";
  expiry.arm({ observedAtMonotonicMs: 1_000, deadlineMonotonicMs: 2_000 }, () => {
    revoked = "old";
  });
  expiry.arm({ observedAtMonotonicMs: 1_000, deadlineMonotonicMs: 3_000 }, () => {
    revoked = "replacement";
  });

  monotonicNow = 2_000;
  callbacks[0]?.();
  assert.equal(revoked, "");
  monotonicNow = 3_000;
  callbacks[1]?.();
  assert.equal(revoked, "replacement");
});

test("a monotonic rollback during an armed lease revokes immediately instead of extending access", () => {
  let monotonicNow = 10_000;
  let callback: (() => void) | null = null;
  let revoked = 0;
  const expiry = createCareHouseholdExpiryRevocation({
    monotonicNow: () => monotonicNow,
    setTimer(next) {
      callback = next;
      return 1;
    },
    clearTimer() {},
  });
  expiry.arm({ observedAtMonotonicMs: 10_000, deadlineMonotonicMs: 20_000 }, () => {
    revoked += 1;
  });
  assert.ok(callback);
  monotonicNow = 9_999;
  callback();
  assert.equal(revoked, 1);
});

test("a monotonic rollback between admission and timer arming revokes without scheduling", () => {
  let callback: (() => void) | null = null;
  let revoked = 0;
  const expiry = createCareHouseholdExpiryRevocation({
    monotonicNow: () => 9_999,
    setTimer(next) {
      callback = next;
      return 1;
    },
    clearTimer() {},
  });
  expiry.arm(
    { observedAtMonotonicMs: 10_000, deadlineMonotonicMs: 20_000 },
    () => {
      revoked += 1;
    },
  );
  assert.equal(revoked, 1);
  assert.equal(callback, null);
});

test("malformed or contradictory runtime /api/me membership fails closed without throwing", () => {
  const resolution = createCareHouseholdIdentityResolution();
  resolution.observeAuth(signedIn("user-a", "session-a"));

  const malformedAttempt = resolution.captureAttempt();
  assert.ok(malformedAttempt);
  let malformedResult: ReturnType<typeof resolution.settleFreshMe> | undefined;
  assert.doesNotThrow(() => {
    malformedResult = resolution.settleFreshMe(malformedAttempt, {
      user: { id: "user-a" },
      household: { id: "household-a" },
      members: [null],
    } as never);
  });
  assert.equal(malformedResult?.householdId, null);
  assert.equal(malformedResult?.retryDelayMs, 400);

  const contradictoryAttempt = resolution.captureRetry(malformedResult!.retry!);
  assert.ok(contradictoryAttempt);
  const contradictory = resolution.settleFreshMe(contradictoryAttempt, {
    user: { id: "user-a" },
    household: { id: "household-a" },
    members: [
      { userId: "user-a", isSelf: true },
      { userId: "user-b", isSelf: true },
    ],
  });
  assert.equal(contradictory.householdId, null);
  assert.equal(contradictory.retryDelayMs, 1200);

  const exactAttempt = resolution.captureRetry(contradictory.retry!);
  assert.ok(exactAttempt);
  assert.equal(
    resolution.settleFreshMe(exactAttempt, freshMe("user-a", "household-a"))
      .householdId,
    "household-a",
  );
});

test("missing or whitespace household ids never become Care authority", () => {
  for (const householdId of [undefined, null, "", " household-a"] as const) {
    const resolution = createCareHouseholdIdentityResolution();
    resolution.observeAuth(signedIn("user-a", "session-a"));
    const attempt = resolution.captureAttempt();
    assert.ok(attempt);
    const result = resolution.settleFreshMe(attempt, {
      user: { id: "user-a" },
      household: { id: householdId },
      members: [{ userId: "user-a", isSelf: true }],
    });
    assert.equal(result.householdId, null);
    assert.equal(result.retryDelayMs, 400);
    assert.equal(resolution.snapshot().state, "pending");
  }
});

test("a direct A to B auth change synchronously revokes A attempts, retry tickets, errors, and resolution", () => {
  const resolution = createCareHouseholdIdentityResolution();
  resolution.observeAuth(signedIn("user-a", "session-a"));
  const activeA = resolution.captureAttempt();
  assert.ok(activeA);

  const b = resolution.observeAuth(signedIn("user-b", "session-b"));
  assert.equal(b.state, "pending");
  assert.equal(b.identityKey, identityKey("user-b", "session-b"));
  assert.equal(resolution.canContinue(activeA), false);
  assert.equal(
    resolution.settleFreshMe(activeA, freshMe("user-a", "household-a"))
      .accepted,
    false,
  );

  const bAttempt = resolution.captureAttempt();
  assert.ok(bAttempt);
  const bFailure = resolution.settleFailure(bAttempt, "offline");
  assert.ok(bFailure.retry);

  resolution.observeAuth(signedIn("user-c", "session-c"));
  assert.equal(resolution.captureRetry(bFailure.retry!), null);
  assert.equal(resolution.snapshot().message, null);
  assert.equal(resolution.snapshot().retryable, false);

  const cAttempt = resolution.captureAttempt();
  assert.ok(cAttempt);
  assert.equal(
    resolution.settleFreshMe(cAttempt, freshMe("user-c", "household-c"))
      .householdId,
    "household-c",
  );
  resolution.observeAuth(signedIn("user-d", "session-d"));
  assert.equal(resolution.snapshot().state, "pending");
  assert.equal(resolution.snapshot().householdId, null);

  let failure = failCurrentAttempt(resolution);
  let retryAttempt = resolution.captureRetry(failure.retry!);
  assert.ok(retryAttempt);
  failure = resolution.settleFailure(retryAttempt, "offline");
  retryAttempt = resolution.captureRetry(failure.retry!);
  assert.ok(retryAttempt);
  resolution.settleFailure(retryAttempt, "offline");
  assert.equal(resolution.snapshot().state, "error");
  assert.equal(resolution.snapshot().retryable, true);

  const e = resolution.observeAuth(signedIn("user-e", "session-e"));
  assert.equal(e.state, "pending");
  assert.equal(e.retryable, false);
  assert.equal(e.message, null);
  assert.equal(resolution.requestRetry(), false);
});

test("loading and signed-out transitions synchronously revoke stale work and expose only pending or local state", () => {
  const resolution = createCareHouseholdIdentityResolution();
  resolution.observeAuth(signedIn("user-a", "session-a"));
  const first = resolution.captureAttempt();
  assert.ok(first);
  const scheduled = resolution.settleFailure(first, "offline");
  assert.ok(scheduled.retry);

  const loadingSnapshot = resolution.observeAuth(loading);
  assert.equal(loadingSnapshot.state, "pending");
  assert.equal(loadingSnapshot.pendingFor, "auth");
  assert.equal(loadingSnapshot.userId, null);
  assert.equal(resolution.captureRetry(scheduled.retry!), null);

  const localSnapshot = resolution.observeAuth(signedOut);
  assert.equal(localSnapshot.state, "local");
  assert.equal(localSnapshot.householdId, null);
  assert.equal(resolution.requestRetry(), false);
});

test("a session replacement and ambiguous raw identifiers revoke an otherwise resolved household", () => {
  const resolution = createCareHouseholdIdentityResolution();
  resolution.observeAuth(signedIn("user-a", "session-1"));
  const first = resolution.captureAttempt();
  assert.ok(first);
  resolution.settleFreshMe(first, freshMe("user-a", "household-a"));

  const replacement = resolution.observeAuth(signedIn("user-a", "session-2"));
  assert.equal(replacement.state, "pending");
  assert.equal(replacement.pendingFor, "household");
  assert.equal(replacement.householdId, null);

  const replacementAttempt = resolution.captureAttempt();
  assert.ok(replacementAttempt);
  const ambiguous = resolution.observeAuth(signedIn(" user-a", "session-2"));
  assert.equal(ambiguous.state, "pending");
  assert.equal(ambiguous.pendingFor, "auth");
  assert.equal(ambiguous.identityKey, null);
  assert.equal(resolution.canContinue(replacementAttempt), false);
});

test("re-observing the exact same raw identity preserves its resolved household", () => {
  const resolution = createCareHouseholdIdentityResolution();
  const auth = signedIn("user-a", "session-a");
  resolution.observeAuth(auth);
  const attempt = resolution.captureAttempt();
  assert.ok(attempt);
  resolution.settleFreshMe(attempt, freshMe("user-a", "household-a"));
  const generation = resolution.snapshot().generation;

  const same = resolution.observeAuth(auth);
  assert.equal(same.state, "resolved");
  assert.equal(same.householdId, "household-a");
  assert.equal(same.generation, generation);
});

test("JSON tuple identity keys cannot collide across colon-containing Clerk ids", () => {
  const resolution = createCareHouseholdIdentityResolution();
  const first = resolution.observeAuth(signedIn("a:b", "c"));
  const firstAttempt = resolution.captureAttempt();
  assert.ok(firstAttempt);

  const second = resolution.observeAuth(signedIn("a", "b:c"));
  assert.notEqual(first.identityKey, second.identityKey);
  assert.equal(first.identityKey, '["a:b","c"]');
  assert.equal(second.identityKey, '["a","b:c"]');
  assert.equal(resolution.canContinue(firstAttempt), false);
});

test("foreign and stale retry tickets cannot authorize a request", () => {
  const first = createCareHouseholdIdentityResolution();
  const second = createCareHouseholdIdentityResolution();
  first.observeAuth(signedIn("user-a", "session-a"));
  second.observeAuth(signedIn("user-a", "session-a"));

  const attempt = first.captureAttempt();
  assert.ok(attempt);
  const failed = first.settleFailure(attempt, "offline");
  assert.ok(failed.retry);
  assert.equal(second.captureRetry(failed.retry!), null);

  const forged = Object.freeze({ ...failed.retry });
  assert.equal(
    first.captureRetry(forged as CareHouseholdIdentityResolutionRetry),
    null,
  );
  assert.ok(first.captureRetry(failed.retry!));
});

test("restartResolution revokes same-auth resolved, active, retry, and error authority for a 412 or 428", () => {
  const resolution = createCareHouseholdIdentityResolution();
  resolution.observeAuth(signedIn("user-a", "session-a"));
  const resolvedAttempt = resolution.captureAttempt();
  assert.ok(resolvedAttempt);
  resolution.settleFreshMe(resolvedAttempt, freshMe("user-a", "household-a"));
  const resolvedGeneration = resolution.snapshot().generation;

  assert.equal(resolution.restartResolution(), true);
  assert.deepEqual(resolution.snapshot(), {
    state: "pending",
    pendingFor: "household",
    generation: resolvedGeneration + 1,
    userId: "user-a",
    sessionId: "session-a",
    identityKey: identityKey("user-a", "session-a"),
    householdId: null,
    retryable: false,
    message: null,
  });

  const active = resolution.captureAttempt();
  assert.ok(active);
  assert.equal(resolution.restartResolution(), true);
  assert.equal(resolution.canContinue(active), false);
  assert.equal(
    resolution.settleFreshMe(active, freshMe("user-a", "household-a")).accepted,
    false,
  );

  const scheduledAttempt = resolution.captureAttempt();
  assert.ok(scheduledAttempt);
  const scheduled = resolution.settleFailure(scheduledAttempt, "offline");
  assert.ok(scheduled.retry);
  const scheduledGeneration = resolution.snapshot().generation;
  assert.equal(resolution.restartResolution(), true);
  assert.equal(resolution.snapshot().generation, scheduledGeneration + 1);
  assert.equal(resolution.captureRetry(scheduled.retry!), null);

  let failure = failCurrentAttempt(resolution);
  let retryAttempt = resolution.captureRetry(failure.retry!);
  assert.ok(retryAttempt);
  failure = resolution.settleFailure(retryAttempt, "offline");
  retryAttempt = resolution.captureRetry(failure.retry!);
  assert.ok(retryAttempt);
  resolution.settleFailure(retryAttempt, "offline");
  assert.equal(resolution.snapshot().state, "error");
  const errorGeneration = resolution.snapshot().generation;

  assert.equal(resolution.restartResolution(), true);
  assert.equal(resolution.snapshot().generation, errorGeneration + 1);
  assert.equal(resolution.snapshot().state, "pending");
  const resetBudgetAttempt = resolution.captureAttempt();
  assert.ok(resetBudgetAttempt);
  assert.equal(
    resolution.settleFailure(resetBudgetAttempt, "offline").retryDelayMs,
    400,
  );

  resolution.observeAuth(signedOut);
  assert.equal(resolution.restartResolution(), false);
  resolution.observeAuth(loading);
  assert.equal(resolution.restartResolution(), false);
});
