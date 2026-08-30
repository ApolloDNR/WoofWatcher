import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import {
  db,
  usersTable,
  householdsTable,
  householdMembersTable,
  careStateTable,
  type User,
} from "@workspace/db";
import { deriveAccessPassRuntimeStatus } from "./household-access-pass";
import { ensureActiveHouseholdIdentity } from "./household-active-identity";
import {
  type ExactHouseholdSnapshot,
} from "./household-me-snapshot.ts";
import { buildExactHouseholdSnapshotInDrizzleTransaction } from "./household-snapshot-drizzle-transaction.ts";
import {
  loadFreshVerifiedHouseholdJoinIdentity,
  type FreshVerifiedHouseholdJoinIdentity,
} from "./household-verified-identity.ts";
import {
  confirmUserHouseholdTransactionsLocked,
  lockUserHouseholdTransactions,
} from "./household-transaction-serializer.ts";
import { updateHouseholdProfileAtomically as updateHouseholdProfileWithStore } from "./household-profile-update.ts";
import { createDrizzleHouseholdProfileUpdateStore } from "./household-profile-update-drizzle-store.ts";

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode(): string {
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  }
  return code;
}

async function uniqueInviteCode(database: any = db): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const code = generateInviteCode();
    const [existing] = await database
      .select({ id: householdsTable.id })
      .from(householdsTable)
      .where(eq(householdsTable.inviteCode, code));
    if (!existing) return code;
  }
  return `${generateInviteCode()}${generateInviteCode()}`;
}

async function ensureUser(userId: string): Promise<User> {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (existing) return existing;

  let email: string | null = null;
  let displayName: string | null = null;
  try {
    const cu = await clerkClient.users.getUser(userId);
    email =
      cu.primaryEmailAddress?.emailAddress ??
      cu.emailAddresses[0]?.emailAddress ??
      null;
    const name = [cu.firstName, cu.lastName].filter(Boolean).join(" ").trim();
    displayName = name || cu.username || (email ? email.split("@")[0] : null);
  } catch {
    // Clerk lookup is best-effort; provision with what we have.
  }

  await db
    .insert(usersTable)
    .values({ id: userId, email, displayName })
    .onConflictDoNothing();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return user;
}

export async function getFreshVerifiedHouseholdJoinIdentity(
  userId: string,
): Promise<FreshVerifiedHouseholdJoinIdentity> {
  return loadFreshVerifiedHouseholdJoinIdentity({
    userId,
    getUser: (expectedUserId) => clerkClient.users.getUser(expectedUserId),
  });
}

async function ensureCareState(
  householdId: string,
  userId: string,
  database: any = db,
): Promise<void> {
  await database
    .insert(careStateTable)
    .values({ householdId, doc: {}, version: 1, updatedBy: userId })
    .onConflictDoNothing();
}

/**
 * Ensures the user exists and belongs to at least one household, creating a
 * default household + membership + care state on first sign-in. Returns the
 * user's persisted active household id. The active pointer is trusted only
 * while an exact membership for this same user still exists. Missing/stale
 * pointers fall back deterministically under a per-user row lock.
 */
export async function ensureUserAndHousehold(
  userId: string,
): Promise<{ user: User; householdId: string }> {
  await ensureUser(userId);

  const resolution = await ensureActiveHouseholdIdentity<User>({
    userId,
    store: {
      transaction: (work) =>
        db.transaction(async (transaction: any) =>
          work({
            async lockUserHouseholds(expectedUserId) {
              return lockUserHouseholdTransactions({
                transaction,
                householdMembersTable,
                userId: expectedUserId,
              });
            },
            async getCurrentTime() {
              const [row] = await transaction.select({
                now: sql<Date>`clock_timestamp()`,
              });
              return new Date(row.now);
            },
            async lockUser(expectedUserId) {
              const [user] = await transaction
                .select()
                .from(usersTable)
                .where(eq(usersTable.id, expectedUserId))
                .for("update");
              return user ?? null;
            },
            async confirmUserHouseholdsLocked(
              expectedUserId,
              lockedHouseholdIds,
            ) {
              return confirmUserHouseholdTransactionsLocked({
                transaction,
                householdMembersTable,
                userId: expectedUserId,
                lockedHouseholdIds,
              });
            },
            async listMemberships(expectedUserId) {
              return transaction
                .select()
                .from(householdMembersTable)
                .where(eq(householdMembersTable.userId, expectedUserId))
                .for("update");
            },
            async createDefaultHousehold({ name }) {
              const inviteCode = await uniqueInviteCode(transaction);
              const [household] = await transaction
                .insert(householdsTable)
                .values({ name, inviteCode })
                .returning();
              return { householdId: household.id };
            },
            async createOwnerMembership(input) {
              const [membership] = await transaction
                .insert(householdMembersTable)
                .values({
                  householdId: input.householdId,
                  userId: input.userId,
                  role: "owner",
                  displayName: input.displayName,
                })
                .returning();
              return membership;
            },
            async ensureCareState(householdId, expectedUserId) {
              await ensureCareState(householdId, expectedUserId, transaction);
            },
            async setActiveHousehold(expectedUserId, householdId) {
              const [membership] = await transaction
                .select({ id: householdMembersTable.id })
                .from(householdMembersTable)
                .where(
                  and(
                    eq(householdMembersTable.userId, expectedUserId),
                    eq(householdMembersTable.householdId, householdId),
                  ),
                )
                .for("update");
              if (!membership) return false;

              const [updated] = await transaction
                .update(usersTable)
                .set({ activeHouseholdId: householdId })
                .where(eq(usersTable.id, expectedUserId))
                .returning({ id: usersTable.id });
              return Boolean(updated);
            },
          }),
        ),
    },
  });

  return { user: resolution.user, householdId: resolution.householdId };
}

export async function getActiveHouseholdId(userId: string): Promise<string> {
  const { householdId } = await ensureUserAndHousehold(userId);
  return householdId;
}

export async function getCaregiverName(
  householdId: string,
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({
      memberName: householdMembersTable.displayName,
      userName: usersTable.displayName,
    })
    .from(householdMembersTable)
    .leftJoin(usersTable, eq(usersTable.id, householdMembersTable.userId))
    .where(
      and(
        eq(householdMembersTable.userId, userId),
        eq(householdMembersTable.householdId, householdId),
      ),
    )
    .limit(1);
  return row?.memberName ?? row?.userName ?? null;
}

export interface HouseholdMemberAuthz {
  id: string;
  userId: string;
  householdId: string;
  role: string;
  displayName: string | null;
  accessPassExpiresAt: string | null;
  accessPassExpired: boolean;
}

export async function getHouseholdMemberAuthz(
  householdId: string,
  userId: string,
): Promise<HouseholdMemberAuthz | null> {
  const [row] = await db
    .select({
      id: householdMembersTable.id,
      userId: householdMembersTable.userId,
      householdId: householdMembersTable.householdId,
      role: householdMembersTable.role,
      displayName: householdMembersTable.displayName,
      accessPassExpiresAt: householdMembersTable.accessPassExpiresAt,
    })
    .from(householdMembersTable)
    .where(
      and(
        eq(householdMembersTable.householdId, householdId),
        eq(householdMembersTable.userId, userId),
      ),
    )
    .limit(1);
  if (!row) return null;

  const runtime = deriveAccessPassRuntimeStatus({
    role: row.role,
    accessPassExpiresAt: row.accessPassExpiresAt,
  });

  return {
    ...row,
    role: runtime.authorizationRole,
    accessPassExpiresAt: runtime.accessPassExpiresAt,
    accessPassExpired: runtime.accessPassExpired,
  };
}

export type MePayload = ExactHouseholdSnapshot;

export async function buildMeInTransaction(
  transaction: any,
  userId: string,
  householdId: string,
): Promise<MePayload> {
  return buildExactHouseholdSnapshotInDrizzleTransaction({
    transaction,
    tables: { usersTable, householdsTable, householdMembersTable },
    userId,
    householdId,
  });
}

export async function buildMe(
  userId: string,
  householdId: string,
): Promise<MePayload> {
  return db.transaction((transaction: any) =>
    buildMeInTransaction(transaction, userId, householdId),
  );
}

export async function updateHouseholdProfileAtomically(input: {
  userId: string;
  displayName?: string | null;
}): Promise<MePayload> {
  return updateHouseholdProfileWithStore({
    ...input,
    store: createDrizzleHouseholdProfileUpdateStore({
      database: db,
      tables: { usersTable, householdMembersTable },
      buildExactMeSnapshot: buildMeInTransaction,
    }),
  });
}
