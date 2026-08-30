import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createHouseholdOperationController,
  describeJoinHouseholdFailure,
  HOUSEHOLD_INVITATION_LIFETIME_MS,
  runHouseholdInviteOperation,
  runHouseholdJoinOperation,
  runHouseholdRenameOperation,
  runHouseholdSwitchOperation,
  type HouseholdOperationPermit,
} from "./householdOperation.ts";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const PERMIT_A: HouseholdOperationPermit = Object.freeze({
  generation: 4,
  dataScope: 'care-v2:["user-a","household-a"]',
  userId: "user-a",
  sessionId: "session-a",
  householdId: "household-a",
  identityKey: '["user-a","session-a","household-a"]',
});

test("the shared controller rejects button/return and B/C overlap synchronously", () => {
  const controller = createHouseholdOperationController();
  const first = controller.begin("join", PERMIT_A);
  assert.ok(first);
  assert.equal(controller.begin("join", PERMIT_A), null);
  assert.equal(controller.begin("rename", PERMIT_A), null);
  assert.equal(controller.begin("invite", PERMIT_A), null);
  assert.equal(controller.begin("switch", PERMIT_A), null);
  assert.equal(controller.getSnapshot().activeKind, "join");

  assert.equal(controller.complete(Object.freeze({ ...first }), null), false);
  assert.equal(controller.getSnapshot().activeKind, "join");
  assert.equal(controller.complete(first, null), true);

  const next = controller.begin("rename", PERMIT_A);
  assert.ok(next);
  assert.equal(controller.complete(next, null), true);
});

function approvedInvitation(
  inviteCode = "ONE-TIME-B",
  householdId = PERMIT_A.householdId,
  expiresAt = new Date(Date.now() + 5 * 60_000).toISOString(),
) {
  return {
    invitation: {
      id: "invitation-a",
      householdId,
      inviteCode,
      role: "adult",
      lifecycleState: "approved",
      runtimeLifecycleState: "approved",
      expired: false,
      createdByUserId: PERMIT_A.userId,
      approvedByUserId: PERMIT_A.userId,
      expiresAt,
      storage: "provider-durable",
    },
  };
}

function revokedInvitation(expiresAt: string) {
  return {
    invitation: {
      ...approvedInvitation("REDACTED", PERMIT_A.householdId, expiresAt)
        .invitation,
      lifecycleState: "revoked",
      runtimeLifecycleState: "revoked",
    },
  };
}

test("one shared lane single-flights invitation creation and shares only the approved returned code", async () => {
  const controller = createHouseholdOperationController();
  const response = deferred<unknown>();
  const shared: string[] = [];
  let createCalls = 0;

  const running = runHouseholdInviteOperation({
    controller,
    permit: PERMIT_A,
    isPermitCurrent: () => true,
    runTrackedTransport: async (start) => ({
      status: "complete",
      value: await start(() => true),
    }),
    createInvitation: async (expectedHouseholdId) => {
      createCalls += 1;
      assert.equal(expectedHouseholdId, PERMIT_A.householdId);
      return response.promise;
    },
    shareInvitation: async (inviteCode) => {
      shared.push(inviteCode);
      return true;
    },
    restartIdentityResolution() {
      assert.fail("a current approved invitation must not restart identity");
    },
  });

  const duplicate = await runHouseholdInviteOperation({
    controller,
    permit: PERMIT_A,
    isPermitCurrent: () => true,
    runTrackedTransport: async (start) => ({
      status: "complete",
      value: await start(() => true),
    }),
    createInvitation: async () => {
      createCalls += 1;
      return approvedInvitation("SHOULD-NOT-EXIST");
    },
    shareInvitation: async () => true,
    restartIdentityResolution() {},
  });

  assert.equal(duplicate.status, "busy");
  assert.equal(createCalls, 1);
  response.resolve(approvedInvitation());
  assert.equal((await running).status, "settled");
  assert.deepEqual(shared, ["ONE-TIME-B"]);
  assert.equal(controller.getSnapshot().notice, null);
  assert.doesNotMatch(JSON.stringify(controller.getSnapshot()), /ONE-TIME-B/);
});

test("an invitation is bounded and a dismissed share is confirmed revoked", async () => {
  const controller = createHouseholdOperationController();
  const now = Date.parse("2026-08-28T12:00:00.000Z");
  let requestedExpiry = "";
  const revoked: string[] = [];

  await runHouseholdInviteOperation({
    controller,
    permit: PERMIT_A,
    now: () => now,
    isPermitCurrent: () => true,
    runTrackedTransport: async (start) => ({
      status: "complete",
      value: await start(() => true),
    }),
    createInvitation: async (expectedHouseholdId, expiresAt) => {
      assert.equal(expectedHouseholdId, PERMIT_A.householdId);
      requestedExpiry = expiresAt;
      return approvedInvitation("DISMISSED-CODE", expectedHouseholdId, expiresAt);
    },
    shareInvitation: async () => "dismissed",
    revokeInvitation: async (invitationId, expectedHouseholdId) => {
      revoked.push(`${invitationId}:${expectedHouseholdId}`);
      return revokedInvitation(requestedExpiry);
    },
    restartIdentityResolution() {},
  });

  assert.equal(
    Date.parse(requestedExpiry) - now,
    HOUSEHOLD_INVITATION_LIFETIME_MS,
  );
  assert.deepEqual(revoked, ["invitation-a:household-a"]);
  assert.match(controller.getSnapshot().notice?.message ?? "", /revoked|cancelled/i);
  assert.doesNotMatch(
    JSON.stringify(controller.getSnapshot()),
    /DISMISSED-CODE/,
  );
});

test("failed invitation cleanup stays truthful about the bounded live credential", async () => {
  const controller = createHouseholdOperationController();
  await runHouseholdInviteOperation({
    controller,
    permit: PERMIT_A,
    isPermitCurrent: () => true,
    runTrackedTransport: async (start) => ({
      status: "complete",
      value: await start(() => true),
    }),
    createInvitation: async (_expectedHouseholdId, expiresAt) =>
      approvedInvitation("MAY-STILL-LIVE", PERMIT_A.householdId, expiresAt),
    shareInvitation: async () => "failed",
    revokeInvitation: async () => {
      throw new Error("cleanup unavailable");
    },
    restartIdentityResolution() {},
  });
  const notice = controller.getSnapshot().notice;
  assert.ok(notice);
  assert.match(notice.message, /may still be active/i);
  assert.match(notice.message, /expire/i);
  assert.doesNotMatch(JSON.stringify(notice), /MAY-STILL-LIVE/);
});

test("authority revoked while the share sheet waits never reports success or leaves an unbounded claim", async () => {
  const controller = createHouseholdOperationController();
  const shareStarted = deferred();
  const share = deferred<"shared">();
  const now = Date.parse("2026-08-29T12:00:00.000Z");
  let identityCurrent = true;
  let rediscovery = 0;
  let revokeCalls = 0;

  const running = runHouseholdInviteOperation({
    controller,
    permit: PERMIT_A,
    now: () => now,
    isPermitCurrent: () => identityCurrent,
    runTrackedTransport: async (start) => ({
      status: "complete",
      value: await start(() => true),
    }),
    createInvitation: async (expectedHouseholdId, expiresAt) =>
      approvedInvitation("SHARED-WHILE-STALE", expectedHouseholdId, expiresAt),
    shareInvitation: async () => {
      shareStarted.resolve();
      return share.promise;
    },
    revokeInvitation: async () => {
      revokeCalls += 1;
      return revokedInvitation(new Date(now + 60_000).toISOString());
    },
    restartIdentityResolution() {
      rediscovery += 1;
    },
  });

  await shareStarted.promise;
  identityCurrent = false;
  share.resolve("shared");
  await running;

  assert.equal(revokeCalls, 0, "stale authority must not start cleanup I/O");
  assert.equal(rediscovery, 1);
  const notice = controller.getSnapshot().notice;
  assert.ok(notice);
  assert.match(notice.message, /may have been shared/i);
  assert.match(notice.message, /may still be active/i);
  assert.match(notice.message, /expire/i);
  assert.doesNotMatch(JSON.stringify(notice), /SHARED-WHILE-STALE/);
});

test("an invitation that expires while sharing never reports an active success", async () => {
  const controller = createHouseholdOperationController();
  const shareStarted = deferred();
  const share = deferred<"shared">();
  let now = Date.parse("2026-08-29T12:00:00.000Z");
  let revokeCalls = 0;

  const running = runHouseholdInviteOperation({
    controller,
    permit: PERMIT_A,
    now: () => now,
    isPermitCurrent: () => true,
    runTrackedTransport: async (start) => ({
      status: "complete",
      value: await start(() => true),
    }),
    createInvitation: async (expectedHouseholdId, expiresAt) =>
      approvedInvitation("EXPIRES-IN-SHARE", expectedHouseholdId, expiresAt),
    shareInvitation: async () => {
      shareStarted.resolve();
      return share.promise;
    },
    revokeInvitation: async () => {
      revokeCalls += 1;
      return {};
    },
    restartIdentityResolution() {},
  });

  await shareStarted.promise;
  now += HOUSEHOLD_INVITATION_LIFETIME_MS;
  share.resolve("shared");
  await running;

  assert.equal(revokeCalls, 0);
  const notice = controller.getSnapshot().notice;
  assert.ok(notice);
  assert.match(notice.title, /expired/i);
  assert.match(notice.message, /can no longer be used/i);
  assert.doesNotMatch(JSON.stringify(notice), /EXPIRES-IN-SHARE/);
});

test("a stale or reset-revoked invitation response is never shared", async () => {
  for (const staleKind of ["identity", "reset"] as const) {
    const controller = createHouseholdOperationController();
    const response = deferred<unknown>();
    const shared: string[] = [];
    let identityCurrent = true;
    let resetCurrent = true;
    let rediscovery = 0;

    const running = runHouseholdInviteOperation({
      controller,
      permit: PERMIT_A,
      isPermitCurrent: () => identityCurrent,
      runTrackedTransport: async (start) => ({
        status: resetCurrent ? "complete" : "revoked",
        ...(resetCurrent
          ? { value: await start(() => resetCurrent) }
          : {}),
      }),
      createInvitation: async () => response.promise,
      shareInvitation: async (inviteCode) => {
        shared.push(inviteCode);
        return true;
      },
      restartIdentityResolution() {
        rediscovery += 1;
      },
    });

    await Promise.resolve();
    if (staleKind === "identity") identityCurrent = false;
    else resetCurrent = false;
    response.resolve(approvedInvitation(`STALE-${staleKind}`));
    await running;

    assert.deepEqual(shared, [], `${staleKind} stale code was shared`);
    assert.equal(rediscovery, staleKind === "identity" ? 1 : 0);
    assert.doesNotMatch(
      JSON.stringify(controller.getSnapshot()),
      new RegExp(`STALE-${staleKind}`),
    );
  }
});

test("invitation authority failures rediscover and malformed responses never expose a code", async () => {
  for (const failure of [
    Object.assign(new Error("precondition"), { status: 412 }),
    Object.assign(new Error("capability required"), { status: 428 }),
    approvedInvitation("WRONG-HOUSEHOLD", "household-c"),
    {
      invitation: {
        ...approvedInvitation("PENDING").invitation,
        lifecycleState: "pending-approval",
        runtimeLifecycleState: "pending-approval",
      },
    },
    {
      invitation: {
        ...approvedInvitation("WRONG-CREATOR").invitation,
        createdByUserId: "user-b",
      },
    },
    {
      invitation: {
        ...approvedInvitation("WRONG-ROLE").invitation,
        role: "owner",
      },
    },
    approvedInvitation(
      "UNBOUNDED-EXPIRY",
      PERMIT_A.householdId,
      "2099-01-01T00:00:00.000Z",
    ),
  ]) {
    const controller = createHouseholdOperationController();
    const shared: string[] = [];
    let rediscovery = 0;

    await runHouseholdInviteOperation({
      controller,
      permit: PERMIT_A,
      isPermitCurrent: () => true,
      runTrackedTransport: async (start) => ({
        status: "complete",
        value: await start(() => true),
      }),
      createInvitation: async () => {
        if (failure instanceof Error) throw failure;
        return failure;
      },
      shareInvitation: async (inviteCode) => {
        shared.push(inviteCode);
        return true;
      },
      restartIdentityResolution() {
        rediscovery += 1;
      },
    });

    assert.deepEqual(shared, []);
    assert.equal(rediscovery, 1);
    assert.match(
      controller.getSnapshot().notice?.message ?? "",
      /no code was shared|changed/i,
    );
  }
});

test("invitation transport and share failures use truthful copy without retaining credentials", async () => {
  for (const scenario of ["network", "forbidden", "share"] as const) {
    const controller = createHouseholdOperationController();
    let shareCalls = 0;

    await runHouseholdInviteOperation({
      controller,
      permit: PERMIT_A,
      isPermitCurrent: () => true,
      runTrackedTransport: async (start) => ({
        status: "complete",
        value: await start(() => true),
      }),
      createInvitation: async () => {
        if (scenario === "network") throw new TypeError("offline");
        if (scenario === "forbidden") {
          throw Object.assign(new Error("forbidden"), { status: 403 });
        }
        return approvedInvitation("NOT-RETAINED");
      },
      shareInvitation: async () => {
        shareCalls += 1;
        return false;
      },
      restartIdentityResolution() {},
    });

    const notice = controller.getSnapshot().notice;
    assert.ok(notice);
    assert.equal(shareCalls, scenario === "share" ? 1 : 0);
    assert.doesNotMatch(notice.message, /code.*match|invalid code/i);
    assert.doesNotMatch(JSON.stringify(notice), /NOT-RETAINED/);
    if (scenario === "forbidden") assert.match(notice.message, /owner/i);
    if (scenario === "share") {
      assert.match(notice.message, /may still be active/i);
      assert.match(notice.message, /expire/i);
    }
  }
});

test("Join closes A observers/queries before tracked transport and holds Care suspension through settlement", async () => {
  const controller = createHouseholdOperationController();
  const observerAck = deferred();
  const events: string[] = [];
  let resolverAllowed = true;
  const careToken = Object.freeze({ token: "care-a" });
  let joinCalls = 0;

  const running = runHouseholdJoinOperation({
    controller,
    permit: PERMIT_A,
    inviteCode: "JOIN-B",
    beginCareTransition() {
      events.push("care-suspended");
      resolverAllowed = false;
      return careToken;
    },
    prepareQueryTransition() {
      events.push("query-blocked-sync");
      return observerAck.promise.then(() => {
        events.push("observer-hidden");
        events.push("cancel-a");
        events.push("drain-a");
        events.push("cancel-a-again");
        events.push("clear-a");
      });
    },
    runTrackedTransport: async (transport) => {
      events.push("tracked-admitted");
      return { status: "complete", value: await transport() };
    },
    joinTransport: async (code, expectedHouseholdId) => {
      joinCalls += 1;
      events.push(`join:${code}:${expectedHouseholdId}`);
      assert.equal(resolverAllowed, false);
      return { household: { id: "household-b" } };
    },
    resumeCareTransition(token) {
      assert.equal(token, careToken);
      events.push("care-resumed");
      resolverAllowed = true;
      return true;
    },
  });

  assert.deepEqual(events, ["care-suspended", "query-blocked-sync"]);
  assert.equal(joinCalls, 0);
  const duplicate = await runHouseholdJoinOperation({
    controller,
    permit: PERMIT_A,
    inviteCode: "JOIN-C",
    beginCareTransition: () => careToken,
    prepareQueryTransition: async () => {},
    runTrackedTransport: async (transport) => ({
      status: "complete",
      value: await transport(),
    }),
    joinTransport: async () => {
      joinCalls += 1;
      return {};
    },
    resumeCareTransition: () => true,
  });
  assert.equal(duplicate.status, "busy");
  assert.equal(joinCalls, 0);

  observerAck.resolve();
  const result = await running;
  assert.equal(result.status, "settled");
  assert.equal(joinCalls, 1);
  assert.deepEqual(events, [
    "care-suspended",
    "query-blocked-sync",
    "observer-hidden",
    "cancel-a",
    "drain-a",
    "cancel-a-again",
    "clear-a",
    "tracked-admitted",
    "join:JOIN-B:household-a",
    "care-resumed",
  ]);
});

test("Switch closes A before tracked activation, ignores its response, and resumes only after settlement", async () => {
  const controller = createHouseholdOperationController();
  const observerAck = deferred();
  const activation = deferred<unknown>();
  const events: string[] = [];
  const careToken = Object.freeze({ transition: "switch-a" });
  let activationCalls = 0;

  const running = runHouseholdSwitchOperation({
    controller,
    permit: PERMIT_A,
    targetHouseholdId: "household-b",
    beginCareTransition() {
      events.push("care-suspended");
      return careToken;
    },
    prepareQueryTransition(identityKey) {
      assert.equal(identityKey, PERMIT_A.identityKey);
      events.push("query-blocked-sync");
      return observerAck.promise.then(() => {
        events.push("observer-hidden");
        events.push("cancel-drain-clear-a");
      });
    },
    runTrackedTransport: async (start) => {
      events.push("tracked-admitted");
      return { status: "complete", value: await start() };
    },
    activateTransport: async (targetHouseholdId, expectedSourceHouseholdId) => {
      activationCalls += 1;
      events.push(`activate:${expectedSourceHouseholdId}->${targetHouseholdId}`);
      return activation.promise;
    },
    resumeCareTransition(token) {
      assert.equal(token, careToken);
      events.push("care-resumed-for-fresh-me");
      return true;
    },
  });

  assert.deepEqual(events, ["care-suspended", "query-blocked-sync"]);
  assert.equal(activationCalls, 0);
  const duplicate = await runHouseholdSwitchOperation({
    controller,
    permit: PERMIT_A,
    targetHouseholdId: "household-c",
    beginCareTransition: () => careToken,
    prepareQueryTransition: async () => {},
    runTrackedTransport: async (start) => ({
      status: "complete",
      value: await start(),
    }),
    activateTransport: async () => {
      activationCalls += 1;
      return {};
    },
    resumeCareTransition: () => true,
  });
  assert.equal(duplicate.status, "busy");
  assert.equal(activationCalls, 0);

  observerAck.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(activationCalls, 1);
  assert.doesNotMatch(JSON.stringify(controller.getSnapshot()), /household-b/);
  activation.resolve({
    household: { id: "household-c", name: "must never render" },
  });
  assert.equal((await running).status, "settled");
  assert.deepEqual(events, [
    "care-suspended",
    "query-blocked-sync",
    "observer-hidden",
    "cancel-drain-clear-a",
    "tracked-admitted",
    "activate:household-a->household-b",
    "care-resumed-for-fresh-me",
  ]);
  assert.doesNotMatch(
    JSON.stringify(controller.getSnapshot()),
    /must never render|household-b|household-c/,
  );
});

test("ambiguous and access-denied Switch settlements stay shielded through transport and rediscover truthfully", async () => {
  for (const failure of [
    Object.assign(new Error("signed-out"), { status: 401 }),
    Object.assign(new Error("expired"), { status: 403 }),
    Object.assign(new Error("source changed"), { status: 412 }),
    Object.assign(new Error("capability missing"), { status: 428 }),
    new TypeError("network lost after request"),
  ]) {
    const controller = createHouseholdOperationController();
    const transport = deferred<unknown>();
    const careToken = Object.freeze({});
    let resumeCalls = 0;

    const running = runHouseholdSwitchOperation({
      controller,
      permit: PERMIT_A,
      targetHouseholdId: "household-b",
      beginCareTransition: () => careToken,
      prepareQueryTransition: async () => {},
      runTrackedTransport: async (start) => ({
        status: "complete",
        value: await start(),
      }),
      activateTransport: async () => transport.promise,
      resumeCareTransition(token) {
        assert.equal(token, careToken);
        resumeCalls += 1;
        return true;
      },
    });
    await Promise.resolve();
    assert.equal(resumeCalls, 0);
    transport.reject(failure);
    await running;
    assert.equal(resumeCalls, 1);
    const notice = controller.getSnapshot().notice;
    assert.ok(notice);
    if (Reflect.get(failure, "status") === 401) {
      assert.match(notice.message, /signed-in session/i);
    } else if (Reflect.get(failure, "status") === 403) {
      assert.match(notice.message, /removed or expired/i);
    } else {
      assert.match(notice.message, /rechecked/i);
    }
  }
});

test("an ambiguous Join failure stays suspended until the transport settles, then forces rediscovery", async () => {
  const controller = createHouseholdOperationController();
  const transport = deferred<unknown>();
  const events: string[] = [];
  const careToken = Object.freeze({ id: 1 });
  let resolverAllowed = true;

  const running = runHouseholdJoinOperation({
    controller,
    permit: PERMIT_A,
    inviteCode: "JOIN-B",
    beginCareTransition() {
      resolverAllowed = false;
      events.push("suspend");
      return careToken;
    },
    prepareQueryTransition: async () => {
      events.push("clear-a");
    },
    runTrackedTransport: async (start) => ({
      status: "complete",
      value: await start(),
    }),
    joinTransport: async () => transport.promise,
    resumeCareTransition(token) {
      assert.equal(token, careToken);
      assert.equal(resolverAllowed, false);
      events.push("rediscover");
      resolverAllowed = true;
      return true;
    },
  });

  await Promise.resolve();
  assert.equal(resolverAllowed, false);
  transport.reject(new TypeError("network connection lost"));
  const result = await running;
  assert.equal(result.status, "settled");
  assert.deepEqual(events, ["suspend", "clear-a", "rediscover"]);
  assert.equal(resolverAllowed, true);
  assert.match(
    controller.getSnapshot().notice?.message ?? "",
    /could not be confirmed/i,
  );
});

test("rename sends exact A authority, rejects overlap, and rediscovers after 412", async () => {
  const controller = createHouseholdOperationController();
  const renameTransport = deferred<unknown>();
  const events: string[] = [];
  let calls = 0;

  const running = runHouseholdRenameOperation({
    controller,
    permit: PERMIT_A,
    name: "Phoenix Team",
    isPermitCurrent: () => true,
    runTrackedTransport: async (start) => ({
      status: "complete",
      value: await start(),
    }),
    renameTransport: async (name, expectedHouseholdId) => {
      calls += 1;
      events.push(`${name}:${expectedHouseholdId}`);
      return renameTransport.promise;
    },
    restartIdentityResolution() {
      events.push("rediscover");
    },
  });
  const overlap = await runHouseholdJoinOperation({
    controller,
    permit: PERMIT_A,
    inviteCode: "JOIN-C",
    beginCareTransition: () => Object.freeze({}),
    prepareQueryTransition: async () => {},
    runTrackedTransport: async (start) => ({
      status: "complete",
      value: await start(),
    }),
    joinTransport: async () => {
      calls += 1;
      return {};
    },
    resumeCareTransition: () => true,
  });
  assert.equal(overlap.status, "busy");
  assert.equal(calls, 1);

  renameTransport.reject(Object.assign(new Error("precondition"), { status: 412 }));
  await running;
  assert.deepEqual(events, ["Phoenix Team:household-a", "rediscover"]);
  assert.match(controller.getSnapshot().notice?.message ?? "", /changed/i);
});

test("Rename admits only an exact user, household, and self-membership response", async () => {
  for (const response of [
    {
      user: { id: "user-b" },
      household: { id: "household-a", name: "Wrong user" },
      members: [
        {
          userId: "user-b",
          isSelf: true,
          role: "owner",
          accessPassExpiresAt: null,
          accessPassExpired: false,
        },
      ],
    },
    {
      user: { id: "user-a" },
      household: { id: "household-a", name: "Ambiguous self" },
      members: [
        {
          userId: "user-a",
          isSelf: true,
          role: "owner",
          accessPassExpiresAt: null,
          accessPassExpired: false,
        },
        {
          userId: "user-b",
          isSelf: true,
          role: "adult",
          accessPassExpiresAt: null,
          accessPassExpired: false,
        },
      ],
    },
  ]) {
    const controller = createHouseholdOperationController();
    let accepted = 0;
    let rediscovery = 0;
    await runHouseholdRenameOperation({
      controller,
      permit: PERMIT_A,
      name: "Phoenix Home",
      isPermitCurrent: () => true,
      runTrackedTransport: async (start) => ({
        status: "complete",
        value: await start(),
      }),
      renameTransport: async () => response,
      restartIdentityResolution() {
        rediscovery += 1;
      },
      acceptResponse() {
        accepted += 1;
      },
    });
    assert.equal(accepted, 0);
    assert.equal(rediscovery, 1);
  }
});

test("Rename admits the exact current self response and nothing synthesized", async () => {
  const controller = createHouseholdOperationController();
  const response = {
    authorityObservedAt: "2026-08-29T12:00:00.000Z",
    user: { id: "user-a" },
    household: { id: "household-a", name: "Phoenix Home" },
    members: [
      {
        userId: "user-a",
        isSelf: true,
        role: "owner",
        accessPassExpiresAt: null,
        accessPassExpired: false,
      },
    ],
  };
  let accepted: unknown = null;
  await runHouseholdRenameOperation({
    controller,
    permit: PERMIT_A,
    name: "Phoenix Home",
    isPermitCurrent: () => true,
    runTrackedTransport: async (start) => ({
      status: "complete",
      value: await start(),
    }),
    renameTransport: async () => response,
    restartIdentityResolution() {
      assert.fail("exact authority must not force rediscovery");
    },
    acceptResponse(value) {
      accepted = value;
    },
  });
  assert.equal(accepted, response);
  assert.equal(controller.getSnapshot().notice, null);
});

test("Rename and Invite treat 401/403 as stale authority and use truthful copy", async () => {
  for (const status of [401, 403] as const) {
    const renameController = createHouseholdOperationController();
    let renameRediscovery = 0;
    await runHouseholdRenameOperation({
      controller: renameController,
      permit: PERMIT_A,
      name: "Phoenix Home",
      isPermitCurrent: () => true,
      runTrackedTransport: async (start) => ({
        status: "complete",
        value: await start(),
      }),
      renameTransport: async () => {
        throw Object.assign(new Error("authority changed"), { status });
      },
      restartIdentityResolution() {
        renameRediscovery += 1;
      },
    });
    assert.equal(renameRediscovery, 1);
    assert.match(
      renameController.getSnapshot().notice?.message ?? "",
      status === 401 ? /sign-in|session/i : /owner|not allowed/i,
    );

    const inviteController = createHouseholdOperationController();
    let inviteRediscovery = 0;
    await runHouseholdInviteOperation({
      controller: inviteController,
      permit: PERMIT_A,
      isPermitCurrent: () => true,
      runTrackedTransport: async (start) => ({
        status: "complete",
        value: await start(() => true),
      }),
      createInvitation: async () => {
        throw Object.assign(new Error("authority changed"), { status });
      },
      shareInvitation: async () => "shared",
      restartIdentityResolution() {
        inviteRediscovery += 1;
      },
    });
    assert.equal(inviteRediscovery, 1);
    assert.match(
      inviteController.getSnapshot().notice?.message ?? "",
      status === 401 ? /sign-in|session/i : /owner/i,
    );
  }
});

test("Join failure copy is status-aware and never blames an invite code for unrelated failures", () => {
  const invalid = describeJoinHouseholdFailure(
    Object.assign(new Error("bad request"), { status: 400 }),
  );
  assert.match(invalid.message, /invite code/i);

  for (const status of [403, 409, 412, 428, 500]) {
    const notice = describeJoinHouseholdFailure(
      Object.assign(new Error(`HTTP ${status}`), { status }),
    );
    assert.doesNotMatch(notice.message, /didn't match|did not match/i);
  }
  assert.match(
    describeJoinHouseholdFailure(new TypeError("offline")).message,
    /could not be confirmed/i,
  );
  assert.match(
    describeJoinHouseholdFailure(
      Object.assign(new Error("signed out"), { status: 401 }),
    ).message,
    /sign-in|session/i,
  );
});
