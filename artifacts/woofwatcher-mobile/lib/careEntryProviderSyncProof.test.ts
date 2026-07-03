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
  });

  assert.equal(plan.status, "ready-for-review");
  assert.equal(plan.statusLabel, "Ready for provider review");
  assert.equal(plan.openCount, 0);
  assert.equal(plan.incrementalSyncAllowed, true);
  assert.match(plan.summary, /ready for provider review/i);
  assert.ok(plan.items.every((item) => item.status === "ready"));
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
