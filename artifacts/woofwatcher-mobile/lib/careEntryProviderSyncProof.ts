export type CareEntryProviderSyncProofKey =
  | "supabase-project"
  | "migration-backfill"
  | "active-household-rls"
  | "retention-export-deletion"
  | "dependency-complete-build"
  | "mobile-incremental-signoff";

export type CareEntryProviderSyncProofStatus = "blocked" | "ready-for-review";

export interface CareEntryProviderSyncProofEvidence {
  supabaseProjectId?: string | null;
  migrationIds?: readonly string[] | null;
  updatedAtBackfillVerifiedAt?: string | null;
  activeHouseholdCursorRlsProof?: string | null;
  activeHouseholdTombstoneRlsProof?: string | null;
  backupPolicyProof?: string | null;
  retentionExportDeletionPolicy?: string | null;
  dependencyCompleteBuildUrl?: string | null;
  mobileIncrementalAdoptionSignoff?: string | null;
}

export interface CareEntryProviderSyncProofItemDefinition {
  key: CareEntryProviderSyncProofKey;
  label: string;
  owner: string;
  requiredEvidence: string;
  sourceFiles: readonly string[];
}

export interface CareEntryProviderSyncProofItem extends CareEntryProviderSyncProofItemDefinition {
  status: "blocked" | "ready";
  evidenceAttached: readonly string[];
}

export interface CareEntryProviderSyncProofPlan {
  title: "Care-entry provider sync proof packet";
  status: CareEntryProviderSyncProofStatus;
  statusLabel: string;
  summary: string;
  readyCount: number;
  openCount: number;
  totalCount: number;
  incrementalSyncAllowed: boolean;
  items: CareEntryProviderSyncProofItem[];
  blockers: string[];
  checklist: string[];
}

export const CARE_ENTRY_PROVIDER_SYNC_PROOF_ITEMS: readonly CareEntryProviderSyncProofItemDefinition[] = [
  {
    key: "supabase-project",
    label: "Supabase project",
    owner: "Developer",
    requiredEvidence: "Supabase project id, environment name, and active deployment target for the production household database.",
    sourceFiles: ["lib/db/src/schema/careEntries.ts", "artifacts/api-server/src/routes/care-entries-router.ts"],
  },
  {
    key: "migration-backfill",
    label: "Migration/backfill",
    owner: "Developer",
    requiredEvidence:
      "Applied migration ids for care_entries.updated_at and care_entry_tombstones, plus a backfill timestamp proving existing care_entries rows have non-null updated_at values.",
    sourceFiles: ["lib/db/src/schema/careEntries.ts", "lib/api-spec/openapi.yaml"],
  },
  {
    key: "active-household-rls",
    label: "Active-household RLS",
    owner: "Developer / privacy",
    requiredEvidence:
      "RLS read proof that /care-entries?updatedSince= and /care-entries/tombstones?updatedSince= only return rows for the authenticated active household.",
    sourceFiles: [
      "artifacts/api-server/src/routes/care-entries-router.ts",
      "artifacts/api-server/src/lib/auth.ts",
      "lib/api-client-react/src/generated/api.ts",
    ],
  },
  {
    key: "retention-export-deletion",
    label: "Retention/export/deletion",
    owner: "Developer / privacy",
    requiredEvidence:
      "Backup policy plus retention/export/deletion policy for care_entries and care_entry_tombstones, including tombstone retention rules.",
    sourceFiles: ["lib/db/src/schema/careEntries.ts", "artifacts/woofwatcher-mobile/app/(tabs)/privacy.tsx"],
  },
  {
    key: "dependency-complete-build",
    label: "Dependency-complete build",
    owner: "Developer",
    requiredEvidence:
      "Dependency-complete CI or pinned pnpm 10.24.0 build URL proving the API build, route tests, generated clients, and mobile smoke path passed with provider contracts present.",
    sourceFiles: ["package.json", ".github/workflows/verify.yml", "artifacts/api-server/test/careEntryRoutes.test.ts"],
  },
  {
    key: "mobile-incremental-signoff",
    label: "Mobile incremental sign-off",
    owner: "Developer / QA",
    requiredEvidence:
      "Mobile full-refresh sign-off until provider proof is attached, followed by native QA evidence before enabling incremental care-entry refresh.",
    sourceFiles: ["artifacts/woofwatcher-mobile/lib/careSync.ts", "artifacts/woofwatcher-mobile/context/CareContext.tsx"],
  },
];

export const CARE_ENTRY_PROVIDER_SYNC_PROOF_SUMMARY =
  "Supabase project id, Care-entry provider sync proof packet with migration/backfill for care_entries.updated_at and care_entry_tombstones, active-household RLS for /care-entries?updatedSince= and /care-entries/tombstones?updatedSince=, backup plus retention/export/deletion policy, dependency-complete build proof, and mobile full-refresh sign-off until incremental adoption is verified.";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanList(value: readonly string[] | null | undefined): string[] {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}

function hasMigrationEvidence(evidence: CareEntryProviderSyncProofEvidence): boolean {
  const migrationIds = cleanList(evidence.migrationIds);
  const hasUpdatedAtMigration = migrationIds.some((id) => /care_entries.*updated_at|updated_at.*care_entries/i.test(id));
  const hasTombstoneMigration = migrationIds.some((id) => /care_entry_tombstones/i.test(id));
  return hasUpdatedAtMigration && hasTombstoneMigration && Boolean(clean(evidence.updatedAtBackfillVerifiedAt));
}

function evidenceForItem(
  definition: CareEntryProviderSyncProofItemDefinition,
  evidence: CareEntryProviderSyncProofEvidence,
): string[] {
  switch (definition.key) {
    case "supabase-project":
      return [clean(evidence.supabaseProjectId)].filter(Boolean);
    case "migration-backfill":
      return [...cleanList(evidence.migrationIds), clean(evidence.updatedAtBackfillVerifiedAt)].filter(Boolean);
    case "active-household-rls":
      return [clean(evidence.activeHouseholdCursorRlsProof), clean(evidence.activeHouseholdTombstoneRlsProof)].filter(Boolean);
    case "retention-export-deletion":
      return [clean(evidence.backupPolicyProof), clean(evidence.retentionExportDeletionPolicy)].filter(Boolean);
    case "dependency-complete-build":
      return [clean(evidence.dependencyCompleteBuildUrl)].filter(Boolean);
    case "mobile-incremental-signoff":
      return [clean(evidence.mobileIncrementalAdoptionSignoff)].filter(Boolean);
  }
}

function itemReady(
  definition: CareEntryProviderSyncProofItemDefinition,
  evidence: CareEntryProviderSyncProofEvidence,
): boolean {
  switch (definition.key) {
    case "supabase-project":
      return Boolean(clean(evidence.supabaseProjectId));
    case "migration-backfill":
      return hasMigrationEvidence(evidence);
    case "active-household-rls":
      return Boolean(clean(evidence.activeHouseholdCursorRlsProof) && clean(evidence.activeHouseholdTombstoneRlsProof));
    case "retention-export-deletion":
      return Boolean(clean(evidence.backupPolicyProof) && clean(evidence.retentionExportDeletionPolicy));
    case "dependency-complete-build":
      return Boolean(clean(evidence.dependencyCompleteBuildUrl));
    case "mobile-incremental-signoff":
      return Boolean(clean(evidence.mobileIncrementalAdoptionSignoff));
  }
}

export function formatCareEntryProviderSyncProofChecklist(): string[] {
  return CARE_ENTRY_PROVIDER_SYNC_PROOF_ITEMS.map((item) => `${item.label}: ${item.requiredEvidence}`);
}

export function deriveCareEntryProviderSyncProof(
  input: CareEntryProviderSyncProofEvidence | null | undefined,
): CareEntryProviderSyncProofPlan {
  const evidence = input ?? {};
  const items = CARE_ENTRY_PROVIDER_SYNC_PROOF_ITEMS.map<CareEntryProviderSyncProofItem>((definition) => {
    const ready = itemReady(definition, evidence);
    return {
      ...definition,
      status: ready ? "ready" : "blocked",
      evidenceAttached: evidenceForItem(definition, evidence),
    };
  });
  const readyCount = items.filter((item) => item.status === "ready").length;
  const totalCount = items.length;
  const openCount = totalCount - readyCount;
  const incrementalSyncAllowed = openCount === 0;
  const status: CareEntryProviderSyncProofStatus = incrementalSyncAllowed ? "ready-for-review" : "blocked";

  return {
    title: "Care-entry provider sync proof packet",
    status,
    statusLabel: incrementalSyncAllowed ? "Ready for provider review" : "Blocked on provider proof",
    summary: incrementalSyncAllowed
      ? "All care-entry provider proof is attached and ready for provider review. Incremental care-entry sync can be reviewed against native QA before adoption."
      : "Mobile must remain on full-refresh care-entry refresh until provider proof covers migrations, active-household RLS, retention/export/deletion, dependency-complete build proof, and mobile sign-off.",
    readyCount,
    openCount,
    totalCount,
    incrementalSyncAllowed,
    items,
    blockers: items.filter((item) => item.status === "blocked").map((item) => `${item.label}: ${item.requiredEvidence}`),
    checklist: formatCareEntryProviderSyncProofChecklist(),
  };
}

export function buildCareEntryProviderSyncProofShareText(
  plan: CareEntryProviderSyncProofPlan,
  generatedAtIso = new Date().toISOString(),
): string {
  return [
    plan.title,
    `Generated: ${generatedAtIso}`,
    `Status: ${plan.statusLabel}`,
    `Progress: ${plan.readyCount}/${plan.totalCount} proof items ready`,
    `Incremental sync allowed: ${plan.incrementalSyncAllowed ? "Yes" : "No"}`,
    "",
    plan.summary,
    "",
    "Proof items:",
    ...plan.items.flatMap((item) => [
      `- ${item.label}: ${item.status === "ready" ? "Ready" : "Blocked"}`,
      `  Required: ${item.requiredEvidence}`,
      `  Source: ${item.sourceFiles.join(", ")}`,
      `  Evidence: ${item.evidenceAttached.length ? item.evidenceAttached.join("; ") : "Not attached"}`,
    ]),
    "",
    "Mobile must remain on full-refresh care-entry refresh until every proof item is attached and native QA signs off.",
    "This proof packet does not approve App Store, Play Store, storage, AI, payments, push, or public launch.",
  ].join("\n");
}
