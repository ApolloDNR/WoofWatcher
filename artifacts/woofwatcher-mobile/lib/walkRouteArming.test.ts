import assert from "node:assert/strict";
import test from "node:test";

import {
  armWalkRouteCapture,
  clearWalkRouteCaptureArming,
  findWalkSessionForArming,
  findLocallyArmedWalkSession,
  getWalkRouteCaptureArming,
  walkRouteSessionKey,
  type WalkRouteArmingEntry,
} from "./walkRouteArming.ts";

const MEMBER_A_START = "2026-07-24T14:00:00.000Z";
const MEMBER_B_START = "2026-07-24T14:05:00.000Z";

function walk(
  overrides: Partial<WalkRouteArmingEntry> = {},
): WalkRouteArmingEntry {
  return {
    id: "walk-b",
    type: "walk",
    occurredAt: MEMBER_B_START,
    caregiverUserId: "member-b",
    details: {
      householdVisible: true,
      walkLifecycle: "in-progress",
      walkStartedAt: MEMBER_B_START,
    },
    ...overrides,
  };
}

test.afterEach(() => clearWalkRouteCaptureArming());

test("a synced member-A walk cannot arm or start member-B route capture", () => {
  const syncedMemberAWalk = walk({
    id: "walk-a",
    occurredAt: MEMBER_A_START,
    caregiverUserId: "member-a",
    details: {
      householdVisible: true,
      walkLifecycle: "in-progress",
      walkStartedAt: MEMBER_A_START,
    },
  });

  assert.equal(getWalkRouteCaptureArming(), null);
  assert.equal(
    findLocallyArmedWalkSession([syncedMemberAWalk], {
      lifecycle: "in-progress",
      isSignedIn: true,
      userId: "member-b",
    }),
    null,
  );
  assert.equal(getWalkRouteCaptureArming(), null);
});

test("a locally armed member-B walk can start and attach to its completion", () => {
  const openWalk = walk();
  const sessionKey = walkRouteSessionKey(openWalk);
  assert.equal(sessionKey, MEMBER_B_START);
  armWalkRouteCapture(sessionKey);

  assert.equal(
    findLocallyArmedWalkSession([openWalk], {
      lifecycle: "in-progress",
      isSignedIn: true,
      userId: "member-b",
    })?.id,
    "walk-b",
  );

  const completedWalk = walk({
    details: {
      householdVisible: true,
      walkLifecycle: "completed",
      walkStartedAt: MEMBER_B_START,
    },
  });
  assert.equal(
    findLocallyArmedWalkSession([completedWalk], {
      lifecycle: "completed",
      isSignedIn: true,
      userId: "member-b",
    })?.id,
    "walk-b",
  );
});

test("an arming token for one session cannot attach to another", () => {
  armWalkRouteCapture(MEMBER_A_START);

  assert.equal(
    findLocallyArmedWalkSession(
      [
        walk({
          details: {
            householdVisible: true,
            walkLifecycle: "completed",
            walkStartedAt: MEMBER_B_START,
          },
        }),
      ],
      {
        lifecycle: "completed",
        isSignedIn: true,
        userId: "member-b",
      },
    ),
    null,
  );
});

test("a pending old-session route cannot roll over to a newly armed completed walk", () => {
  const oldPendingArming = { sessionKey: MEMBER_A_START };
  armWalkRouteCapture(MEMBER_B_START);
  const newlyCompletedWalk = walk({
    id: "walk-b-completed",
    details: {
      householdVisible: true,
      walkLifecycle: "completed",
      walkStartedAt: MEMBER_B_START,
    },
  });

  assert.equal(
    findWalkSessionForArming(
      [newlyCompletedWalk],
      oldPendingArming,
      {
        lifecycle: "completed",
        isSignedIn: true,
        userId: "member-b",
      },
    ),
    null,
  );
});

test("authenticated ownership mismatch fails closed even with a matching token", () => {
  armWalkRouteCapture(MEMBER_B_START);

  assert.equal(
    findLocallyArmedWalkSession(
      [walk({ caregiverUserId: "member-a" })],
      {
        lifecycle: "in-progress",
        isSignedIn: true,
        userId: "member-b",
      },
    ),
    null,
  );
});

test("local preview can capture a locally started walk without an authenticated owner", () => {
  const previewWalk = walk({ caregiverUserId: undefined });
  armWalkRouteCapture(MEMBER_B_START);

  assert.equal(
    findLocallyArmedWalkSession([previewWalk], {
      lifecycle: "in-progress",
      isSignedIn: false,
      userId: null,
    })?.id,
    "walk-b",
  );
});
