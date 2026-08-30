import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
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
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    caregiverUserId: text("caregiver_user_id"),
    caregiverName: text("caregiver_name"),
    // Explicit privacy authority. `details.householdVisible` remains in the
    // client payload for backwards compatibility, while this typed column is
    // what every server-side access predicate uses.
    householdVisible: boolean("household_visible").notNull().default(true),
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
  },
  (t) => [
    check(
      "care_entries_visibility_details_match",
      sql`${t.householdVisible} = case
        when not (coalesce(${t.details}, '{}'::jsonb) ? 'householdVisible')
          then true
        when jsonb_typeof(${t.details} -> 'householdVisible') = 'boolean'
          then (${t.details} ->> 'householdVisible')::boolean
        else false
      end`,
    ),
    check(
      "care_entries_private_creator_required",
      sql`${t.householdVisible} or ${t.caregiverUserId} is not null`,
    ),
    uniqueIndex("care_entries_household_creator_client_key_uidx")
      .on(
        t.householdId,
        t.caregiverUserId,
        sql`(${t.details} ->> 'clientKey')`,
      )
      .where(
        sql`${t.caregiverUserId} is not null and ${t.details} ->> 'clientKey' is not null`,
      ),
  ],
);

export type CareEntry = typeof careEntriesTable.$inferSelect;

export const careEntryTombstonesTable = pgTable(
  "care_entry_tombstones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => householdsTable.id, { onDelete: "cascade" }),
    // A delete intent that wins before POST commits has no live row id yet.
    // That creator-private tombstone receives a random UUID; its clientKey is
    // the authoritative revocation identity and no Care row is synthesized.
    entryId: uuid("entry_id").notNull(),
    petId: text("pet_id"),
    // Preserve the original entry creator and visibility after deletion so a
    // private delete can sync across that creator's devices without becoming a
    // household-wide existence leak.
    caregiverUserId: text("caregiver_user_id").notNull(),
    householdVisible: boolean("household_visible").notNull().default(false),
    // A deleted idempotent create stays deleted across every device. This is
    // deliberately creator-scoped; another household member may reuse the same
    // opaque local key without learning that this tombstone exists.
    clientKey: text("client_key"),
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
  },
  (t) => [
    uniqueIndex("care_entry_tombstones_household_creator_client_key_uidx")
      .on(t.householdId, t.caregiverUserId, t.clientKey)
      .where(sql`${t.clientKey} is not null`),
  ],
);

export type CareEntryTombstone = typeof careEntryTombstonesTable.$inferSelect;
