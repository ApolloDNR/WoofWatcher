import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { householdsTable } from "./households";

export type HouseholdAuditEventDetails = Record<string, unknown>;

export const householdAuditEventsTable = pgTable("household_audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => householdsTable.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  lifecycleState: text("lifecycle_state").notNull().default("active"),
  details: jsonb("details").$type<HouseholdAuditEventDetails>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type HouseholdAuditEvent = typeof householdAuditEventsTable.$inferSelect;
