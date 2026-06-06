import { pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
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
    role: text("role").notNull().default("member"),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.householdId, t.userId)],
);

export type HouseholdMember = typeof householdMembersTable.$inferSelect;
