import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { householdsTable } from "./households";

export type HouseholdAuditMetadata = {
  boundary: string;
  storage: "provider-durable";
};

export const householdAuditEventsTable = pgTable("household_audit_events", {
  id: text("id").primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => householdsTable.id, { onDelete: "cascade" }),
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  metadata: jsonb("metadata").$type<HouseholdAuditMetadata>(),
});

export type HouseholdAuditEventRecord = typeof householdAuditEventsTable.$inferSelect;
