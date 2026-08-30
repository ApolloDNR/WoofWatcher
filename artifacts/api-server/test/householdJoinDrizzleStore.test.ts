import assert from "node:assert/strict";
import { test } from "node:test";

import { drizzle } from "drizzle-orm/node-postgres";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import {
  HouseholdJoinCommitError,
  commitJoinedHouseholdActivation,
} from "../src/lib/household-active-identity.ts";
import { buildHouseholdAuditEvent } from "../src/lib/household-access-pass.ts";
import { createDrizzleHouseholdJoinStore } from "../src/lib/household-join-drizzle-store.ts";

const USER_ID = "user_join";
const SOURCE_HOUSEHOLD_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_HOUSEHOLD_ID = "22222222-2222-4222-8222-222222222222";
const INVITATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MEMBERSHIP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const usersTable = pgTable("join_clock_users", {
  id: text("id").primaryKey(),
  displayName: text("display_name"),
  activeHouseholdId: uuid("active_household_id"),
});
const householdInvitationsTable = pgTable("join_clock_invitations", {
  id: uuid("id").primaryKey(),
  householdId: uuid("household_id").notNull(),
  invitedUserId: text("invited_user_id"),
  invitedEmail: text("invited_email"),
  role: text("role").notNull(),
  lifecycleState: text("lifecycle_state").notNull(),
  acceptedByUserId: text("accepted_by_user_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});
const householdMembersTable = pgTable("join_clock_members", {
  id: uuid("id").primaryKey(),
  userId: text("user_id").notNull(),
  householdId: uuid("household_id").notNull(),
  role: text("role").notNull(),
  displayName: text("display_name"),
  accessPassExpiresAt: timestamp("access_pass_expires_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
const careStateTable = pgTable("join_clock_care_state", {
  householdId: uuid("household_id").primaryKey(),
  doc: jsonb("doc").notNull(),
  version: integer("version").notNull(),
  updatedBy: text("updated_by").notNull(),
});
const householdAuditEventsTable = pgTable("join_clock_audit_events", {
  id: text("id").primaryKey(),
  action: text("action").notNull(),
  lifecycleState: text("lifecycle_state").notNull(),
  actorUserId: text("actor_user_id").notNull(),
  householdId: uuid("household_id").notNull(),
  targetMemberId: uuid("target_member_id"),
  targetUserId: text("target_user_id"),
  targetRole: text("target_role"),
  nextRole: text("next_role"),
  reason: text("reason"),
  note: text("note"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

interface CapturedQuery {
  text: string;
  params: readonly unknown[];
  rowMode: string | undefined;
}

function normalizeSql(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

class JoinClockClient {
  readonly queries: CapturedQuery[] = [];
  readonly databaseNow: Date;
  readonly invitationExpiresAt: Date;

  constructor(databaseNow: Date, invitationExpiresAt: Date) {
    this.databaseNow = databaseNow;
    this.invitationExpiresAt = invitationExpiresAt;
  }

  async query(
    config:
      | string
      | { text: string; values?: readonly unknown[]; rowMode?: string },
    values: readonly unknown[] = [],
  ): Promise<{ rows: readonly unknown[]; rowCount: number }> {
    const query = {
      text: typeof config === "string" ? config : config.text,
      params:
        values.length > 0
          ? [...values]
          : typeof config === "string"
            ? []
            : [...(config.values ?? [])],
      rowMode: typeof config === "string" ? undefined : config.rowMode,
    };
    this.queries.push(query);
    const sql = normalizeSql(query.text);
    let rows: readonly unknown[];
    if (sql === "begin" || sql === "commit" || sql === "rollback") {
      rows = [];
    } else if (/^select pg_advisory_xact_lock\(hashtextextended\(/.test(sql)) {
      rows = query.rowMode === "array" ? [[null]] : [{}];
    } else if (/^select .* from "join_clock_users".*for update$/.test(sql)) {
      rows = [[USER_ID, "Apollo", SOURCE_HOUSEHOLD_ID]];
    } else if (
      /^select .* from "join_clock_invitations".*for update$/.test(sql)
    ) {
      rows = [[
        INVITATION_ID,
        TARGET_HOUSEHOLD_ID,
        null,
        null,
        "adult",
        "approved",
        null,
        this.invitationExpiresAt,
        null,
        null,
      ]];
    } else if (/^select clock_timestamp\(\)/.test(sql)) {
      rows = query.rowMode === "array"
        ? [[this.databaseNow]]
        : [{ now: this.databaseNow }];
    } else if (
      /^select .* from "join_clock_members".*for update$/.test(sql)
    ) {
      rows = [[
        MEMBERSHIP_ID,
        USER_ID,
        TARGET_HOUSEHOLD_ID,
        "adult",
        "Apollo",
        null,
        new Date("2026-08-28T09:00:00.000Z"),
      ]];
    } else if (/^update "join_clock_invitations"/.test(sql)) {
      rows = [[INVITATION_ID]];
    } else if (/^insert into "join_clock_care_state"/.test(sql)) {
      rows = [];
    } else if (/^insert into "join_clock_audit_events"/.test(sql)) {
      rows = [];
    } else if (/^update "join_clock_users"/.test(sql)) {
      rows = [[USER_ID]];
    } else {
      throw new Error(`Unexpected SQL: ${sql}`);
    }
    return { rows, rowCount: rows.length };
  }
}

async function runShippingJoin(input: {
  databaseNow: Date;
  invitationExpiresAt: Date;
}) {
  const client = new JoinClockClient(
    input.databaseNow,
    input.invitationExpiresAt,
  );
  const database = drizzle({ client: client as never });
  const store = createDrizzleHouseholdJoinStore({
    database,
    tables: {
      careStateTable,
      householdAuditEventsTable,
      householdInvitationsTable,
      householdMembersTable,
      usersTable,
    },
    async buildExactMeSnapshot(_transaction, userId, householdId) {
      return { userId, householdId };
    },
  });

  const result = await commitJoinedHouseholdActivation({
    store,
    userId: USER_ID,
    householdId: TARGET_HOUSEHOLD_ID,
    expectedSourceHouseholdId: SOURCE_HOUSEHOLD_ID,
    invitationId: INVITATION_ID,
    verifiedIdentity: {
      state: "verified",
      userId: USER_ID,
      verifiedEmails: [],
    },
    buildAuditEvent({ membership, acceptedAt }) {
      return {
        ...buildHouseholdAuditEvent(
          {
            action: "invitation-accepted",
            actorUserId: USER_ID,
            householdId: TARGET_HOUSEHOLD_ID,
            targetMemberId: membership.id,
            targetUserId: USER_ID,
            targetRole: membership.role,
            nextRole: membership.role,
            reason: "Approved invitation accepted.",
          },
          acceptedAt,
        ),
        id: `household_invitation_accepted_${INVITATION_ID}`,
      };
    },
  });
  return { client, result };
}

test("shipping join accepts just before expiry and repeats the exact DB time in the atomic expiry CAS", async () => {
  const databaseNow = new Date("2029-01-01T00:00:00.000Z");
  const { client, result } = await runShippingJoin({
    databaseNow,
    invitationExpiresAt: new Date("2029-01-01T00:00:00.001Z"),
  });

  assert.equal(result.replayed, false);
  const statements = client.queries.map((query) => normalizeSql(query.text));
  const invitationLockAt = statements.findIndex(
    (sql) =>
      /from "join_clock_invitations"/.test(sql) && /for update$/.test(sql),
  );
  const clockAt = statements.findIndex((sql) =>
    /^select clock_timestamp\(\)/.test(sql),
  );
  const invitationUpdateAt = statements.findIndex((sql) =>
    /^update "join_clock_invitations"/.test(sql),
  );
  assert.ok(invitationLockAt < clockAt && clockAt < invitationUpdateAt);
  assert.match(
    statements[invitationUpdateAt] ?? "",
    /"expires_at" is null or "join_clock_invitations"\."expires_at" > \$/,
  );
  assert.ok(
    client.queries[invitationUpdateAt]?.params.some(
      (value) =>
        (value instanceof Date && value.getTime() === databaseNow.getTime()) ||
        value === databaseNow.toISOString(),
    ),
  );
});

for (const offsetMs of [0, -1] as const) {
  test(`shipping join rejects DB-clock ${offsetMs === 0 ? "equal" : "after"} expiry with no write`, async () => {
    const databaseNow = new Date("2029-01-01T00:00:00.000Z");
    const client = new JoinClockClient(
      databaseNow,
      new Date(databaseNow.getTime() + offsetMs),
    );
    const database = drizzle({ client: client as never });
    const store = createDrizzleHouseholdJoinStore({
      database,
      tables: {
        careStateTable,
        householdAuditEventsTable,
        householdInvitationsTable,
        householdMembersTable,
        usersTable,
      },
      async buildExactMeSnapshot() {
        throw new Error("snapshot must not run");
      },
    });

    await assert.rejects(
      commitJoinedHouseholdActivation({
        store,
        userId: USER_ID,
        householdId: TARGET_HOUSEHOLD_ID,
        expectedSourceHouseholdId: SOURCE_HOUSEHOLD_ID,
        invitationId: INVITATION_ID,
        verifiedIdentity: {
          state: "verified",
          userId: USER_ID,
          verifiedEmails: [],
        },
        buildAuditEvent() {
          throw new Error("audit must not run");
        },
      }),
      (error: unknown) => {
        assert.ok(error instanceof HouseholdJoinCommitError);
        assert.equal(error.status, 403);
        assert.match(error.message, /expired/i);
        return true;
      },
    );

    const statements = client.queries.map((query) => normalizeSql(query.text));
    assert.ok(statements.some((sql) => /^select clock_timestamp\(\)/.test(sql)));
    assert.equal(statements.some((sql) => /^(insert|update|delete) /.test(sql)), false);
    assert.equal(statements.at(-1), "rollback");
  });
}
