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
  assert.equal(plan.percent, 13);
  assert.match(plan.headline, /1\/8/i);
  assert.match(plan.summary, /production providers/i);
  assert.ok(plan.rows.some((row) => row.key === "auth" && row.status === "ready"));
  assert.ok(plan.rows.some((row) => row.key === "database" && /Supabase/i.test(row.nextAction)));
  assert.ok(plan.rows.some((row) => row.key === "database" && /RLS/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "storage" && /signed upload/i.test(row.proofRequired)));
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
  assert.match(text, /Proof Needed/);
  assert.match(text, /Household database sync: Supabase project id/);
  assert.match(text, /Records and media storage: Storage bucket names/);
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
  assert.ok(plan.blockers.length > 0);
});
