import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { householdsTable } from "./households";

// Clerk-backed users. `id` is the Clerk user id (JIT-provisioned on first request).
export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  activeHouseholdId: uuid("active_household_id").references(() => householdsTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type User = typeof usersTable.$inferSelect;
