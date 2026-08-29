import assert from "node:assert/strict";
import { test } from "node:test";

import { HouseholdAuthoritySnapshotError } from "../src/lib/household-me-snapshot.ts";
import {
  updateHouseholdProfileAtomically,
  type HouseholdProfileUpdateStore,
} from "../src/lib/household-profile-update.ts";

const USER_ID = "user_profile";
const HOUSEHOLD_ID = "11111111-1111-4111-8111-111111111111";
const JOINED_HOUSEHOLD_ID = "22222222-2222-4222-8222-222222222222";
const MEMBER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = new Date("2026-08-29T12:00:00.000Z");

type State = { userName: string; memberName: string };

class ProfileStore implements HouseholdProfileUpdateStore {
  state: State = { userName: "Before", memberName: "Before" };
  events: string[] = [];
  failMembershipUpdate = false;
  failSnapshot = false;
  role = "owner";
  accessPassExpiresAt: Date | null = null;
  membershipHouseholdIds = [HOUSEHOLD_ID];
  joinCommitsWhileWaitingForUserLock = false;
  removeMembershipWhileWaitingForUserLock = false;

  async transaction<T>(
    work: Parameters<HouseholdProfileUpdateStore["transaction"]>[0],
  ): Promise<T> {
    const draft = { ...this.state };
    let lockedHouseholdIds: readonly string[] = [];
    this.events.push("transaction:begin");
    try {
      const result = await work({
        lockUserHouseholds: async () => {
          this.events.push("serialize-households");
          lockedHouseholdIds = [...this.membershipHouseholdIds];
          return lockedHouseholdIds;
        },
        lockUser: async () => {
          this.events.push("lock-user");
          if (this.joinCommitsWhileWaitingForUserLock) {
            this.joinCommitsWhileWaitingForUserLock = false;
            this.membershipHouseholdIds.push(JOINED_HOUSEHOLD_ID);
          }
          if (this.removeMembershipWhileWaitingForUserLock) {
            this.removeMembershipWhileWaitingForUserLock = false;
            this.membershipHouseholdIds = this.membershipHouseholdIds.filter(
              (id) => id !== JOINED_HOUSEHOLD_ID,
            );
          }
          return { id: USER_ID, activeHouseholdId: HOUSEHOLD_ID };
        },
        confirmUserHouseholdsLocked: async (_userId, expectedLockedIds) => {
          this.events.push("confirm-households");
          assert.deepEqual(expectedLockedIds, lockedHouseholdIds);
          const locked = new Set(expectedLockedIds);
          return this.membershipHouseholdIds.every((id) => locked.has(id));
        },
        lockActiveMembership: async () => {
          this.events.push("lock-membership");
          return {
            id: MEMBER_ID,
            userId: USER_ID,
            householdId: HOUSEHOLD_ID,
            role: this.role,
            accessPassExpiresAt: this.accessPassExpiresAt,
          };
        },
        getCurrentTime: async () => {
          this.events.push("clock");
          return NOW;
        },
        updateUserDisplayName: async (_userId, displayName) => {
          this.events.push("update-user");
          draft.userName = displayName;
          return true;
        },
        updateMembershipDisplayNames: async (
          _userId,
          _membershipId,
          displayName,
        ) => {
          this.events.push("update-memberships");
          if (this.failMembershipUpdate) return false;
          draft.memberName = displayName;
          return true;
        },
        buildExactMeSnapshot: async () => {
          this.events.push("exact-me");
          if (this.failSnapshot) throw new Error("snapshot failed");
          return {
            authorityObservedAt: NOW.toISOString(),
            user: {
              id: USER_ID,
              email: null,
              displayName: draft.userName,
            },
            household: { id: HOUSEHOLD_ID, name: "Pack", inviteCode: "" },
            members: [
              {
                id: MEMBER_ID,
                userId: USER_ID,
                role: "owner",
                displayName: draft.memberName,
                email: null,
                isSelf: true,
                accessPassExpiresAt: null,
                accessPassExpired: false,
              },
            ],
          };
        },
      });
      this.state = draft;
      this.events.push("transaction:commit");
      return result as T;
    } catch (error) {
      this.events.push("transaction:rollback");
      throw error;
    }
  }
}

test("profile update serializes before authority locks and commits both names with its exact response", async () => {
  const store = new ProfileStore();
  const result = await updateHouseholdProfileAtomically({
    store,
    userId: USER_ID,
    displayName: "After",
  });

  assert.deepEqual(store.state, { userName: "After", memberName: "After" });
  assert.equal(result.user.displayName, "After");
  assert.equal(result.members[0]?.displayName, "After");
  assert.deepEqual(store.events, [
    "transaction:begin",
    "serialize-households",
    "lock-user",
    "confirm-households",
    "lock-membership",
    "clock",
    "update-user",
    "update-memberships",
    "exact-me",
    "transaction:commit",
  ]);
});

test("a membership committed during the serializer/user-lock gap aborts with zero profile writes, then a retry succeeds", async () => {
  const store = new ProfileStore();
  store.joinCommitsWhileWaitingForUserLock = true;

  await assert.rejects(
    updateHouseholdProfileAtomically({
      store,
      userId: USER_ID,
      displayName: "After",
    }),
    (error: unknown) =>
      error instanceof HouseholdAuthoritySnapshotError &&
      error.status === 409,
  );
  assert.deepEqual(store.state, { userName: "Before", memberName: "Before" });
  assert.equal(store.events.includes("update-user"), false);
  assert.equal(store.events.includes("lock-membership"), false);

  const result = await updateHouseholdProfileAtomically({
    store,
    userId: USER_ID,
    displayName: "After",
  });
  assert.equal(result.user.displayName, "After");
  assert.deepEqual(store.state, { userName: "After", memberName: "After" });
});

test("a membership removed during the serializer/user-lock gap is covered by the retained superset", async () => {
  const store = new ProfileStore();
  store.membershipHouseholdIds.push(JOINED_HOUSEHOLD_ID);
  store.removeMembershipWhileWaitingForUserLock = true;

  const result = await updateHouseholdProfileAtomically({
    store,
    userId: USER_ID,
  });

  assert.equal(result.household.id, HOUSEHOLD_ID);
  assert.equal(store.events.includes("confirm-households"), true);
});

for (const failure of ["membership", "snapshot"] as const) {
  test(`${failure} failure rolls back both profile name writes and returns no success snapshot`, async () => {
    const store = new ProfileStore();
    store.failMembershipUpdate = failure === "membership";
    store.failSnapshot = failure === "snapshot";

    await assert.rejects(
      updateHouseholdProfileAtomically({
        store,
        userId: USER_ID,
        displayName: "After",
      }),
      failure === "membership"
        ? (error: unknown) => error instanceof HouseholdAuthoritySnapshotError
        : /snapshot failed/,
    );
    assert.deepEqual(store.state, { userName: "Before", memberName: "Before" });
    assert.equal(store.events.at(-1), "transaction:rollback");
  });
}

test("expired or unknown active membership authority fails before either name write", async () => {
  for (const authority of [
    { role: "sitter", expiresAt: NOW },
    { role: "former owner", expiresAt: null },
  ] as const) {
    const store = new ProfileStore();
    store.role = authority.role;
    store.accessPassExpiresAt = authority.expiresAt;
    await assert.rejects(
      updateHouseholdProfileAtomically({
        store,
        userId: USER_ID,
        displayName: "After",
      }),
      (error: unknown) =>
        error instanceof HouseholdAuthoritySnapshotError &&
        error.status === 403,
    );
    assert.deepEqual(store.state, { userName: "Before", memberName: "Before" });
    assert.equal(store.events.includes("update-user"), false);
  }
});
