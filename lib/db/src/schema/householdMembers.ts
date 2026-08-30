import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { householdsTable } from "./households";
import { usersTable } from "./users";

// Links a user to a household (many-to-many) with a role.
export const householdMembersTable = pgTable(
  "household_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => householdsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("adult"),
    displayName: text("display_name"),
    accessPassExpiresAt: timestamp("access_pass_expires_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique().on(t.householdId, t.userId),
    check(
      "household_members_role_canonical_check",
      sql`${t.role} in ('owner', 'adult', 'teen', 'kid', 'sitter', 'trainer', 'walker', 'vet viewer')`,
    ),
  ],
);

export type HouseholdMember = typeof householdMembersTable.$inferSelect;
