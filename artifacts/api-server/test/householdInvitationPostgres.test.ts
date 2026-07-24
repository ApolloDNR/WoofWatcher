import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptHouseholdInvitationAtomically,
  type AtomicHouseholdInvitationTransaction,
} from "../src/lib/household-invitations.ts";

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    create table household_invitations (
      id text primary key,
      household_id text not null,
      invite_code text not null unique,
      role text not null,
      lifecycle_state text not null,
      expires_at timestamptz,
      accepted_by_user_id text
    );
    create table household_members (
      household_id text not null,
      user_id text not null,
      role text not null,
      primary key (household_id, user_id)
    );
    create table users (
      id text primary key,
      active_household_id text
    );
    create table household_audit_events (
      household_id text not null,
      user_id text not null,
      role text not null
    );
    insert into users (id, active_household_id) values
      ('user_a', 'h1'),
      ('user_b', 'h3'),
      ('user_rollback', 'h1');
  `);
  return db;
}

function createPGliteInvitationStore(
  db: Awaited<ReturnType<typeof createDatabase>>,
  input?: { failAudit?: boolean },
) {
  return {
    transaction<T>(
      callback: (
        tx: AtomicHouseholdInvitationTransaction<{
          householdId: string;
          userId: string;
          role: string;
        }>,
      ) => Promise<T>,
    ): Promise<T> {
      return db.transaction(async (sql) =>
        callback({
          async claimApprovedInvitation({ code, userId, now }) {
            const result = await sql.query<{
              id: string;
              householdId: string;
              inviteCode: string;
              role: string;
              lifecycleState: string;
              expiresAt: string | null;
              acceptedByUserId: string | null;
            }>(
              `
                update household_invitations
                set lifecycle_state = 'accepted',
                    accepted_by_user_id = $2
                where invite_code = $1
                  and lifecycle_state = 'approved'
                  and (expires_at is null or expires_at > $3)
                returning
                  id,
                  household_id as "householdId",
                  invite_code as "inviteCode",
                  role,
                  lifecycle_state as "lifecycleState",
                  expires_at::text as "expiresAt",
                  accepted_by_user_id as "acceptedByUserId"
              `,
              [code, userId, now.toISOString()],
            );
            return result.rows[0] ?? null;
          },
          async classifyInvitation(code) {
            const result = await sql.query<{
              id: string;
              householdId: string;
              inviteCode: string;
              role: string;
              lifecycleState: string;
              expiresAt: string | null;
              acceptedByUserId: string | null;
            }>(
              `
                select
                  id,
                  household_id as "householdId",
                  invite_code as "inviteCode",
                  role,
                  lifecycle_state as "lifecycleState",
                  expires_at::text as "expiresAt",
                  accepted_by_user_id as "acceptedByUserId"
                from household_invitations
                where invite_code = $1
              `,
              [code],
            );
            return result.rows[0] ?? null;
          },
          async createMembership({ householdId, userId, role }) {
            await sql.query(
              `
                insert into household_members (household_id, user_id, role)
                values ($1, $2, $3)
                on conflict do nothing
              `,
              [householdId, userId, role],
            );
          },
          async setActiveHousehold(userId, householdId) {
            await sql.query(
              "update users set active_household_id = $2 where id = $1",
              [userId, householdId],
            );
          },
          async createAcceptanceAudit({ householdId, userId, role }) {
            if (input?.failAudit) throw new Error("audit unavailable");
            await sql.query(
              `
                insert into household_audit_events (household_id, user_id, role)
                values ($1, $2, $3)
              `,
              [householdId, userId, role],
            );
            return { householdId, userId, role };
          },
        }),
      );
    },
  };
}

test("Postgres transaction grants one of two distinct claimers exactly once", async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  await db.query(
    `
        insert into household_invitations
          (id, household_id, invite_code, role, lifecycle_state, expires_at)
        values ('invite-race', 'h2', 'RACE', 'adult', 'approved', $1)
      `,
    ["2026-07-24T12:00:00.000Z"],
  );
  const store = createPGliteInvitationStore(db);
  const results = await Promise.allSettled(
    ["user_a", "user_b"].map((userId) =>
      acceptHouseholdInvitationAtomically(
        {
          code: "RACE",
          userId,
          displayName: userId,
          now: new Date("2026-07-23T12:00:00.000Z"),
        },
        store,
      ),
    ),
  );

  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    results.filter((result) => result.status === "rejected").length,
    1,
  );
  const memberships = await db.query<{ user_id: string }>(
    "select user_id from household_members",
  );
  const audits = await db.query<{ user_id: string }>(
    "select user_id from household_audit_events",
  );
  assert.equal(memberships.rows.length, 1);
  assert.deepEqual(audits.rows, memberships.rows);
});

test("Postgres transaction rolls back claim, membership, active selection, and audit failure", async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  await db.query(
    `
        insert into household_invitations
          (id, household_id, invite_code, role, lifecycle_state, expires_at)
        values ('invite-rollback', 'h2', 'ROLLBACK-SQL', 'adult', 'approved', $1)
      `,
    ["2026-07-24T12:00:00.000Z"],
  );
  const store = createPGliteInvitationStore(db, { failAudit: true });

  await assert.rejects(
    acceptHouseholdInvitationAtomically(
      {
        code: "ROLLBACK-SQL",
        userId: "user_rollback",
        displayName: "Rollback",
        now: new Date("2026-07-23T12:00:00.000Z"),
      },
      store,
    ),
    /audit unavailable/,
  );

  const invitation = await db.query<{
    lifecycle_state: string;
    accepted_by_user_id: string | null;
  }>(
    `
        select lifecycle_state, accepted_by_user_id
        from household_invitations
        where id = 'invite-rollback'
      `,
  );
  const memberships = await db.query(
    "select * from household_members where user_id = 'user_rollback'",
  );
  const user = await db.query<{ active_household_id: string }>(
    "select active_household_id from users where id = 'user_rollback'",
  );
  const audits = await db.query(
    "select * from household_audit_events where user_id = 'user_rollback'",
  );

  assert.deepEqual(invitation.rows, [
    { lifecycle_state: "approved", accepted_by_user_id: null },
  ]);
  assert.deepEqual(memberships.rows, []);
  assert.equal(user.rows[0]?.active_household_id, "h1");
  assert.deepEqual(audits.rows, []);
});
