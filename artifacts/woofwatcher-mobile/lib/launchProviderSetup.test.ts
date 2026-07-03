import { test } from "node:test";
import assert from "node:assert/strict";

test("builds a truthful provider setup plan from a local launch profile", async () => {
  const mod = await import("./launchProviderSetup.ts").catch(() => null);
  assert.ok(mod, "launchProviderSetup module should exist");

  const plan = mod.deriveLaunchProviderSetup({
    authConfigured: true,
    databaseConfigured: false,
    storageProviderConfigured: false,
    aiProviderConfigured: false,
    paymentsEnabled: false,
    pushNotificationsConfigured: false,
    appStoreAccountsReady: false,
    accountDeletionEnabled: false,
    providerStatus: "owner-reviewed",
    notes: "Clerk is wired for preview; Supabase launch rules still need review.",
  });

  assert.equal(plan.title, "Provider Launch Setup");
  assert.equal(plan.status, "owner-reviewed");
  assert.equal(plan.readyCount, 1);
  assert.equal(plan.totalCount, 8);
  assert.equal(plan.openCount, 7);
  assert.equal(plan.percent, 13);
  assert.match(plan.headline, /1\/8/i);
  assert.match(plan.summary, /production providers/i);
  assert.ok(plan.rows.some((row) => row.key === "auth" && row.status === "ready"));
  assert.ok(plan.rows.some((row) => row.key === "auth" && /Production auth provider proof packet/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "auth" && /Clerk production app id/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "auth" && /OAuth sign-in test/i.test(row.proofRequired)));
  assert.ok(
    plan.rows.some(
      (row) =>
        row.key === "auth" &&
        row.proofChecklist.some((item) => /Redirect and deep-link URLs/i.test(item) && /iOS and Android/i.test(item)),
    ),
  );
  assert.ok(
    plan.rows.some(
      (row) =>
        row.key === "auth" &&
        row.proofChecklist.some((item) => /Household membership policy/i.test(item) && /invite acceptance/i.test(item)),
    ),
  );
  assert.ok(plan.rows.some((row) => row.key === "database" && /Supabase/i.test(row.nextAction)));
  assert.ok(plan.rows.some((row) => row.key === "database" && /RLS/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "database" && /care_entries\.updated_at/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "database" && /care_entry_tombstones/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "database" && /\/care-entries\?updatedSince=/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "database" && /\/care-entries\/tombstones\?updatedSince=/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "database" && /retention\/export\/deletion/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "database" && /full-refresh/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "database" && /Care-entry provider sync proof packet/i.test(row.proofRequired)));
  assert.ok(
    plan.rows.some(
      (row) =>
        row.key === "database" &&
        row.proofChecklist.some((item) => /migration\/backfill/i.test(item) && /care_entries\.updated_at/i.test(item)),
    ),
  );
  assert.ok(
    plan.rows.some(
      (row) =>
        row.key === "database" &&
        row.proofChecklist.some((item) => /active-household RLS/i.test(item) && /tombstones\?updatedSince/i.test(item)),
    ),
  );
  assert.ok(plan.rows.some((row) => row.key === "storage" && /signed upload/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "storage" && /Report binary export proof packet/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "storage" && /Care Pass PDF/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "storage" && /Dog ID PNG/i.test(row.proofRequired)));
  assert.ok(
    plan.rows.some(
      (row) =>
        row.key === "storage" &&
        row.proofChecklist.some((item) => /PDF generator/i.test(item) && /expo-print/i.test(item)),
    ),
  );
  assert.ok(
    plan.rows.some(
      (row) =>
        row.key === "storage" &&
        row.proofChecklist.some((item) => /Credential PNG generator/i.test(item) && /view-shot|server renderer/i.test(item)),
    ),
  );
  assert.ok(
    plan.rows.some(
      (row) =>
        row.key === "storage" &&
        row.proofChecklist.some((item) => /Native artifact proof/i.test(item) && /iOS and Android/i.test(item)),
    ),
  );
  assert.equal(plan.nextGate?.key, "database");
  assert.match(plan.nextGate?.proofRequired ?? "", /Supabase project id/);
  assert.ok(plan.nextGate?.proofChecklist.some((item) => /mobile incremental/i.test(item)));
  assert.ok(plan.blockers.some((blocker) => /household database/i.test(blocker)));
  assert.equal(plan.providerInput.authConfigured, true);
  assert.equal(plan.providerInput.databaseConfigured, false);
  assert.equal(plan.providerInput.storageProviderConfigured, false);
  assert.equal(plan.providerInput.aiProviderConfigured, false);
  assert.equal(plan.providerInput.paymentsEnabled, false);
  assert.equal(plan.providerInput.pushNotificationsConfigured, false);
  assert.equal(plan.providerInput.appStoreAccountsReady, false);
  assert.equal(plan.providerInput.accountDeletionEnabled, false);
});

test("normalizes stored provider setup profiles before launch-readiness usage", async () => {
  const mod = await import("./launchProviderSetup.ts").catch(() => null);
  assert.ok(mod, "launchProviderSetup module should exist");

  const profile = mod.normalizeLaunchProviderProfile({
    authConfigured: "yes",
    databaseConfigured: 1,
    storageProviderConfigured: false,
    providerStatus: "unknown",
    ownerReviewedAt: 123,
    notes: 42,
  });

  assert.equal(profile.authConfigured, true);
  assert.equal(profile.databaseConfigured, true);
  assert.equal(profile.storageProviderConfigured, false);
  assert.equal(profile.aiProviderConfigured, false);
  assert.equal(profile.paymentsEnabled, false);
  assert.equal(profile.pushNotificationsConfigured, false);
  assert.equal(profile.appStoreAccountsReady, false);
  assert.equal(profile.accountDeletionEnabled, false);
  assert.equal(profile.providerStatus, "local-draft");
  assert.equal(profile.ownerReviewedAt, undefined);
  assert.equal(profile.notes, "");
});

test("formats a shareable provider setup checklist without claiming launch approval", async () => {
  const mod = await import("./launchProviderSetup.ts").catch(() => null);
  assert.ok(mod, "launchProviderSetup module should exist");

  const plan = mod.deriveLaunchProviderSetup({
    authConfigured: true,
    databaseConfigured: true,
    storageProviderConfigured: true,
    aiProviderConfigured: false,
    paymentsEnabled: false,
    pushNotificationsConfigured: false,
    appStoreAccountsReady: false,
    accountDeletionEnabled: false,
    providerStatus: "local-draft",
  });
  const text = mod.buildLaunchProviderSetupShareText(plan, "2026-06-21T10:00:00.000Z");

  assert.match(text, /WoofWatcher Provider Launch Setup/);
  assert.match(text, /Generated: 2026-06-21T10:00:00.000Z/);
  assert.match(text, /Progress: 3\/8 ready \(38%\)/);
  assert.match(text, /Ready/);
  assert.match(text, /Open/);
  assert.match(text, /Next Provider Gate/);
  assert.match(text, /WoofGuide AI/);
  assert.match(text, /Owner: Apollo \/ safety/);
  assert.match(text, /Proof: AI provider key location/);
  assert.match(text, /Proof Needed/);
  assert.match(text, /Production auth: Production auth provider proof packet/);
  assert.match(text, /Clerk production app/);
  assert.match(text, /Redirect and deep-link URLs/);
  assert.match(text, /OAuth sign-in test/);
  assert.match(text, /Session and token policy/);
  assert.match(text, /Household membership policy/);
  assert.match(text, /Household database sync: Supabase project id/);
  assert.match(text, /Care-entry provider sync proof packet/);
  assert.match(text, /Migration\/backfill/);
  assert.match(text, /Active-household RLS/);
  assert.match(text, /care_entries\.updated_at/);
  assert.match(text, /care_entry_tombstones/);
  assert.match(text, /\/care-entries\?updatedSince=/);
  assert.match(text, /mobile full-refresh sign-off/);
  assert.match(text, /Records and media storage: Storage bucket names/);
  assert.match(text, /Report binary export proof packet/);
  assert.match(text, /PDF generator: Approved native PDF generator/);
  assert.match(text, /Credential PNG generator: Approved image renderer/);
  assert.match(text, /Native artifact proof: iOS and Android/);
  assert.match(text, /WoofGuide AI/);
  assert.match(text, /No App Store or Play Store submission is approved by this checklist/);
});

test("does not show provider-approved until every provider gate is ready", async () => {
  const mod = await import("./launchProviderSetup.ts").catch(() => null);
  assert.ok(mod, "launchProviderSetup module should exist");

  const plan = mod.deriveLaunchProviderSetup({
    authConfigured: true,
    databaseConfigured: false,
    storageProviderConfigured: false,
    aiProviderConfigured: false,
    paymentsEnabled: false,
    pushNotificationsConfigured: false,
    appStoreAccountsReady: false,
    accountDeletionEnabled: false,
    providerStatus: "provider-approved",
  });

  assert.equal(plan.status, "owner-reviewed");
  assert.equal(plan.statusLabel, "Owner reviewed");
  assert.equal(plan.readyCount, 1);
  assert.equal(plan.openCount, 7);
  assert.equal(plan.nextGate?.key, "database");
  assert.ok(plan.blockers.length > 0);
});

test("clears the next provider gate only when every production provider is ready", async () => {
  const mod = await import("./launchProviderSetup.ts").catch(() => null);
  assert.ok(mod, "launchProviderSetup module should exist");

  const plan = mod.deriveLaunchProviderSetup({
    authConfigured: true,
    databaseConfigured: true,
    storageProviderConfigured: true,
    aiProviderConfigured: true,
    paymentsEnabled: true,
    pushNotificationsConfigured: true,
    appStoreAccountsReady: true,
    accountDeletionEnabled: true,
    providerStatus: "provider-approved",
  });

  assert.equal(plan.openCount, 0);
  assert.equal(plan.nextGate, null);
  assert.equal(plan.status, "provider-approved");

  const text = mod.buildLaunchProviderSetupShareText(plan, "2026-06-21T10:00:00.000Z");
  assert.match(text, /Next Provider Gate/);
  assert.match(text, /All provider gates are ready for final owner review/);
});
