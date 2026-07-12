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
  careEntryProviderSyncEvidence?: readonly CareEntryProviderSyncEvidenceFile[];
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

export type CareEntryProviderSyncEvidenceKind =
  | "supabase-project"
  | "migration-backfill"
  | "active-household-rls"
  | "retention-export-deletion"
  | "dependency-complete-build"
  | "mobile-incremental-signoff";

export interface CareEntryProviderSyncEvidenceFile {
  kind: CareEntryProviderSyncEvidenceKind;
  fileName?: string | null;
  uri?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  supabaseProjectId?: string | null;
  environmentName?: string | null;
  deploymentTarget?: string | null;
  databaseHost?: string | null;
  projectOwner?: string | null;
  productionProjectConfirmed?: boolean | null;
  careEntriesUpdatedAtMigrationId?: string | null;
  tombstoneMigrationId?: string | null;
  updatedAtBackfillVerifiedAt?: string | null;
  backfillRowCount?: string | null;
  migrationAppliedAt?: string | null;
  existingRowsBackfilled?: boolean | null;
  cursorRlsPolicyName?: string | null;
  tombstoneRlsPolicyName?: string | null;
  activeHouseholdClaim?: string | null;
  crossHouseholdCursorReadDeniedProof?: string | null;
  crossHouseholdTombstoneReadDeniedProof?: string | null;
  cursorRlsVerified?: boolean | null;
  tombstoneRlsVerified?: boolean | null;
  backupPolicyReference?: string | null;
  retentionPolicyReference?: string | null;
  exportPolicyReference?: string | null;
  deletionPolicyReference?: string | null;
  tombstoneRetentionRule?: string | null;
  privacyApproved?: boolean | null;
  exportDeletionApproved?: boolean | null;
  dependencyCompleteBuildUrl?: string | null;
  verifyRunId?: string | null;
  apiRouteTestReference?: string | null;
  generatedClientReference?: string | null;
  mobileSmokeReference?: string | null;
  apiTestsPassed?: boolean | null;
  generatedClientsSynced?: boolean | null;
  mobileSmokePassed?: boolean | null;
  mobileSignoffOwner?: string | null;
  fullRefreshFallbackPlan?: string | null;
  incrementalAdoptionPlan?: string | null;
  nativeQaEvidenceReference?: string | null;
  rollbackPlanReference?: string | null;
  fullRefreshRemainsDefault?: boolean | null;
  nativeQaRequiredBeforeIncremental?: boolean | null;
  rollbackPlanApproved?: boolean | null;
}

export const CARE_ENTRY_PROVIDER_SYNC_PROOF_ITEMS: readonly CareEntryProviderSyncProofItemDefinition[] = [
  {
    key: "supabase-project",
    label: "Supabase project",
    owner: "Developer",
    requiredEvidence:
      "Supabase project id proof file with environment name, active deployment target, database host, owner, production confirmation, MIME, and byte size for the production household database.",
    sourceFiles: ["lib/db/src/schema/careEntries.ts", "artifacts/api-server/src/routes/care-entries-router.ts"],
  },
  {
    key: "migration-backfill",
    label: "Migration/backfill",
    owner: "Developer",
    requiredEvidence:
      "migration/backfill proof file with applied care_entries.updated_at and care_entry_tombstones migration ids, applied timestamp, backfill row count, backfill verification timestamp, MIME, and byte size.",
    sourceFiles: ["lib/db/src/schema/careEntries.ts", "lib/api-spec/openapi.yaml"],
  },
  {
    key: "active-household-rls",
    label: "Active-household RLS",
    owner: "Developer / privacy",
    requiredEvidence:
      "active-household RLS proof file showing cursor and tombstone policy names for /care-entries?updatedSince= and /care-entries/tombstones?updatedSince=, active-household claim, denied cross-household cursor/tombstone reads, MIME, byte size, and verified cursor/tombstone RLS booleans.",
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
      "retention/export/deletion proof file with backup, retention, export, deletion, tombstone-retention rules, privacy approval, export/deletion approval, MIME, and byte size.",
    sourceFiles: ["lib/db/src/schema/careEntries.ts", "artifacts/woofwatcher-mobile/app/(tabs)/privacy.tsx"],
  },
  {
    key: "dependency-complete-build",
    label: "Dependency-complete build",
    owner: "Developer",
    requiredEvidence:
      "dependency-complete build proof file with CI URL, run id, API route test reference, generated-client reference, mobile smoke reference, passing booleans, MIME, and byte size.",
    sourceFiles: ["package.json", ".github/workflows/verify.yml", "artifacts/api-server/test/careEntryRoutes.test.ts"],
  },
  {
    key: "mobile-incremental-signoff",
    label: "Mobile incremental sign-off",
    owner: "Developer / QA",
    requiredEvidence:
      "mobile incremental sign-off proof file with sign-off owner, full-refresh fallback plan, incremental adoption plan, native QA reference, rollback plan, full-refresh default, native-QA-required, rollback-approved booleans, MIME, and byte size.",
    sourceFiles: ["artifacts/woofwatcher-mobile/lib/careSync.ts", "artifacts/woofwatcher-mobile/context/CareContext.tsx"],
  },
];

export const CARE_ENTRY_PROVIDER_SYNC_PROOF_SUMMARY =
  "Supabase project id, Care-entry provider sync proof packet with migration/backfill for care_entries.updated_at and care_entry_tombstones, active-household RLS for /care-entries?updatedSince= and /care-entries/tombstones?updatedSince=, backup plus retention/export/deletion policy, dependency-complete build proof, and mobile full-refresh sign-off until incremental adoption is verified.";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: unknown): string {
  return clean(value).toLowerCase();
}

function hasPositiveByteSize(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasProofMime(value: unknown): boolean {
  const mime = normalize(value);
  return (
    mime === "application/json" ||
    mime.endsWith("+json") ||
    mime === "text/markdown" ||
    mime === "text/plain" ||
    mime === "application/pdf"
  );
}

function cleanList(value: readonly string[] | null | undefined): string[] {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
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

type CareEntryProviderSyncTextField = keyof Pick<
  CareEntryProviderSyncEvidenceFile,
  | "supabaseProjectId"
  | "environmentName"
  | "deploymentTarget"
  | "databaseHost"
  | "projectOwner"
  | "careEntriesUpdatedAtMigrationId"
  | "tombstoneMigrationId"
  | "updatedAtBackfillVerifiedAt"
  | "backfillRowCount"
  | "migrationAppliedAt"
  | "cursorRlsPolicyName"
  | "tombstoneRlsPolicyName"
  | "activeHouseholdClaim"
  | "crossHouseholdCursorReadDeniedProof"
  | "crossHouseholdTombstoneReadDeniedProof"
  | "backupPolicyReference"
  | "retentionPolicyReference"
  | "exportPolicyReference"
  | "deletionPolicyReference"
  | "tombstoneRetentionRule"
  | "dependencyCompleteBuildUrl"
  | "verifyRunId"
  | "apiRouteTestReference"
  | "generatedClientReference"
  | "mobileSmokeReference"
  | "mobileSignoffOwner"
  | "fullRefreshFallbackPlan"
  | "incrementalAdoptionPlan"
  | "nativeQaEvidenceReference"
  | "rollbackPlanReference"
>;

type CareEntryProviderSyncBooleanField = keyof Pick<
  CareEntryProviderSyncEvidenceFile,
  | "productionProjectConfirmed"
  | "existingRowsBackfilled"
  | "cursorRlsVerified"
  | "tombstoneRlsVerified"
  | "privacyApproved"
  | "exportDeletionApproved"
  | "apiTestsPassed"
  | "generatedClientsSynced"
  | "mobileSmokePassed"
  | "fullRefreshRemainsDefault"
  | "nativeQaRequiredBeforeIncremental"
  | "rollbackPlanApproved"
>;

interface CareEntryProviderSyncEvidenceRequirement {
  kind: CareEntryProviderSyncEvidenceKind;
  locatorTokens: readonly string[];
  textFields: readonly CareEntryProviderSyncTextField[];
  booleanFields: readonly CareEntryProviderSyncBooleanField[];
  readyLabel: string;
}

const CARE_ENTRY_PROVIDER_SYNC_EVIDENCE_REQUIREMENTS: readonly CareEntryProviderSyncEvidenceRequirement[] = [
  {
    kind: "supabase-project",
    locatorTokens: ["supabase", "project"],
    textFields: ["supabaseProjectId", "environmentName", "deploymentTarget", "databaseHost", "projectOwner"],
    booleanFields: ["productionProjectConfirmed"],
    readyLabel: "Supabase production project proof ready",
  },
  {
    kind: "migration-backfill",
    locatorTokens: ["migration", "backfill"],
    textFields: [
      "careEntriesUpdatedAtMigrationId",
      "tombstoneMigrationId",
      "updatedAtBackfillVerifiedAt",
      "backfillRowCount",
      "migrationAppliedAt",
    ],
    booleanFields: ["existingRowsBackfilled"],
    readyLabel: "Care-entry migration and backfill proof ready",
  },
  {
    kind: "active-household-rls",
    locatorTokens: ["active-household", "rls"],
    textFields: [
      "cursorRlsPolicyName",
      "tombstoneRlsPolicyName",
      "activeHouseholdClaim",
      "crossHouseholdCursorReadDeniedProof",
      "crossHouseholdTombstoneReadDeniedProof",
    ],
    booleanFields: ["cursorRlsVerified", "tombstoneRlsVerified"],
    readyLabel: "Active-household cursor and tombstone RLS proof ready",
  },
  {
    kind: "retention-export-deletion",
    locatorTokens: ["retention", "export", "deletion"],
    textFields: [
      "backupPolicyReference",
      "retentionPolicyReference",
      "exportPolicyReference",
      "deletionPolicyReference",
      "tombstoneRetentionRule",
    ],
    booleanFields: ["privacyApproved", "exportDeletionApproved"],
    readyLabel: "Retention, export, and deletion policy proof ready",
  },
  {
    kind: "dependency-complete-build",
    locatorTokens: ["dependency", "build"],
    textFields: ["dependencyCompleteBuildUrl", "verifyRunId", "apiRouteTestReference", "generatedClientReference", "mobileSmokeReference"],
    booleanFields: ["apiTestsPassed", "generatedClientsSynced", "mobileSmokePassed"],
    readyLabel: "Dependency-complete build proof ready",
  },
  {
    kind: "mobile-incremental-signoff",
    locatorTokens: ["mobile", "incremental", "signoff"],
    textFields: [
      "mobileSignoffOwner",
      "fullRefreshFallbackPlan",
      "incrementalAdoptionPlan",
      "nativeQaEvidenceReference",
      "rollbackPlanReference",
    ],
    booleanFields: ["fullRefreshRemainsDefault", "nativeQaRequiredBeforeIncremental", "rollbackPlanApproved"],
    readyLabel: "Mobile incremental sign-off proof ready",
  },
];

function evidenceMatchesRequirement(
  evidence: CareEntryProviderSyncEvidenceFile,
  requirement: CareEntryProviderSyncEvidenceRequirement,
): boolean {
  const locator = `${normalize(evidence.fileName)} ${normalize(evidence.uri)}`;
  return (
    evidence.kind === requirement.kind &&
    requirement.locatorTokens.every((token) => locator.includes(token)) &&
    hasProofMime(evidence.mimeType) &&
    hasPositiveByteSize(evidence.byteSize) &&
    requirement.textFields.every((field) => clean(evidence[field]).length > 0) &&
    requirement.booleanFields.every((field) => evidence[field] === true)
  );
}

export function formatCareEntryProviderSyncProofChecklist(): string[] {
  return CARE_ENTRY_PROVIDER_SYNC_PROOF_ITEMS.map((item) => `${item.label}: ${item.requiredEvidence}`);
}

export function deriveCareEntryProviderSyncProof(
  input: CareEntryProviderSyncProofEvidence | null | undefined,
): CareEntryProviderSyncProofPlan {
  const evidence = input ?? {};
  const attachedEvidence = evidence.careEntryProviderSyncEvidence ?? [];
  const items = CARE_ENTRY_PROVIDER_SYNC_PROOF_ITEMS.map<CareEntryProviderSyncProofItem>((definition, index) => {
    const requirement = CARE_ENTRY_PROVIDER_SYNC_EVIDENCE_REQUIREMENTS[index];
    const matched = requirement
      ? attachedEvidence.find((candidate) => evidenceMatchesRequirement(candidate, requirement))
      : undefined;
    const legacyNotes = evidenceForItem(definition, evidence);
    return {
      ...definition,
      status: matched ? "ready" : "blocked",
      evidenceAttached: matched && requirement ? [requirement.readyLabel, ...legacyNotes] : [],
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
      ? "All structured care-entry provider proof files are ready for provider review. Incremental care-entry sync can be reviewed against native QA before adoption."
      : "Mobile must remain on full-refresh care-entry refresh until structured provider proof files cover Supabase project setup, migrations, active-household RLS, retention/export/deletion, dependency-complete build proof, and mobile sign-off.",
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
