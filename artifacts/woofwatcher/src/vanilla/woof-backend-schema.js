import { normalizeState } from "./woof-core.js";
import { createAuditEvent } from "./woof-operations.js";

export const BACKEND_SCHEMA_VERSION = "2026-06-05.v1";

export function buildBackendSchemaPlan(options = {}, now = new Date().toISOString()) {
  const provider = cleanText(options.provider, 80) || "provider_neutral";
  const generatedAt = normalizeTimestamp(now);

  return {
    packageType: "woofwatcher.backend-schema-plan",
    version: BACKEND_SCHEMA_VERSION,
    generatedAt,
    provider,
    status: "schema_plan_only",
    tables: [
      table("households", "Private household workspace and sync boundary.", [
        column("id", "text", { primaryKey: true }),
        column("name", "text"),
        column("privacy_mode", "text"),
        column("timezone", "text"),
        column("created_at", "timestamptz"),
        column("updated_at", "timestamptz")
      ]),
      table("members", "People invited into the household and their permission roles.", [
        column("id", "text", { primaryKey: true }),
        column("household_id", "text", { references: "households.id" }),
        column("display_name", "text"),
        column("role", "text"),
        column("scopes", "jsonb"),
        column("invite_status", "text"),
        column("created_at", "timestamptz"),
        column("updated_at", "timestamptz")
      ]),
      table("pets", "Phoenix profile, care focus, diet profile, and non-secret pet settings.", [
        column("id", "text", { primaryKey: true }),
        column("household_id", "text", { references: "households.id" }),
        column("name", "text"),
        column("breed", "text"),
        column("profile_json", "jsonb", { private: true }),
        column("diet_profile_json", "jsonb", { private: true }),
        column("created_at", "timestamptz"),
        column("updated_at", "timestamptz")
      ]),
      table("care_entries", "Append-friendly care log rows for meals, walks, training, bile, health, and notes.", [
        column("id", "text", { primaryKey: true }),
        column("household_id", "text", { references: "households.id" }),
        column("pet_id", "text", { references: "pets.id" }),
        column("type", "text"),
        column("title", "text"),
        column("caregiver_name", "text"),
        column("occurred_at", "timestamptz"),
        column("requires_follow_up", "boolean"),
        column("severity", "text"),
        column("data_json", "jsonb", { private: true }),
        column("created_at", "timestamptz"),
        column("updated_at", "timestamptz")
      ]),
      table("routines", "Daily care schedule, ownership, and reminder source rows.", [
        column("id", "text", { primaryKey: true }),
        column("household_id", "text", { references: "households.id" }),
        column("pet_id", "text", { references: "pets.id" }),
        column("label", "text"),
        column("type", "text"),
        column("time_label", "text"),
        column("owner_name", "text"),
        column("note", "text", { private: true }),
        column("sort_order", "integer"),
        column("updated_at", "timestamptz")
      ]),
      table("records", "Vet, vaccine, medication, microchip, instruction, and weight records.", [
        column("id", "text", { primaryKey: true }),
        column("household_id", "text", { references: "households.id" }),
        column("pet_id", "text", { references: "pets.id" }),
        column("type", "text"),
        column("title", "text"),
        column("due", "text"),
        column("note", "text", { private: true }),
        column("updated_at", "timestamptz")
      ]),
      table("goals", "Weight, training, anxiety, social, health, and custom milestones.", [
        column("id", "text", { primaryKey: true }),
        column("household_id", "text", { references: "households.id" }),
        column("pet_id", "text", { references: "pets.id" }),
        column("category", "text"),
        column("title", "text"),
        column("target", "text"),
        column("status", "text"),
        column("due", "text"),
        column("note", "text", { private: true }),
        column("updated_at", "timestamptz")
      ]),
      table("care_passes", "Scoped external share packages such as vet, sitter, trainer, emergency, or weekend.", [
        column("id", "text", { primaryKey: true }),
        column("household_id", "text", { references: "households.id" }),
        column("pet_id", "text", { references: "pets.id" }),
        column("audience", "text"),
        column("package_json", "jsonb", { private: true }),
        column("expires_at", "timestamptz", { nullable: true }),
        column("created_by", "text"),
        column("created_at", "timestamptz")
      ]),
      table("audit_events", "Append-only proof for exports, imports, sync planning, destructive changes, and scheduled nudges.", [
        column("id", "text", { primaryKey: true }),
        column("household_id", "text", { references: "households.id" }),
        column("action", "text"),
        column("resource_type", "text"),
        column("resource_id", "text"),
        column("actor", "text"),
        column("summary", "text"),
        column("privacy_level", "text"),
        column("metadata_json", "jsonb", { private: true }),
        column("created_at", "timestamptz")
      ]),
      table("nudge_jobs", "Hosted reminder jobs for future push, email, or SMS providers.", [
        column("id", "text", { primaryKey: true }),
        column("household_id", "text", { references: "households.id" }),
        column("routine_id", "text", { references: "routines.id", nullable: true }),
        column("status", "text"),
        column("priority", "text"),
        column("scheduled_for", "timestamptz"),
        column("delivery_channel", "text"),
        column("message", "text", { private: true }),
        column("created_at", "timestamptz"),
        column("updated_at", "timestamptz")
      ]),
      table("report_artifacts", "Generated monthly report artifacts and PDF/text export metadata.", [
        column("id", "text", { primaryKey: true }),
        column("household_id", "text", { references: "households.id" }),
        column("pet_id", "text", { references: "pets.id" }),
        column("format", "text"),
        column("filename", "text"),
        column("checksum", "text"),
        column("artifact_json", "jsonb", { private: true }),
        column("created_by", "text"),
        column("created_at", "timestamptz")
      ])
    ],
    indexes: [
      index("members_household_idx", "members", ["household_id"]),
      index("pets_household_idx", "pets", ["household_id"]),
      index("care_entries_pet_time_idx", "care_entries", ["pet_id", "occurred_at"]),
      index("audit_events_household_time_idx", "audit_events", ["household_id", "created_at"]),
      index("nudge_jobs_household_schedule_idx", "nudge_jobs", ["household_id", "scheduled_for"]),
      index("report_artifacts_pet_time_idx", "report_artifacts", ["pet_id", "created_at"])
    ],
    rlsPolicies: [
      policy("households", "Household members can read only households they belong to."),
      policy("members", "Household owners can manage members; invited members can read their own membership."),
      policy("pets", "Household members can read pets for households they belong to."),
      policy("care_entries", "Household members with entry scopes can read or create Phoenix care entries."),
      policy("records", "Records require records_read or records_write scope because they can include medical context."),
      policy("care_passes", "Care Pass rows are owner-managed and scoped by audience before sharing externally."),
      policy("audit_events", "Audit events are append-only and readable by owners for accountability."),
      policy("nudge_jobs", "Nudge jobs require household membership and provider consent before delivery."),
      policy("report_artifacts", "Report artifacts are private household data and should not be public by default.")
    ],
    migrationSteps: [
      "Create tables in dependency order: households, members, pets, routines, records, goals, care_entries, care_passes, audit_events, nudge_jobs, report_artifacts.",
      "Enable row-level security or equivalent access control before inserting private Phoenix data.",
      "Create indexes for household membership, pet timelines, audit timelines, nudge schedules, and report artifact lookup.",
      "Seed one private household, Phoenix profile, current caregivers, routines, records, goals, and care entries from a reviewed local backup.",
      "Run read-only verification that every row belongs to the intended household before enabling sync."
    ],
    syncPolicy: {
      localFirst: true,
      profileConflict: "newest_edit_wins_after_audit",
      scheduleConflict: "newest_edit_wins_after_audit",
      appendOnlyResources: ["care_entries", "care_passes", "audit_events", "report_artifacts"],
      destructiveChanges: "write audit_events before deleting or archiving user-visible records"
    },
    secretPolicy: [
      "Keep model/provider keys server-side only.",
      "Never ship privileged database credentials to client JavaScript.",
      "Store caregiver invites as pending records until real auth and expiry are implemented.",
      "Keep Phoenix-specific data private unless Apollo explicitly approves a public demo split."
    ],
    deploymentGates: [
      "Backend provider selected.",
      "Auth provider selected.",
      "Access policies enabled and verified.",
      "Local backup seed reviewed by Apollo.",
      "Hosted sync smoke proves rows are private to the household.",
      "Push/email/SMS provider consent path implemented before closed-app nudges."
    ]
  };
}

export function buildBackendSeedDraft(input = {}, options = {}, now = new Date().toISOString()) {
  const state = normalizeState(input, now);
  const petName = resolvePetName(state.profile.name);
  const profile = {
    ...state.profile,
    name: petName,
    publicLabel: petName
  };
  const householdId = cleanText(options.householdId, 120);
  const petId = cleanText(options.petId, 120) || `pet_${slugify(petName)}`;
  const actor = cleanText(options.actor, 80) || "local_caregiver";
  const generatedAt = normalizeTimestamp(now);
  const blockers = [];

  if (!householdId) blockers.push("Create a household id before preparing backend seed rows.");

  const rows = blockers.length
    ? emptyRows()
    : {
        households: [
          {
            id: householdId,
            name: `${petName} household`,
            privacy_mode: "private_phoenix",
            timezone: cleanText(options.timezone, 80) || "America/Los_Angeles",
            created_at: normalizeTimestamp(state.createdAt || now),
            updated_at: generatedAt
          }
        ],
        members: (state.caregivers || []).map((caregiver, index) => ({
          id: `member_${slugify(caregiver.name || `caregiver_${index + 1}`)}_${index + 1}`,
          household_id: householdId,
          display_name: caregiver.name || "Caregiver",
          role: index === 0 || /apollo/i.test(caregiver.name || "") ? "owner" : "caregiver",
          scopes: index === 0 || /apollo/i.test(caregiver.name || "") ? ["owner"] : ["caregiver"],
          invite_status: "local_seed",
          created_at: generatedAt,
          updated_at: generatedAt
        })),
        pets: [
          {
            id: petId,
            household_id: householdId,
            name: petName,
            breed: profile.breed,
            profile_json: profile,
            diet_profile_json: state.dietProfile,
            created_at: normalizeTimestamp(state.createdAt || now),
            updated_at: generatedAt
          }
        ],
        care_entries: (state.entries || []).map((entry) => ({
          id: entry.id,
          household_id: householdId,
          pet_id: petId,
          type: entry.type,
          title: entry.title,
          caregiver_name: entry.caregiver,
          occurred_at: normalizeTimestamp(entry.occurredAt || now),
          requires_follow_up: Boolean(entry.requiresFollowUp),
          severity: entry.severity || "normal",
          data_json: entry,
          created_at: generatedAt,
          updated_at: generatedAt
        })),
        routines: (state.routines || []).map((routine, index) => ({
          id: routine.id,
          household_id: householdId,
          pet_id: petId,
          label: routine.label,
          type: routine.type,
          time_label: routine.time,
          owner_name: routine.owner,
          note: routine.note,
          sort_order: index,
          updated_at: generatedAt
        })),
        records: (state.records || []).map((record) => ({
          id: record.id,
          household_id: householdId,
          pet_id: petId,
          type: record.type,
          title: record.title,
          due: record.due,
          note: record.note,
          updated_at: generatedAt
        })),
        goals: (state.goals || []).map((goal) => ({
          id: goal.id,
          household_id: householdId,
          pet_id: petId,
          category: goal.category,
          title: goal.title,
          target: goal.target,
          status: goal.status,
          due: goal.due,
          note: goal.note,
          updated_at: generatedAt
        })),
        care_passes: [],
        audit_events: [],
        nudge_jobs: [],
        report_artifacts: []
      };

  const rowCounts = Object.fromEntries(Object.entries(rows).map(([name, values]) => [name, values.length]));
  const auditEvent = createAuditEvent(
    {
      action: "sync_plan",
      resourceType: "household",
      resourceId: householdId || "missing_household",
      actor,
      summary: blockers.length
        ? "Backend seed draft blocked until household id exists"
        : `Prepared backend seed draft for ${petName}`,
      privacyLevel: "system_private",
      metadata: {
        status: blockers.length ? "blocked" : "ready_to_review",
        rowCounts
      }
    },
    now
  );

  if (!blockers.length) {
    rows.audit_events.push(toAuditRow(auditEvent, householdId));
    rowCounts.audit_events = rows.audit_events.length;
  }

  return {
    packageType: "woofwatcher.backend-seed-draft",
    version: BACKEND_SCHEMA_VERSION,
    generatedAt,
    status: blockers.length ? "blocked" : "ready_to_review",
    applied: false,
    household: {
      id: householdId,
      label: householdId ? `${petName} household` : ""
    },
    pet: {
      id: blockers.length ? "" : petId,
      name: petName
    },
    rowCounts,
    rows,
    auditEvent,
    blockers,
    boundary: "Seed drafts are review packages only. They do not apply database writes, create accounts, or enable sync."
  };
}

function table(name, description, columns) {
  return { name, description, columns };
}

function column(name, type, options = {}) {
  return {
    name,
    type,
    nullable: Boolean(options.nullable),
    primaryKey: Boolean(options.primaryKey),
    references: cleanText(options.references, 120),
    private: Boolean(options.private)
  };
}

function index(name, tableName, columns) {
  return { name, table: tableName, columns };
}

function policy(tableName, summary) {
  return { table: tableName, summary };
}

function emptyRows() {
  return {
    households: [],
    members: [],
    pets: [],
    care_entries: [],
    routines: [],
    records: [],
    goals: [],
    care_passes: [],
    audit_events: [],
    nudge_jobs: [],
    report_artifacts: []
  };
}

function toAuditRow(event, householdId) {
  return {
    id: event.id,
    household_id: householdId,
    action: event.action,
    resource_type: event.resourceType,
    resource_id: event.resourceId,
    actor: event.actor,
    summary: event.summary,
    privacy_level: event.privacyLevel,
    metadata_json: event.metadata,
    created_at: event.createdAt
  };
}

function normalizeTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function slugify(value) {
  return cleanText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "item";
}

function cleanText(value, maxLength = 500) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function resolvePetName(value) {
  const name = cleanText(value, 120);
  return !name || name.toLowerCase() === "my dog" ? "Phoenix" : name;
}
