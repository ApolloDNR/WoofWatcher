import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { householdsTable } from "./households";

// Append-only care log entries. Stored as individual rows so concurrent
// caregivers logging at the same time never clobber each other.
export type CareEntryDetails = Record<string, unknown>;

export const careEntriesTable = pgTable(
  "care_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => householdsTable.id, { onDelete: "cascade" }),
    petId: text("pet_id"),
    type: text("type").notNull(),
    occurredAt: timestamp("occurred_at", {
      withTimezone: true,
      precision: 3,
    })
      .notNull()
      .defaultNow(),
    caregiverUserId: text("caregiver_user_id"),
    householdVisible: boolean("household_visible").notNull().default(true),
    caregiverName: text("caregiver_name"),
    mood: text("mood"),
    severity: text("severity"),
    note: text("note"),
    details: jsonb("details").$type<CareEntryDetails>(),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("care_entries_revision_minimum", sql`${table.revision} >= 1`),
    index("care_entries_history_cursor_idx").on(
      table.householdId,
      table.occurredAt.desc(),
      table.id.desc(),
    ),
  ],
);

export type CareEntry = typeof careEntriesTable.$inferSelect;

export const careEntryTombstonesTable = pgTable("care_entry_tombstones", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => householdsTable.id, { onDelete: "cascade" }),
  entryId: uuid("entry_id").notNull(),
  petId: text("pet_id"),
  caregiverUserId: text("caregiver_user_id"),
  householdVisible: boolean("household_visible").notNull().default(true),
  deletedByUserId: text("deleted_by_user_id"),
  deletedAt: timestamp("deleted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CareEntryTombstone = typeof careEntryTombstonesTable.$inferSelect;
