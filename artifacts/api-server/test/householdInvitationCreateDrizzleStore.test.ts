import assert from "node:assert/strict";
import { test } from "node:test";

import { drizzle } from "drizzle-orm/node-postgres";
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import {
  buildHouseholdAuditEvent,
  buildHouseholdAuditInsert,
  type HouseholdAuditEvent,
} from "../src/lib/household-access-pass.ts";
import { createDrizzleHouseholdInvitationCreateStore } from "../src/lib/household-invitation-create-drizzle-store.ts";
import { createHouseholdInvitationAtomically } from "../src/lib/household-invitation-create.ts";

const USER_A = "user_a";
const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";
const MEMBER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INVITATION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = new Date("2026-08-28T12:00:00.000Z");
const FUTURE = new Date("2026-08-29T12:00:00.000Z");

const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  activeHouseholdId: uuid("active_household_id"),
});
const householdsTable = pgTable("households", {
  id: uuid("id").primaryKey(),
  inviteCode: text("invite_code").notNull().unique(),
});
const householdMembersTable = pgTable("household_members", {
  id: uuid("id").primaryKey(),
  userId: text("user_id").notNull(),
  householdId: uuid("household_id").notNull(),
  role: text("role").notNull(),
});
const householdInvitationsTable = pgTable("household_invitations", {
  id: uuid("id").primaryKey(),
  householdId: uuid("household_id").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  invitedEmail: text("invited_email"),
  role: text("role").notNull(),
  lifecycleState: text("lifecycle_state").notNull(),
  createdByUserId: text("created_by_user_id").notNull(),
  approvedByUserId: text("approved_by_user_id"),
  note: text("note"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata"),
});
const householdAuditEventsTable = pgTable("household_audit_events", {
  id: text("id").primaryKey(),
  householdId: uuid("household_id").notNull(),
  action: text("action").notNull(),
  lifecycleState: text("lifecycle_state").notNull(),
  actorUserId: text("actor_user_id").notNull(),
  targetMemberId: uuid("target_member_id"),
  targetUserId: text("target_user_id"),
  targetRole: text("target_role"),
  nextRole: text("next_role"),
  reason: text("reason"),
  note: text("note"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata"),
});

interface CapturedQuery {
  readonly text: string;
  readonly params: readonly unknown[];
  readonly rowMode: string | undefined;
}

type QueryRows = readonly unknown[];

class ScriptedNodePostgresClient {
  readonly queries: CapturedQuery[] = [];
  private readonly resolveRows: (query: CapturedQuery) => QueryRows;

  constructor(resolveRows: (query: CapturedQuery) => QueryRows) {
    this.resolveRows = resolveRows;
  }

  async query(
    config:
      | string
      | { text: string; values?: readonly unknown[]; rowMode?: string },
    values: readonly unknown[] = [],
  ): Promise<{ rows: QueryRows; rowCount: number }> {
    const query = Object.freeze({
      text: typeof config === "string" ? config : config.text,
      params:
        values.length > 0
          ? [...values]
          : typeof config === "string"
            ? []
            : [...(config.values ?? [])],
      rowMode: typeof config === "string" ? undefined : config.rowMode,
    });
    this.queries.push(query);
    const rows = this.resolveRows(query);
    return { rows, rowCount: rows.length };
  }
}

function normalizedSql(query: CapturedQuery): string {
  return query.text.replace(/\s+/g, " ").trim();
}

function queryIndex(
  client: ScriptedNodePostgresClient,
  pattern: RegExp,
): number {
  return client.queries.findIndex((query) =>
    pattern.test(normalizedSql(query)),
  );
}

function createStore(client: ScriptedNodePostgresClient, candidates: string[]) {
  const database = drizzle({ client: client as never });
  return createDrizzleHouseholdInvitationCreateStore<HouseholdAuditEvent>({
    database,
    tables: {
      usersTable,
      householdsTable,
      householdMembersTable,
      householdInvitationsTable,
      householdAuditEventsTable,
    },
    nextInviteCodeCandidate() {
      const candidate = candidates.shift();
      if (candidate === undefined)
        throw new Error("candidate script exhausted");
      return candidate;
    },
    buildAuditInsert: buildHouseholdAuditInsert,
  });
}

function createInput(store: ReturnType<typeof createStore>) {
  return {
    store,
    actorUserId: USER_A,
    householdId: HOUSEHOLD_A,
    expectedSourceHouseholdId: HOUSEHOLD_A,
    invitedEmail: "caregiver@example.com",
    role: "walker",
    lifecycleState: "approved",
    note: "Evening care",
    expiresAt: FUTURE,
    buildAuditEvent({ invitation, actorMembership, now }: any) {
      return buildHouseholdAuditEvent(
        {
          action: "invitation-created",
          actorUserId: actorMembership.userId,
          householdId: actorMembership.householdId,
          nextRole: invitation.role,
          reason: "Owner/admin created an approved household invitation.",
          note: invitation.note,
          expiresAt: new Date(invitation.expiresAt).toISOString(),
        },
        now,
      );
    },
  };
}

function invitationReturningRow(code: string): readonly unknown[] {
  return [
    INVITATION_ID,
    HOUSEHOLD_A,
    code,
    "caregiver@example.com",
    "walker",
    "approved",
    USER_A,
    USER_A,
    "Evening care",
    FUTURE,
    NOW,
    NOW,
    {
      boundary:
        "Durable household invitation lifecycle storage is provider-ready; Supabase migration, RLS, retention, export/deletion policy, and notification delivery remain launch approval gates.",
      storage: "provider-durable",
    },
  ];
}

test("the real Drizzle adapter locks authority, uses DB time, retries both collision sources, and commits invitation plus audit", async () => {
  const client = new ScriptedNodePostgresClient((query) => {
    const statement = normalizedSql(query);
    if (
      statement === "begin" ||
      statement === "commit" ||
      statement === "rollback"
    ) {
      return [];
    }
    if (/^select pg_advisory_xact_lock\(hashtextextended\(/.test(statement)) {
      return query.rowMode === "array" ? [[null]] : [{}];
    }
    if (/from "users".*for update$/.test(statement)) {
      return [[USER_A, HOUSEHOLD_A]];
    }
    if (/from "household_members".*for update$/.test(statement)) {
      return [[MEMBER_A, USER_A, HOUSEHOLD_A, "owner"]];
    }
    if (/^select clock_timestamp\(\)/.test(statement)) {
      return query.rowMode === "array" ? [[NOW]] : [{ now: NOW }];
    }
    if (/from "households".*for share$/.test(statement)) {
      return query.params.includes("LEGACY01") ? [[HOUSEHOLD_B]] : [];
    }
    if (/^insert into "household_invitations"/.test(statement)) {
      if (query.params.includes("USED0001")) return [];
      if (query.params.includes("FRESH123")) {
        return [invitationReturningRow("FRESH123")];
      }
    }
    if (/^insert into "household_audit_events"/.test(statement)) return [];
    throw new Error(`Unexpected SQL: ${statement}`);
  });

  const result = await createHouseholdInvitationAtomically(
    createInput(createStore(client, ["LEGACY01", "USED0001", "FRESH123"])),
  );

  assert.equal(result.invitation.id, INVITATION_ID);
  assert.equal(result.invitation.inviteCode, "FRESH123");
  assert.equal(result.auditEvent.householdId, HOUSEHOLD_A);
  assert.equal(result.auditEvent.nextRole, "walker");
  assert.equal(result.auditEvent.createdAt, NOW.toISOString());

  const beginAt = queryIndex(client, /^begin$/);
  const userLockAt = queryIndex(client, /from "users".*for update$/);
  const memberLockAt = queryIndex(
    client,
    /from "household_members".*for update$/,
  );
  const clockAt = queryIndex(client, /^select clock_timestamp\(\)/);
  const legacyCheckAt = queryIndex(client, /from "households".*for share$/);
  const invitationInsertAt = queryIndex(
    client,
    /^insert into "household_invitations"/,
  );
  const auditInsertAt = queryIndex(
    client,
    /^insert into "household_audit_events"/,
  );
  const commitAt = queryIndex(client, /^commit$/);
  assert.ok(
    beginAt < userLockAt &&
      userLockAt < memberLockAt &&
      memberLockAt < clockAt &&
      clockAt < legacyCheckAt &&
      legacyCheckAt < invitationInsertAt &&
      invitationInsertAt < auditInsertAt &&
      auditInsertAt < commitAt,
  );
  assert.deepEqual(client.queries[userLockAt]?.params, [USER_A]);
  assert.deepEqual(client.queries[memberLockAt]?.params, [USER_A, HOUSEHOLD_A]);
  assert.match(
    normalizedSql(client.queries[invitationInsertAt]!),
    /on conflict \("invite_code"\) do nothing returning/,
  );
  assert.equal(
    client.queries.filter((query) =>
      /^insert into "household_invitations"/.test(normalizedSql(query)),
    ).length,
    2,
  );
  assert.equal(
    client.queries.filter((query) =>
      /from "households".*for share$/.test(normalizedSql(query)),
    ).length,
    3,
  );
  assert.ok(
    client.queries[auditInsertAt]?.params.includes(result.auditEvent.id),
  );
  assert.equal(queryIndex(client, /^rollback$/), -1);
});

test("a real Drizzle audit failure rolls back the already-inserted invitation", async () => {
  const client = new ScriptedNodePostgresClient((query) => {
    const statement = normalizedSql(query);
    if (statement === "begin" || statement === "rollback") return [];
    if (/^select pg_advisory_xact_lock\(hashtextextended\(/.test(statement)) {
      return query.rowMode === "array" ? [[null]] : [{}];
    }
    if (/from "users".*for update$/.test(statement)) {
      return [[USER_A, HOUSEHOLD_A]];
    }
    if (/from "household_members".*for update$/.test(statement)) {
      return [[MEMBER_A, USER_A, HOUSEHOLD_A, "owner"]];
    }
    if (/^select clock_timestamp\(\)/.test(statement)) {
      return query.rowMode === "array" ? [[NOW]] : [{ now: NOW }];
    }
    if (/from "households".*for share$/.test(statement)) return [];
    if (/^insert into "household_invitations"/.test(statement)) {
      return [invitationReturningRow("FRESH123")];
    }
    if (/^insert into "household_audit_events"/.test(statement)) {
      throw new Error("scripted audit insert failure");
    }
    throw new Error(`Unexpected SQL: ${statement}`);
  });

  await assert.rejects(
    createHouseholdInvitationAtomically(
      createInput(createStore(client, ["FRESH123"])),
    ),
    (error) => {
      const cause = Reflect.get(error as object, "cause");
      assert.match(String(cause ?? error), /scripted audit insert failure/);
      return true;
    },
  );

  const invitationInsertAt = queryIndex(
    client,
    /^insert into "household_invitations"/,
  );
  const auditInsertAt = queryIndex(
    client,
    /^insert into "household_audit_events"/,
  );
  const rollbackAt = queryIndex(client, /^rollback$/);
  assert.ok(
    invitationInsertAt >= 0 &&
      invitationInsertAt < auditInsertAt &&
      auditInsertAt < rollbackAt,
  );
  assert.equal(queryIndex(client, /^commit$/), -1);
});
