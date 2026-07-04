import { test } from "node:test";
import assert from "node:assert/strict";

test("builds a blocked care-entry provider sync proof packet from missing evidence", async () => {
  const mod = await import("./careEntryProviderSyncProof.ts").catch(() => null);
  assert.ok(mod, "careEntryProviderSyncProof module should exist");

  const plan = mod.deriveCareEntryProviderSyncProof({});

  assert.equal(plan.title, "Care-entry provider sync proof packet");
  assert.equal(plan.status, "blocked");
  assert.equal(plan.incrementalSyncAllowed, false);
  assert.ok(plan.openCount > 0);
  assert.match(plan.summary, /full-refresh/i);
  assert.match(plan.summary, /provider proof/i);
  assert.ok(plan.items.some((item) => item.key === "supabase-project" && /Supabase project id/i.test(item.requiredEvidence)));
  assert.ok(plan.items.some((item) => item.key === "migration-backfill" && /care_entries\.updated_at/i.test(item.requiredEvidence)));
  assert.ok(plan.items.some((item) => item.key === "migration-backfill" && /care_entry_tombstones/i.test(item.requiredEvidence)));
  assert.ok(plan.items.some((item) => item.key === "active-household-rls" && /\/care-entries\?updatedSince=/i.test(item.requiredEvidence)));
  assert.ok(plan.items.some((item) => item.key === "active-household-rls" && /\/care-entries\/tombstones\?updatedSince=/i.test(item.requiredEvidence)));
  assert.ok(plan.items.some((item) => item.key === "retention-export-deletion" && /retention\/export\/deletion/i.test(item.requiredEvidence)));
  assert.ok(plan.items.some((item) => item.key === "mobile-incremental-signoff" && /full-refresh/i.test(item.requiredEvidence)));
  assert.ok(plan.items.some((item) => item.sourceFiles.includes("lib/db/src/schema/careEntries.ts")));
  assert.ok(plan.items.some((item) => item.sourceFiles.includes("artifacts/api-server/src/routes/care-entries-router.ts")));
  assert.ok(plan.items.some((item) => item.sourceFiles.includes("artifacts/woofwatcher-mobile/lib/careSync.ts")));
  assert.ok(plan.blockers.some((blocker) => /migration/i.test(blocker)));
  assert.ok(plan.blockers.some((blocker) => /RLS/i.test(blocker)));
});

test("marks care-entry provider sync reviewable only after every proof artifact is attached", async () => {
  const mod = await import("./careEntryProviderSyncProof.ts").catch(() => null);
  assert.ok(mod, "careEntryProviderSyncProof module should exist");

  const genericPlan = mod.deriveCareEntryProviderSyncProof({
    supabaseProjectId: "supabase-prod-woofwatcher",
    migrationIds: ["20260703_care_entries_updated_at", "20260703_care_entry_tombstones"],
    updatedAtBackfillVerifiedAt: "2026-07-03T18:00:00.000Z",
    activeHouseholdCursorRlsProof: "owner household A cannot read household B cursor rows",
    activeHouseholdTombstoneRlsProof: "owner household A cannot read household B tombstones",
    backupPolicyProof: "nightly backup policy approved",
    retentionExportDeletionPolicy: "30-day tombstone retention plus owner export/delete runbook approved",
    dependencyCompleteBuildUrl: "https://github.com/ApolloDNR/WoofWatcher/actions/runs/28649278774",
    mobileIncrementalAdoptionSignoff: "mobile kept full refresh until provider proof and native QA were attached",
  });

  assert.equal(genericPlan.status, "blocked");
  assert.equal(genericPlan.incrementalSyncAllowed, false);
  assert.equal(genericPlan.readyCount, 0);
  assert.ok(genericPlan.items.every((item) => item.status === "blocked"));
  assert.ok(genericPlan.items.every((item) => item.evidenceAttached.length === 0));

  const plan = mod.deriveCareEntryProviderSyncProof({
    supabaseProjectId: "supabase-prod-woofwatcher",
    migrationIds: ["20260703_care_entries_updated_at", "20260703_care_entry_tombstones"],
    updatedAtBackfillVerifiedAt: "2026-07-03T18:00:00.000Z",
    activeHouseholdCursorRlsProof: "owner household A cannot read household B cursor rows",
    activeHouseholdTombstoneRlsProof: "owner household A cannot read household B tombstones",
    backupPolicyProof: "nightly backup policy approved",
    retentionExportDeletionPolicy: "30-day tombstone retention plus owner export/delete runbook approved",
    dependencyCompleteBuildUrl: "https://github.com/ApolloDNR/WoofWatcher/actions/runs/28649278774",
    mobileIncrementalAdoptionSignoff: "mobile kept full refresh until provider proof and native QA were attached",
    careEntryProviderSyncEvidence: [
      {
        kind: "supabase-project",
        fileName: "supabase-project-proof.json",
        uri: "file:///provider-sync/supabase-project-proof.json",
        mimeType: "application/json",
        byteSize: 28190,
        supabaseProjectId: "supabase-prod-woofwatcher",
        environmentName: "production",
        deploymentTarget: "prod household database",
        databaseHost: "db.woofwatcher.supabase.co",
        projectOwner: "Apollo Duran",
        productionProjectConfirmed: true,
      },
      {
        kind: "migration-backfill",
        fileName: "migration-backfill-proof.json",
        uri: "file:///provider-sync/migration-backfill-proof.json",
        mimeType: "application/json",
        byteSize: 36210,
        careEntriesUpdatedAtMigrationId: "20260703_care_entries_updated_at",
        tombstoneMigrationId: "20260703_care_entry_tombstones",
        updatedAtBackfillVerifiedAt: "2026-07-03T18:00:00.000Z",
        backfillRowCount: "1482 rows",
        migrationAppliedAt: "2026-07-03T17:44:00.000Z",
        existingRowsBackfilled: true,
      },
      {
        kind: "active-household-rls",
        fileName: "active-household-rls-proof.pdf",
        uri: "file:///provider-sync/active-household-rls-proof.pdf",
        mimeType: "application/pdf",
        byteSize: 42218,
        cursorRlsPolicyName: "care_entries_active_household_cursor_read",
        tombstoneRlsPolicyName: "care_entry_tombstones_active_household_read",
        activeHouseholdClaim: "active_household_id",
        crossHouseholdCursorReadDeniedProof: "household A denied household B cursor rows",
        crossHouseholdTombstoneReadDeniedProof: "household A denied household B tombstones",
        cursorRlsVerified: true,
        tombstoneRlsVerified: true,
      },
      {
        kind: "retention-export-deletion",
        fileName: "retention-export-deletion-proof.md",
        uri: "file:///provider-sync/retention-export-deletion-proof.md",
        mimeType: "text/markdown",
        byteSize: 19450,
        backupPolicyReference: "nightly encrypted backup policy",
        retentionPolicyReference: "care-entry retention policy",
        exportPolicyReference: "owner export policy",
        deletionPolicyReference: "owner deletion policy",
        tombstoneRetentionRule: "30-day tombstone retention",
        privacyApproved: true,
        exportDeletionApproved: true,
      },
      {
        kind: "dependency-complete-build",
        fileName: "dependency-complete-build-proof.json",
        uri: "file:///provider-sync/dependency-complete-build-proof.json",
        mimeType: "application/json",
        byteSize: 26042,
        dependencyCompleteBuildUrl: "https://github.com/ApolloDNR/WoofWatcher/actions/runs/28649278774",
        verifyRunId: "28649278774",
        apiRouteTestReference: "care-entry route tests passed",
        generatedClientReference: "generated clients synced",
        mobileSmokeReference: "mobile smoke path passed",
        apiTestsPassed: true,
        generatedClientsSynced: true,
        mobileSmokePassed: true,
      },
      {
        kind: "mobile-incremental-signoff",
        fileName: "mobile-incremental-signoff-proof.pdf",
        uri: "file:///provider-sync/mobile-incremental-signoff-proof.pdf",
        mimeType: "application/pdf",
        byteSize: 31024,
        mobileSignoffOwner: "Apollo Duran",
        fullRefreshFallbackPlan: "full refresh remains default until native QA",
        incrementalAdoptionPlan: "incremental sync staged after provider proof",
        nativeQaEvidenceReference: "native care-entry sync QA packet",
        rollbackPlanReference: "rollback to full refresh",
        fullRefreshRemainsDefault: true,
        nativeQaRequiredBeforeIncremental: true,
        rollbackPlanApproved: true,
      },
    ],
  });

  assert.equal(plan.status, "ready-for-review");
  assert.equal(plan.statusLabel, "Ready for provider review");
  assert.equal(plan.openCount, 0);
  assert.equal(plan.incrementalSyncAllowed, true);
  assert.match(plan.summary, /ready for provider review/i);
  assert.ok(plan.items.every((item) => item.status === "ready"));
  assert.deepEqual(
    plan.items.map((item) => item.evidenceAttached[0]),
    [
      "Supabase production project proof ready",
      "Care-entry migration and backfill proof ready",
      "Active-household cursor and tombstone RLS proof ready",
      "Retention, export, and deletion policy proof ready",
      "Dependency-complete build proof ready",
      "Mobile incremental sign-off proof ready",
    ],
  );
});

test("formats a shareable care-entry provider sync proof packet without launch claims", async () => {
  const mod = await import("./careEntryProviderSyncProof.ts").catch(() => null);
  assert.ok(mod, "careEntryProviderSyncProof module should exist");

  const plan = mod.deriveCareEntryProviderSyncProof({});
  const text = mod.buildCareEntryProviderSyncProofShareText(plan, "2026-07-03T18:10:00.000Z");

  assert.match(text, /Care-entry provider sync proof packet/);
  assert.match(text, /Generated: 2026-07-03T18:10:00.000Z/);
  assert.match(text, /Incremental sync allowed: No/);
  assert.match(text, /care_entries\.updated_at/);
  assert.match(text, /care_entry_tombstones/);
  assert.match(text, /\/care-entries\?updatedSince=/);
  assert.match(text, /\/care-entries\/tombstones\?updatedSince=/);
  assert.match(text, /artifacts\/api-server\/src\/routes\/care-entries-router\.ts/);
  assert.match(text, /Mobile must remain on full-refresh care-entry refresh/);
  assert.match(text, /This proof packet does not approve App Store, Play Store, storage, AI, payments, push, or public launch/);
});
