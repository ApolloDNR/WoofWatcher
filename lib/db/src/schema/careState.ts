import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { householdsTable } from "./households";

// The synced config document for a household: pet profile, diet, routines,
// goals, records, calendar events, etc. The client owns the document shape;
// the server treats it as an opaque JSON blob with optimistic versioning.
export type CareStateDoc = Record<string, unknown>;

export const careStateTable = pgTable("care_state", {
  householdId: uuid("household_id")
    .primaryKey()
    .references(() => householdsTable.id, { onDelete: "cascade" }),
  doc: jsonb("doc").$type<CareStateDoc>().notNull().default({}),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type CareState = typeof careStateTable.$inferSelect;
