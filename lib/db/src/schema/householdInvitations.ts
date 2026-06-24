import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { householdsTable } from "./households";

export type HouseholdInvitationMetadata = {
  boundary: string;
  storage: "provider-durable";
};

export const householdInvitationsTable = pgTable("household_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => householdsTable.id, { onDelete: "cascade" }),
  inviteCode: text("invite_code").notNull().unique(),
  invitedEmail: text("invited_email"),
  invitedUserId: text("invited_user_id"),
  role: text("role").notNull().default("adult"),
  lifecycleState: text("lifecycle_state").notNull().default("approved"),
  createdByUserId: text("created_by_user_id").notNull(),
  approvedByUserId: text("approved_by_user_id"),
  acceptedByUserId: text("accepted_by_user_id"),
  revokedByUserId: text("revoked_by_user_id"),
  rejectedByUserId: text("rejected_by_user_id"),
  note: text("note"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  metadata: jsonb("metadata").$type<HouseholdInvitationMetadata>(),
});

export type HouseholdInvitationRecord = typeof householdInvitationsTable.$inferSelect;
