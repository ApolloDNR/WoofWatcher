import assert from "node:assert/strict";
import { test } from "node:test";

import { loadFreshVerifiedHouseholdJoinIdentity } from "../src/lib/household-verified-identity.ts";

const USER_ID = "user_a";

test("fresh identity accepts every currently verified provider email and ignores cached-style unverified addresses", async () => {
  const requestedUsers: string[] = [];
  const identity = await loadFreshVerifiedHouseholdJoinIdentity({
    userId: USER_ID,
    async getUser(userId) {
      requestedUsers.push(userId);
      return {
        id: USER_ID,
        emailAddresses: [
          {
            emailAddress: "Provider-New@Example.com",
            verification: { status: "verified" },
          },
          {
            emailAddress: "cached-old@example.com",
            verification: { status: "unverified" },
          },
          {
            emailAddress: "provider-new@example.com",
            verification: { status: "verified" },
          },
          {
            emailAddress: "secondary@example.com",
            verification: { status: "verified" },
          },
          {
            emailAddress: "expired@example.com",
            verification: { status: "expired" },
          },
          { emailAddress: "no-proof@example.com", verification: null },
        ],
      };
    },
  });

  assert.deepEqual(requestedUsers, [USER_ID]);
  assert.deepEqual(identity, {
    state: "verified",
    userId: USER_ID,
    verifiedEmails: [
      "Provider-New@Example.com",
      "secondary@example.com",
    ],
  });
});

test("provider failure, missing user, and mismatched provider identity are unavailable rather than cached fallbacks", async () => {
  for (const getUser of [
    async () => {
      throw new Error("provider unavailable");
    },
    async () => null,
    async () => ({ id: "user_b", emailAddresses: [] }),
  ]) {
    assert.deepEqual(
      await loadFreshVerifiedHouseholdJoinIdentity({
        userId: USER_ID,
        getUser,
      }),
      { state: "provider-unavailable", userId: USER_ID },
    );
  }
});

test("a reachable provider with no verified address remains distinguishable from provider outage", async () => {
  assert.deepEqual(
    await loadFreshVerifiedHouseholdJoinIdentity({
      userId: USER_ID,
      async getUser() {
        return {
          id: USER_ID,
          emailAddresses: [
            {
              emailAddress: "pending@example.com",
              verification: { status: "unverified" },
            },
          ],
        };
      },
    }),
    { state: "verified", userId: USER_ID, verifiedEmails: [] },
  );
});
