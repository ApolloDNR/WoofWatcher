import assert from "node:assert/strict";
import { test } from "node:test";

import {
  admitHouseholdMembershipList,
  buildHouseholdMembershipRows,
  createHouseholdMembershipRediscoveryController,
  describeHouseholdMembershipListFailure,
  renameHouseholdMembershipInList,
} from "./householdMembershipList.ts";
import type { HouseholdOperationPermit } from "./householdOperation.ts";

const PERMIT_A: HouseholdOperationPermit = Object.freeze({
  generation: 9,
  dataScope: 'care-v2:["user-a","household-a"]',
  userId: "user-a",
  sessionId: "session-a",
  householdId: "household-a",
  identityKey: '["user-a","session-a","household-a"]',
});

function response(activeHouseholdId = "household-a") {
  return {
    activeHouseholdId,
    memberships: [
      {
        householdId: "household-a",
        householdName: "Phoenix Pack",
        role: "owner",
        accessPassExpiresAt: null,
      },
      {
        householdId: "household-b",
        householdName: "Family Pack",
        role: "adult",
        accessPassExpiresAt: null,
      },
    ],
  };
}

test("membership results admit only exact current A authority and never retain source objects", () => {
  const source = response();
  const admitted = admitHouseholdMembershipList(source, PERMIT_A, () => true);
  assert.ok(admitted);
  assert.equal(admitted.activeMembershipPresent, true);
  assert.deepEqual(
    admitted.memberships.map((membership) => membership.householdId),
    ["household-a", "household-b"],
  );
  source.memberships[1]!.householdName = "mutated";
  assert.equal(admitted.memberships[1]?.householdName, "Family Pack");
  assert.ok(Object.isFrozen(admitted));
  assert.ok(Object.isFrozen(admitted.memberships));
});

test("stale permits and A responses after B admission render nothing", () => {
  assert.equal(admitHouseholdMembershipList(response(), PERMIT_A, () => false), null);
  assert.equal(
    admitHouseholdMembershipList(response("household-b"), PERMIT_A, () => true),
    null,
  );
});

test("an expired current source can truthfully offer retained valid households", () => {
  const admitted = admitHouseholdMembershipList(
    {
      activeHouseholdId: "household-a",
      memberships: [
        {
          householdId: "household-b",
          householdName: "Retained Pack",
          role: "owner",
          accessPassExpiresAt: null,
        },
      ],
    },
    PERMIT_A,
    () => true,
  );
  assert.ok(admitted);
  assert.equal(admitted.activeMembershipPresent, false);
  assert.equal(admitted.memberships[0]?.householdId, "household-b");
});

test("membership rediscovery is bounded across same-scope Care generations", () => {
  const controller = createHouseholdMembershipRediscoveryController();
  assert.equal(controller.request(PERMIT_A), true);
  assert.equal(controller.request(PERMIT_A), false);
  const nextGeneration = Object.freeze({ ...PERMIT_A, generation: 10 });
  assert.equal(controller.request(nextGeneration), false);

  controller.confirmHealthy(nextGeneration);
  assert.equal(controller.request(nextGeneration), true);

  const replacement = Object.freeze({
    ...nextGeneration,
    householdId: "household-b",
    identityKey: '["user-a","session-a","household-b"]',
  });
  assert.equal(controller.request(replacement), true);
});

test("a rename patches only an exactly admitted retained list", () => {
  const patched = renameHouseholdMembershipInList(
    response(),
    PERMIT_A,
    "Phoenix Home",
    () => true,
  );
  assert.ok(patched);
  assert.equal(patched.memberships[0]?.householdName, "Phoenix Home");
  assert.equal(patched.memberships[1]?.householdName, "Family Pack");
  assert.equal(Object.isFrozen(patched.memberships), true);
  assert.equal(
    renameHouseholdMembershipInList(
      response(),
      PERMIT_A,
      "Phoenix Home",
      () => false,
    ),
    null,
  );
});

test("membership row accessibility keeps Current inert and switch rows disabled with the shared operation", () => {
  const admitted = admitHouseholdMembershipList(response(), PERMIT_A, () => true);
  assert.ok(admitted);
  const idle = buildHouseholdMembershipRows(admitted, false);
  assert.deepEqual(
    idle.map(({ householdId, current, disabled, accessibilityLabel }) => ({
      householdId,
      current,
      disabled,
      accessibilityLabel,
    })),
    [
      {
        householdId: "household-a",
        current: true,
        disabled: true,
        accessibilityLabel: "Phoenix Pack, current household, Owner",
      },
      {
        householdId: "household-b",
        current: false,
        disabled: false,
        accessibilityLabel: "Switch to Family Pack household, Adult",
      },
    ],
  );
  const active = buildHouseholdMembershipRows(admitted, true);
  assert.equal(active.every((row) => row.disabled), true);
});

test("malformed, duplicate, or secret-bearing membership results fail closed", () => {
  for (const candidate of [
    { activeHouseholdId: " household-a", memberships: [] },
    { activeHouseholdId: "household-a", memberships: null },
    {
      ...response(),
      memberships: [...response().memberships, response().memberships[0]],
    },
    {
      ...response(),
      memberships: [
        { ...response().memberships[0], inviteCode: "SECRET" },
      ],
    },
    {
      ...response(),
      memberships: [
        { ...response().memberships[0], role: "unknown-admin" },
      ],
    },
  ]) {
    assert.equal(
      admitHouseholdMembershipList(candidate, PERMIT_A, () => true),
      null,
    );
  }
});

test("the exact server role set is accepted and vet viewer has truthful title copy", () => {
  for (const role of [
    "owner",
    "adult",
    "teen",
    "kid",
    "sitter",
    "trainer",
    "walker",
    "vet viewer",
  ]) {
    const temporary = ["sitter", "trainer", "walker", "vet viewer"].includes(
      role,
    );
    const admitted = admitHouseholdMembershipList(
      {
        activeHouseholdId: "household-a",
        memberships: [
          {
            ...response().memberships[0],
            role,
            accessPassExpiresAt: temporary
              ? "2099-01-01T00:00:00.000Z"
              : null,
          },
        ],
      },
      PERMIT_A,
      () => true,
    );
    assert.ok(admitted, role);
    const [row] = buildHouseholdMembershipRows(admitted, false);
    assert.equal(
      row?.roleLabel,
      role === "vet viewer"
        ? "Vet Viewer"
        : role.charAt(0).toUpperCase() + role.slice(1),
    );
  }
});

test("provider-authorized helper memberships preserve active null expiry", () => {
  for (const role of ["sitter", "trainer", "walker", "vet viewer"] as const) {
    const admitted = admitHouseholdMembershipList(
      {
        activeHouseholdId: "household-a",
        memberships: [
          {
            ...response().memberships[0],
            role,
            accessPassExpiresAt: null,
          },
        ],
      },
      PERMIT_A,
      () => true,
    );
    assert.ok(admitted, role);
    assert.deepEqual(admitted.memberships[0], {
      householdId: "household-a",
      householdName: "Phoenix Pack",
      role,
      accessPassExpiresAt: null,
    });
  }
});

test("provider-filtered helper memberships ignore fast and slow device wall clocks", () => {
  const originalDateNow = Date.now;
  try {
    for (const deviceNow of [
      "1901-01-01T00:00:00.000Z",
      "2201-01-01T00:00:00.000Z",
    ]) {
      Date.now = () => Date.parse(deviceNow);
      const admitted = admitHouseholdMembershipList(
        {
          activeHouseholdId: "household-a",
          memberships: [
            {
              ...response().memberships[0],
              role: "walker",
              accessPassExpiresAt: "2026-08-29T12:05:00.000Z",
            },
          ],
        },
        PERMIT_A,
        () => true,
      );
      assert.ok(admitted, deviceNow);
    }
  } finally {
    Date.now = originalDateNow;
  }
});

test("helper membership expiry remains structurally fail-closed", () => {
  for (const accessPassExpiresAt of [
    "not-a-date",
    "2026-08-29T12:05:00Z",
    " 2026-08-29T12:05:00.000Z",
  ]) {
    assert.equal(
      admitHouseholdMembershipList(
        {
          activeHouseholdId: "household-a",
          memberships: [
            {
              ...response().memberships[0],
              role: "sitter",
              accessPassExpiresAt,
            },
          ],
        },
        PERMIT_A,
        () => true,
      ),
      null,
      accessPassExpiresAt,
    );
  }
});

test("membership-list failure copy distinguishes access, precondition, and network truth", () => {
  const unauthorized = describeHouseholdMembershipListFailure(
    Object.assign(new Error("unauthorized"), { status: 401 }),
  );
  assert.match(unauthorized.message, /signed-in session/i);
  assert.equal(unauthorized.rediscoverIdentity, true);

  const forbidden = describeHouseholdMembershipListFailure(
    Object.assign(new Error("forbidden"), { status: 403 }),
  );
  assert.match(forbidden.message, /removed or expired/i);
  assert.equal(forbidden.rediscoverIdentity, true);

  for (const status of [409, 412, 428]) {
    const changed = describeHouseholdMembershipListFailure(
      Object.assign(new Error("changed"), { status }),
    );
    assert.match(changed.message, /rechecking/i);
    assert.equal(changed.rediscoverIdentity, true);
  }

  const network = describeHouseholdMembershipListFailure(
    new TypeError("offline"),
  );
  assert.match(network.message, /connection/i);
  assert.equal(network.rediscoverIdentity, false);
});
