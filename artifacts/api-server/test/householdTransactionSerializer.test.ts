import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { canonicalHouseholdLockIds } from "../src/lib/household-transaction-serializer.ts";

const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";

function source(path: string): string {
  return readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
}

function indexBefore(text: string, first: RegExp, second: RegExp): void {
  const firstAt = text.search(first);
  const secondAt = text.search(second);
  assert.ok(firstAt >= 0, `missing ${first}`);
  assert.ok(secondAt >= 0, `missing ${second}`);
  assert.ok(firstAt < secondAt, `${first} must precede ${second}`);
}

test("every shipping household authority workflow enters the canonical serializer before row authority", () => {
  indexBefore(
    source("lib/household-active-identity.ts").slice(
      source("lib/household-active-identity.ts").indexOf(
        "export async function commitJoinedHouseholdActivation",
      ),
    ),
    /transaction\.lockHouseholds\(/,
    /transaction\.lockUser\(/,
  );
  indexBefore(
    source("lib/household-membership-activation.ts").slice(
      source("lib/household-membership-activation.ts").indexOf(
        "export async function activateRetainedHousehold",
      ),
    ),
    /transaction\.lockHouseholds\(/,
    /transaction\.lockUser\(/,
  );
  indexBefore(
    source("lib/household-invitation-create.ts").slice(
      source("lib/household-invitation-create.ts").indexOf(
        "export async function createHouseholdInvitationAtomically",
      ),
    ),
    /transaction\.lockHouseholds\(/,
    /transaction\.lockUser\(/,
  );
  indexBefore(
    source("lib/household-profile-update.ts").slice(
      source("lib/household-profile-update.ts").indexOf(
        "export async function updateHouseholdProfileAtomically",
      ),
    ),
    /transaction\.lockUserHouseholds\(/,
    /transaction\.lockUser\(/,
  );
  indexBefore(
    source("lib/household-profile-update.ts").slice(
      source("lib/household-profile-update.ts").indexOf(
        "export async function updateHouseholdProfileAtomically",
      ),
    ),
    /transaction\.lockUser\(/,
    /transaction\.confirmUserHouseholdsLocked\(/,
  );
  indexBefore(
    source("lib/household-profile-update.ts").slice(
      source("lib/household-profile-update.ts").indexOf(
        "export async function updateHouseholdProfileAtomically",
      ),
    ),
    /transaction\.confirmUserHouseholdsLocked\(/,
    /transaction\.lockActiveMembership\(/,
  );
  indexBefore(
    source("lib/household-me-snapshot.ts").slice(
      source("lib/household-me-snapshot.ts").indexOf(
        "export async function buildExactHouseholdSnapshot",
      ),
    ),
    /transaction\.lockHouseholds\(/,
    /transaction\.lockUser\(/,
  );
  indexBefore(
    source("lib/household-scoped-operation.ts").slice(
      source("lib/household-scoped-operation.ts").indexOf(
        "export async function runHouseholdScopedOperation",
      ),
    ),
    /transaction\.lockHouseholdMutation\(/,
    /transaction\.lockUser\(/,
  );
});

class DeferredHouseholdLocks {
  private tails = new Map<string, Promise<void>>();

  async run<T>(householdIds: readonly string[], work: () => Promise<T>) {
    const releases: Array<() => void> = [];
    for (const householdId of canonicalHouseholdLockIds(householdIds)) {
      const previous = this.tails.get(householdId) ?? Promise.resolve();
      let release = () => {};
      const tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      this.tails.set(householdId, previous.then(() => tail));
      await previous;
      releases.unshift(release);
    }
    try {
      return await work();
    } finally {
      for (const release of releases) release();
    }
  }
}

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("deadlock timeout")), 750);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

test("same-owner concurrent renames settle in serializer order with exact committed responses", async () => {
  const locks = new DeferredHouseholdLocks();
  let householdName = "Phoenix Pack";
  let releaseFirst = () => {};
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let markFirstEntered = () => {};
  const firstEntered = new Promise<void>((resolve) => {
    markFirstEntered = resolve;
  });
  let activeMutations = 0;
  let maximumActiveMutations = 0;

  const rename = (nextName: string, gate?: Promise<void>) =>
    locks.run([HOUSEHOLD_A], async () => {
      activeMutations += 1;
      maximumActiveMutations = Math.max(
        maximumActiveMutations,
        activeMutations,
      );
      if (gate) {
        markFirstEntered();
        await gate;
      }
      householdName = nextName;
      const exactResponse = { householdName };
      activeMutations -= 1;
      return exactResponse;
    });

  const first = rename("Trail Pack", firstGate);
  await firstEntered;
  const second = rename("Lake Pack");
  releaseFirst();

  assert.deepEqual(await withTimeout(Promise.all([first, second])), [
    { householdName: "Trail Pack" },
    { householdName: "Lake Pack" },
  ]);
  assert.equal(householdName, "Lake Pack");
  assert.equal(maximumActiveMutations, 1);
});

test("two owners concurrently targeting each other settle without stale policy authority", async () => {
  const locks = new DeferredHouseholdLocks();
  const roles = new Map([
    ["owner-a", "owner"],
    ["owner-b", "owner"],
  ]);
  let activeMutations = 0;
  let maximumActiveMutations = 0;

  const targetOwner = (actorId: string, targetId: string) =>
    locks.run([HOUSEHOLD_A], async () => {
      activeMutations += 1;
      maximumActiveMutations = Math.max(
        maximumActiveMutations,
        activeMutations,
      );
      const result =
        roles.get(actorId) === "owner" && roles.get(targetId) === "owner"
          ? "policy-denied"
          : "mutated";
      activeMutations -= 1;
      return result;
    });

  assert.deepEqual(
    await withTimeout(
      Promise.all([
        targetOwner("owner-a", "owner-b"),
        targetOwner("owner-b", "owner-a"),
      ]),
    ),
    ["policy-denied", "policy-denied"],
  );
  assert.deepEqual([...roles], [
    ["owner-a", "owner"],
    ["owner-b", "owner"],
  ]);
  assert.equal(maximumActiveMutations, 1);
});

test("helper update concurrent with revoke settles with truthful ordered snapshots", async () => {
  const locks = new DeferredHouseholdLocks();
  const helper = {
    active: true,
    expiresAt: "2026-08-30T12:00:00.000Z",
  };
  let releaseUpdate = () => {};
  const updateGate = new Promise<void>((resolve) => {
    releaseUpdate = resolve;
  });
  let markUpdateEntered = () => {};
  const updateEntered = new Promise<void>((resolve) => {
    markUpdateEntered = resolve;
  });

  const update = locks.run([HOUSEHOLD_A], async () => {
    markUpdateEntered();
    await updateGate;
    if (!helper.active) return { status: "not-found" as const };
    helper.expiresAt = "2026-09-01T12:00:00.000Z";
    return { status: "active" as const, expiresAt: helper.expiresAt };
  });
  await updateEntered;
  const revoke = locks.run([HOUSEHOLD_A], async () => {
    helper.active = false;
    return { status: "revoked" as const };
  });
  releaseUpdate();

  assert.deepEqual(await withTimeout(Promise.all([update, revoke])), [
    { status: "active", expiresAt: "2026-09-01T12:00:00.000Z" },
    { status: "revoked" },
  ]);
  assert.equal(helper.active, false);
});

test("management, profile, activation, and join contenders settle with linearizable revoked authority", async () => {
  const locks = new DeferredHouseholdLocks();
  const authority = {
    membershipActive: true,
    invitationApproved: true,
    activeHouseholdId: HOUSEHOLD_B,
  };
  const entered: string[] = [];

  let releaseManagement = () => {};
  const managementGate = new Promise<void>((resolve) => {
    releaseManagement = resolve;
  });
  let managementEntered = () => {};
  const managementStarted = new Promise<void>((resolve) => {
    managementEntered = resolve;
  });

  const management = locks.run([HOUSEHOLD_A], async () => {
    entered.push("management");
    managementEntered();
    await managementGate;
    authority.membershipActive = false;
    authority.invitationApproved = false;
    return "revoked";
  });
  await managementStarted;

  const profile = locks.run([HOUSEHOLD_A], async () => {
    entered.push("profile");
    return authority.membershipActive ? "updated" : "denied";
  });
  const activation = locks.run(
    [HOUSEHOLD_B, HOUSEHOLD_A],
    async () => {
      entered.push("activation");
      if (!authority.membershipActive) return "denied";
      authority.activeHouseholdId = HOUSEHOLD_A;
      return "activated";
    },
  );
  const join = locks.run([HOUSEHOLD_B, HOUSEHOLD_A], async () => {
    entered.push("join");
    return authority.invitationApproved ? "joined" : "denied";
  });

  releaseManagement();
  const results = await withTimeout(
    Promise.all([management, profile, activation, join]),
  );
  assert.deepEqual(results, ["revoked", "denied", "denied", "denied"]);
  assert.equal(entered[0], "management");
  assert.equal(authority.activeHouseholdId, HOUSEHOLD_B);
});

test("multi-household locks deduplicate and sort exact ids for every caller", () => {
  assert.deepEqual(
    canonicalHouseholdLockIds([
      HOUSEHOLD_B,
      HOUSEHOLD_A,
      HOUSEHOLD_B,
    ]),
    [HOUSEHOLD_A, HOUSEHOLD_B],
  );
});
