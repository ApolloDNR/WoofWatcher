import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { householdsTable } from "./households";

// Append-only care log entries. Stored as individual rows so concurrent
// caregivers logging at the same time never clobber each other.
export type CareEntryDetails = Record<string, unknown>;

export const careEntriesTable = pgTable("care_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => householdsTable.id, { onDelete: "cascade" }),
  petId: text("pet_id"),
  type: text("type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  caregiverUserId: text("caregiver_user_id"),
  caregiverName: text("caregiver_name"),
  mood: text("mood"),
  severity: text("severity"),
  note: text("note"),
  details: jsonb("details").$type<CareEntryDetails>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CareEntry = typeof careEntriesTable.$inferSelect;

export const careEntryTombstonesTable = pgTable("care_entry_tombstones", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => householdsTable.id, { onDelete: "cascade" }),
  entryId: uuid("entry_id").notNull(),
  petId: text("pet_id"),
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
