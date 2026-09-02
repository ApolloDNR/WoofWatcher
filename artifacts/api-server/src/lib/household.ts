import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
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
import { isCareStateWriteAllowed } from "./care-state-authorization";

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode(): string {
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  }
  return code;
}

async function uniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const code = generateInviteCode();
    const [existing] = await db
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

async function ensureCareState(householdId: string, userId: string): Promise<void> {
  await db
    .insert(careStateTable)
    .values({ householdId, doc: {}, version: 1, updatedBy: userId })
    .onConflictDoNothing();
}

/**
 * Ensures the user exists and belongs to at least one household, creating a
 * default household + membership + care state on first sign-in. Returns the
 * user's active (earliest) household id.
 */
export async function ensureUserAndHousehold(
  userId: string,
): Promise<{ user: User; householdId: string }> {
  const user = await ensureUser(userId);

  const [membership] = await db
    .select()
    .from(householdMembersTable)
    .where(eq(householdMembersTable.userId, userId))
    .orderBy(householdMembersTable.createdAt)
    .limit(1);

  if (membership) {
    await ensureCareState(membership.householdId, userId);
    return { user, householdId: membership.householdId };
  }

  const inviteCode = await uniqueInviteCode();
  const name = user.displayName ? `${user.displayName}'s Pack` : "My Pack";
  const [household] = await db
    .insert(householdsTable)
    .values({ name, inviteCode })
    .returning();
  await db.insert(householdMembersTable).values({
    householdId: household.id,
    userId,
    role: "owner",
    displayName: user.displayName,
  });
  await ensureCareState(household.id, userId);
  return { user, householdId: household.id };
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
  storedRole: string;
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
    storedRole: row.role,
    role: runtime.authorizationRole,
    accessPassExpiresAt: runtime.accessPassExpiresAt,
    accessPassExpired: runtime.accessPassExpired,
  };
}

export interface MePayload {
  user: { id: string; email: string | null; displayName: string | null };
  household: { id: string; name: string; inviteCode: string };
  members: Array<{
    id: string;
    userId: string;
    role: string;
    displayName: string | null;
    email: string | null;
    isSelf: boolean;
    accessPassExpiresAt: string | null;
    accessPassExpired: boolean;
    careStateWriteAllowed: boolean;
  }>;
}

export async function buildMe(
  userId: string,
  householdId: string,
): Promise<MePayload> {
  const [[user], [household], memberRows] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)),
    db.select().from(householdsTable).where(eq(householdsTable.id, householdId)),
    db
      .select({
        id: householdMembersTable.id,
        userId: householdMembersTable.userId,
        role: householdMembersTable.role,
        accessPassExpiresAt: householdMembersTable.accessPassExpiresAt,
        memberName: householdMembersTable.displayName,
        userName: usersTable.displayName,
        email: usersTable.email,
      })
      .from(householdMembersTable)
      .leftJoin(usersTable, eq(usersTable.id, householdMembersTable.userId))
      .where(eq(householdMembersTable.householdId, householdId))
      .orderBy(householdMembersTable.createdAt),
  ]);

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    household: {
      id: household.id,
      name: household.name,
      inviteCode: household.inviteCode,
    },
    members: memberRows.map((m) => {
      const runtime = deriveAccessPassRuntimeStatus({
        role: m.role,
        accessPassExpiresAt: m.accessPassExpiresAt,
      });

      return {
        id: m.id,
        userId: m.userId,
        role: runtime.role,
        displayName: m.memberName ?? m.userName ?? null,
        email: m.email ?? null,
        isSelf: m.userId === userId,
        accessPassExpiresAt: runtime.accessPassExpiresAt,
        accessPassExpired: runtime.accessPassExpired,
        careStateWriteAllowed: isCareStateWriteAllowed(
          m.role,
          runtime.authorizationRole,
        ),
      };
    }),
  };
}
