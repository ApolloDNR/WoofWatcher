import { bigint, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// A household groups caregivers and shares one synced care profile + log.
export const householdsTable = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  careHistoryGeneration: bigint("care_history_generation", {
    mode: "number",
  })
    .notNull()
    .default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Household = typeof householdsTable.$inferSelect;
