import { test } from "node:test";
import assert from "node:assert/strict";

function completeStorageProviderEvidence() {
  return {
    fileName: "provider-storage-proof.json",
    uri: "file:///provider-proof/provider-storage-proof.json",
    mimeType: "application/json",
    byteSize: 31_840,
    bucketNames: ["report-pdfs", "credential-artifacts", "qa-evidence"],
    signedUploadPolicy: "signed upload policy for household-scoped artifacts",
    signedDownloadPolicy: "signed download policy for household-scoped artifacts",
    householdScopePolicy: "active household id scopes every artifact path",
    retentionPolicy: "retention policy for report and credential artifacts",
    exportPolicy: "owner export policy for stored report and credential artifacts",
    deletionPolicy: "owner deletion policy for report and credential artifacts",
    qaEvidenceStoragePolicy: "QA evidence storage policy for beta proof attachments",
    apolloApprovalOwner: "Apollo Duran",
    householdScoped: true,
    signedAccessApproved: true,
    signedUploadApproved: true,
    signedDownloadApproved: true,
    householdScopeApproved: true,
    retentionApproved: true,
    exportApproved: true,
    deletionApproved: true,
    retentionExportDeletionApproved: true,
    qaEvidenceStorageApproved: true,
    apolloApproved: true,
  };
}

function completePrivacyProviderEvidence() {
  return {
    aiProviderEvidence: {
      aiProviderEvidence: [
        { kind: "provider-key-storage", fileName: "openai-secret-storage-proof.json", mimeType: "application/json", byteSize: 1200 },
      ],
    },
    paymentsProviderEvidence: {
      productCatalogApproved: true,
      sandboxReceiptEvidence: [
        { platform: "ios", store: "app-store", fileName: "ios-app-store-receipt.json", mimeType: "application/json", byteSize: 1200 },
      ],
    },
    accountDeletionEvidence: {
      accountDeletionEvidence: [
        { kind: "deletion-route-auth", fileName: "account-deletion-route-auth-proof.json", mimeType: "application/json", byteSize: 1200 },
      ],
    },
  };
}

function completePushNotificationsProofEvidence() {
  return {
    expoPushProjectConfig: "Expo push project config proof: production project id, channel, token registration, local preview boundary.",
    appleApnsCredentials: "Apple APNs credentials proof: production entitlement, device token, and APNs delivery evidence.",
    firebaseFcmCredentials: "Firebase and FCM credentials proof: google-services config, sender ownership, Android channel behavior.",
    permissionPromptPreferenceCopy: "Permission prompt and preference copy proof: consent language, denied fallback, and caregiver copy.",
    quietHoursOptOutBehavior: "Quiet hours and opt-out behavior proof: disabled reminders stay off and quiet hours mute non-urgent reminders.",
    reminderDeliveryQaFallback: "Reminder delivery QA and fallback proof: iOS and Android delivered reminders plus fallback recovery.",
    nativeDeliveryEvidence: [
      {
        platform: "ios",
        provider: "apns",
        fileName: "ios-apns-reminder-delivery-proof.png",
        mimeType: "image/png",
        byteSize: 320000,
        pushTokenRegistered: true,
        reminderDelivered: true,
        capturesPermissionPreference: true,
        capturesQuietHoursOrOptOut: true,
        capturesFallbackPath: true,
      },
      {
        platform: "android",
        provider: "fcm",
        fileName: "android-fcm-reminder-delivery-proof.png",
        mimeType: "image/png",
        byteSize: 300000,
        pushTokenRegistered: true,
        reminderDelivered: true,
        capturesPermissionPreference: true,
        capturesQuietHoursOrOptOut: true,
        capturesFallbackPath: true,
      },
    ],
  };
}

function completeStoreAccountsProofEvidence() {
  return {
    storeAccountEvidence: [
      {
        kind: "apple-developer-access",
        platform: "ios",
        store: "app-store-connect",
        fileName: "ios-app-store-connect-apple-developer-proof.json",
        mimeType: "application/json",
        byteSize: 1400,
        appleDeveloperTeamId: "TEAM123",
        appStoreConnectAppId: "123456789",
        accountRole: "admin",
        bundleId: "com.pegasusdreamscapes.woofwatcher",
        paidProgramActive: true,
      },
    ],
  };
}

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
  assert.equal(plan.readyCount, 0);
  assert.equal(plan.totalCount, 8);
  assert.equal(plan.openCount, 8);
  assert.equal(plan.percent, 0);
  assert.match(plan.headline, /1\/8 provider gates staged/i);
  assert.match(plan.summary, /staged locally/i);
  assert.ok(plan.rows.some((row) => row.key === "auth" && row.status === "staged"));
  assert.ok(plan.rows.some((row) => row.key === "auth" && row.statusLabel === "Owner staged"));
  assert.ok(plan.rows.some((row) => row.key === "auth" && /provider approval/i.test(row.detail)));
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
  assert.ok(plan.rows.some((row) => row.key === "payments" && /WoofWatcher Plus payments proof packet/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "payments" && /Plus and Family product ids/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "payments" && /sandbox receipt test/i.test(row.proofRequired)));
  assert.ok(
    plan.rows.some(
      (row) =>
        row.key === "payments" &&
        row.proofChecklist.some((item) => /Billing path decision/i.test(item) && /App Store/i.test(item) && /Google Play/i.test(item)),
    ),
  );
  assert.ok(
    plan.rows.some(
      (row) =>
        row.key === "payments" &&
        row.proofChecklist.some((item) => /Entitlement mapping/i.test(item) && /restore purchases/i.test(item)),
    ),
  );
  assert.ok(plan.rows.some((row) => row.key === "ai" && /WoofGuide AI provider proof packet/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "ai" && /OpenAI key location/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "ai" && /owner-review write gate/i.test(row.proofRequired)));
  assert.ok(
    plan.rows.some(
      (row) =>
        row.key === "ai" &&
        row.proofChecklist.some((item) => /Veterinary safety boundary/i.test(item) && /not veterinary advice/i.test(item)),
    ),
  );
  assert.ok(plan.rows.some((row) => row.key === "accountDeletion" && /Self-serve account deletion proof packet/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "accountDeletion" && /export-before-delete warning/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "accountDeletion" && /data\/object deletion receipt/i.test(row.proofRequired)));
  assert.ok(
    plan.rows.some(
      (row) =>
        row.key === "accountDeletion" &&
        row.proofChecklist.some((item) => /Recovery window and cancellation rules/i.test(item) && /cancel deletion/i.test(item)),
    ),
  );
  assert.ok(plan.rows.some((row) => row.key === "storeAccounts" && /Apple and Google store accounts proof packet/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "storeAccounts" && /Apple Developer team id/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "storeAccounts" && /Google Play package record/i.test(row.proofRequired)));
  assert.ok(
    plan.rows.some(
      (row) =>
        row.key === "storeAccounts" &&
        row.proofChecklist.some((item) => /Reviewer access and test credentials/i.test(item) && /test credentials/i.test(item)),
    ),
  );
  assert.ok(plan.rows.some((row) => row.key === "push" && /Push notifications proof packet/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "push" && /Expo push project config/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "push" && /APNs credentials/i.test(row.proofRequired)));
  assert.ok(plan.rows.some((row) => row.key === "push" && /Firebase\/FCM credentials/i.test(row.proofRequired)));
  assert.ok(
    plan.rows.some(
      (row) =>
        row.key === "push" &&
        row.proofChecklist.some((item) => /Quiet hours and opt-out behavior/i.test(item) && /opt-out behavior/i.test(item)),
    ),
  );
  assert.equal(plan.nextGate?.key, "auth");
  assert.match(plan.nextGate?.proofRequired ?? "", /Production auth provider proof packet/);
  assert.ok(plan.nextGate?.proofChecklist.some((item) => /Redirect and deep-link URLs/i.test(item)));
  assert.ok(plan.blockers.some((blocker) => /household database/i.test(blocker)));
  assert.equal(plan.providerInput.authConfigured, false);
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
  const storageProviderEvidence = completeStorageProviderEvidence();
  const privacyProviderEvidence = completePrivacyProviderEvidence();
  const pushNotificationsProofEvidence = completePushNotificationsProofEvidence();
  const storeAccountsProofEvidence = completeStoreAccountsProofEvidence();

  const profile = mod.normalizeLaunchProviderProfile({
    authConfigured: "yes",
    databaseConfigured: 1,
    storageProviderConfigured: false,
    storageProviderEvidence,
    ...privacyProviderEvidence,
    pushNotificationsProofEvidence,
    storeAccountsProofEvidence,
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
  assert.deepEqual(profile.storageProviderEvidence, storageProviderEvidence);
  assert.deepEqual(profile.aiProviderEvidence, privacyProviderEvidence.aiProviderEvidence);
  assert.deepEqual(profile.paymentsProviderEvidence, privacyProviderEvidence.paymentsProviderEvidence);
  assert.deepEqual(profile.accountDeletionEvidence, privacyProviderEvidence.accountDeletionEvidence);
  assert.deepEqual(profile.pushNotificationsProofEvidence, pushNotificationsProofEvidence);
  assert.deepEqual(profile.storeAccountsProofEvidence, storeAccountsProofEvidence);
  assert.equal(mod.normalizeLaunchProviderProfile({ storageProviderEvidence: [] }).storageProviderEvidence, null);
  assert.equal(mod.normalizeLaunchProviderProfile({ aiProviderEvidence: [] }).aiProviderEvidence, null);
  assert.equal(mod.normalizeLaunchProviderProfile({ paymentsProviderEvidence: [] }).paymentsProviderEvidence, null);
  assert.equal(mod.normalizeLaunchProviderProfile({ accountDeletionEvidence: [] }).accountDeletionEvidence, null);
  assert.equal(mod.normalizeLaunchProviderProfile({ pushNotificationsProofEvidence: [] }).pushNotificationsProofEvidence, null);
  assert.equal(mod.normalizeLaunchProviderProfile({ storeAccountsProofEvidence: [] }).storeAccountsProofEvidence, null);
});

test("keeps owner-reviewed provider toggles out of launch-readiness input until provider approval and structured proof", async () => {
  const mod = await import("./launchProviderSetup.ts").catch(() => null);
  assert.ok(mod, "launchProviderSetup module should exist");

  const ownerReviewed = mod.deriveLaunchProviderSetup({
    authConfigured: true,
    databaseConfigured: true,
    storageProviderConfigured: true,
    aiProviderConfigured: true,
    paymentsEnabled: true,
    pushNotificationsConfigured: true,
    appStoreAccountsReady: true,
    accountDeletionEnabled: true,
    providerStatus: "owner-reviewed",
  });
  const providerApproved = mod.deriveLaunchProviderSetup({
    ...ownerReviewed.providerInput,
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

  assert.equal(ownerReviewed.status, "owner-reviewed");
  assert.equal(ownerReviewed.readyCount, 0);
  assert.equal(ownerReviewed.openCount, 8);
  assert.equal(ownerReviewed.percent, 0);
  assert.ok(ownerReviewed.rows.every((row) => row.status === "staged"));
  assert.ok(ownerReviewed.rows.every((row) => row.statusLabel === "Owner staged"));
  assert.equal(ownerReviewed.nextGate?.key, "auth");
  assert.deepEqual(ownerReviewed.providerInput, {
    authConfigured: false,
    authProviderProofReady: false,
    databaseConfigured: false,
    databaseProviderProofReady: false,
    storageProviderConfigured: false,
    storageProviderProofReady: false,
    storageProviderEvidence: null,
    aiProviderConfigured: false,
    aiProviderProofReady: false,
    paymentsEnabled: false,
    paymentsProviderProofReady: false,
    pushNotificationsConfigured: false,
    pushNotificationsProofReady: false,
    appStoreAccountsReady: false,
    storeAccountsProofReady: false,
    accountDeletionEnabled: false,
    accountDeletionProofReady: false,
  });
  assert.equal(providerApproved.status, "owner-reviewed");
  assert.equal(providerApproved.readyCount, 0);
  assert.equal(providerApproved.openCount, 8);
  assert.ok(providerApproved.rows.every((row) => row.status === "staged"));
  assert.deepEqual(providerApproved.providerInput, {
    authConfigured: false,
    authProviderProofReady: false,
    databaseConfigured: false,
    databaseProviderProofReady: false,
    storageProviderConfigured: false,
    storageProviderProofReady: false,
    storageProviderEvidence: null,
    aiProviderConfigured: false,
    aiProviderProofReady: false,
    paymentsEnabled: false,
    paymentsProviderProofReady: false,
    pushNotificationsConfigured: false,
    pushNotificationsProofReady: false,
    appStoreAccountsReady: false,
    storeAccountsProofReady: false,
    accountDeletionEnabled: false,
    accountDeletionProofReady: false,
  });
});

test("keeps provider-approved toggles staged until row structured proof is ready", async () => {
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

  assert.equal(plan.status, "owner-reviewed");
  assert.equal(plan.readyCount, 0);
  assert.equal(plan.openCount, 8);
  assert.ok(plan.rows.every((row) => row.status === "staged"));
  assert.ok(plan.rows.every((row) => /structured proof/i.test(row.detail)));
  assert.deepEqual(plan.providerInput, {
    authConfigured: false,
    authProviderProofReady: false,
    databaseConfigured: false,
    databaseProviderProofReady: false,
    storageProviderConfigured: false,
    storageProviderProofReady: false,
    storageProviderEvidence: null,
    aiProviderConfigured: false,
    aiProviderProofReady: false,
    paymentsEnabled: false,
    paymentsProviderProofReady: false,
    pushNotificationsConfigured: false,
    pushNotificationsProofReady: false,
    appStoreAccountsReady: false,
    storeAccountsProofReady: false,
    accountDeletionEnabled: false,
    accountDeletionProofReady: false,
  });
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
  assert.match(text, /Progress: 0\/8 provider approved \(0%\)/);
  assert.match(text, /Ready/);
  assert.match(text, /Nothing is provider-approved yet/);
  assert.match(text, /Open or Staged/);
  assert.match(text, /Local staged/);
  assert.match(text, /Next Provider Gate/);
  assert.match(text, /Production auth/);
  assert.match(text, /Owner: Apollo \/ developer/);
  assert.match(text, /Proof: Production auth provider proof packet/);
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
  assert.match(text, /WoofWatcher Plus payments: WoofWatcher Plus payments proof packet/);
  assert.match(text, /Product catalog: Plus and Family product ids/);
  assert.match(text, /Billing path decision: Approved App Store, Google Play, and Stripe or web checkout decision/);
  assert.match(text, /Sandbox receipt test: Sandbox purchase, renewal, cancel, refund, and expired receipt proof/);
  assert.match(text, /Entitlement mapping: Plus and Family feature gates/);
  assert.match(text, /Refund and support policy: Public refund, support, tax, and subscription terms/);
  assert.match(text, /Checkout gate and restore behavior: checkout stays disabled/);
  assert.match(text, /WoofGuide AI: WoofGuide AI provider proof packet/);
  assert.match(text, /Provider key and secret storage: OpenAI key location/);
  assert.match(text, /Approved model policy: Approved model id/);
  assert.match(text, /Source and citation rules: Approved source labels/);
  assert.match(text, /Owner-review write gate: owner-reviewed/);
  assert.match(text, /Veterinary safety boundary: not veterinary advice/);
  assert.match(text, /Fallback and incident handling: fallback copy/);
  assert.match(text, /Self-serve account deletion: Self-serve account deletion proof packet/);
  assert.match(text, /Deletion route and authentication gate: self-serve deletion route/);
  assert.match(text, /Export-before-delete handoff: export-before-delete warning/);
  assert.match(text, /Data and object deletion receipt: data\/object deletion receipt/);
  assert.match(text, /Recovery window and cancellation rules: recovery-window policy/);
  assert.match(text, /Legal and store approval: legal\/store approval/);
  assert.match(text, /Apple and Google store accounts: Apple and Google store accounts proof packet/);
  assert.match(text, /Apple Developer and App Store Connect access: Apple Developer team id/);
  assert.match(text, /Google Play Console package record: Google Play package record/);
  assert.match(text, /Reviewer access and test credentials: reviewer access notes/);
  assert.match(text, /Store screenshots and metadata ownership: store screenshots/);
  assert.match(text, /Release roles and submission approval: release role approval/);
  assert.match(text, /Push notifications: Push notifications proof packet/);
  assert.match(text, /Expo push project config: Expo push project id/);
  assert.match(text, /Apple APNs credentials: APNs credentials/);
  assert.match(text, /Firebase and FCM credentials: Firebase\/FCM credentials/);
  assert.match(text, /Permission prompt and preference copy: permission prompt copy/);
  assert.match(text, /Quiet hours and opt-out behavior: quiet hours/);
  assert.match(text, /Reminder delivery QA and fallback: delivery QA/);
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
  assert.equal(plan.readyCount, 0);
  assert.equal(plan.openCount, 8);
  assert.equal(plan.nextGate?.key, "auth");
  assert.ok(plan.blockers.length > 0);
});

test("clears the next provider gate only when every production provider is ready", async () => {
  const mod = await import("./launchProviderSetup.ts").catch(() => null);
  assert.ok(mod, "launchProviderSetup module should exist");
  const storageProviderEvidence = completeStorageProviderEvidence();

  const plan = mod.deriveLaunchProviderSetup({
    authConfigured: true,
    authProviderProofReady: true,
    databaseConfigured: true,
    databaseProviderProofReady: true,
    storageProviderConfigured: true,
    storageProviderProofReady: true,
    storageProviderEvidence,
    aiProviderConfigured: true,
    aiProviderProofReady: true,
    paymentsEnabled: true,
    paymentsProviderProofReady: true,
    pushNotificationsConfigured: true,
    pushNotificationsProofReady: true,
    appStoreAccountsReady: true,
    storeAccountsProofReady: true,
    accountDeletionEnabled: true,
    accountDeletionProofReady: true,
    providerStatus: "provider-approved",
  });

  assert.equal(plan.openCount, 0);
  assert.equal(plan.nextGate, null);
  assert.equal(plan.status, "provider-approved");
  assert.deepEqual(plan.providerInput.storageProviderEvidence, storageProviderEvidence);

  const text = mod.buildLaunchProviderSetupShareText(plan, "2026-06-21T10:00:00.000Z");
  assert.match(text, /Next Provider Gate/);
  assert.match(text, /All provider gates are provider-approved for final owner review/);
});
