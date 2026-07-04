import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildAccountDeletionRequest,
  buildPrivacyExportBundle,
  deriveAccountSafetyPlan,
  serializePrivacyExportBundle,
} from "./privacySafety.ts";
import type { AttachmentStorageProviderEvidence } from "./attachmentManifest.ts";

const NOW = new Date("2026-06-08T14:00:00.000Z").getTime();

const state = {
  activePetId: "primary",
  profile: {
    name: "Phoenix",
    breed: "German Shepherd mix",
    vetBoundary: "WoofWatcher is not a veterinary diagnosis.",
  },
  pets: [{ id: "pet_london", name: "London", breed: "Golden Retriever", status: "provider-gated" }],
  householdSetup: {
    mode: "join",
    householdName: "Phoenix House",
    inviteCode: "WW-42",
    providerStatus: "pending-provider",
  },
  launchSupportProfile: {
    supportEmail: "help@woofwatcher.app",
    privacyPolicyUrl: "https://woofwatcher.app/privacy",
    termsUrl: "https://woofwatcher.app/terms",
    refundPolicyApproved: true,
    veterinaryBoundaryApproved: true,
    accountDeletionEscalationApproved: false,
    incidentResponseApproved: false,
    ownerReviewedAt: "2026-06-21T10:00:00.000Z",
    providerStatus: "owner-reviewed",
  },
  launchProviderProfile: {
    authConfigured: true,
    databaseConfigured: false,
    storageProviderConfigured: false,
    aiProviderConfigured: false,
    paymentsEnabled: false,
    pushNotificationsConfigured: false,
    appStoreAccountsReady: false,
    accountDeletionEnabled: false,
    ownerReviewedAt: "2026-06-21T10:05:00.000Z",
    providerStatus: "owner-reviewed",
    notes: "Production provider checklist is staged for Apollo review.",
  },
  reminderNotificationPreferences: {
    pushEnabled: true,
    permissionStatus: "unknown",
    quietHoursStart: "9:00 PM",
    quietHoursEnd: "7:00 AM",
    optOut: false,
    updatedAt: "2026-07-03T16:00:00.000Z",
  },
  accessPasses: [{ id: "access_maya", holderName: "Maya", role: "Sitter", status: "draft" }],
  adventureMemories: [{ id: "memory_1", title: "Wildflower Loop", petName: "Phoenix", storageStatus: "local-draft" }],
  caregivers: [{ name: "Apollo", role: "Owner" }],
  dietProfile: { primaryFood: "Sensitive kibble", normalPortion: "1 cup" },
  routines: [{ id: "breakfast", label: "Breakfast", type: "meal", time: "7:30 AM", owner: "Apollo" }],
  goals: [{ id: "weight", title: "Hold steady weight" }],
  records: [
    { id: "rabies", type: "vaccine", title: "Rabies", due: "May 20, 2028", attachmentName: "rabies.pdf" },
    { id: "chip", type: "microchip", title: "HomeAgain", due: "985112003004551" },
  ],
  calendarEvents: [{ id: "renewal", title: "Renew insurance", date: "2026-07-01", type: "insurance" }],
  reportArtifacts: [
    {
      id: "sitter",
      kind: "care_pass",
      audience: "sitter",
      title: "Phoenix Sitter Care Pass",
      message: "Care pass",
      printFileName: "phoenix-sitter-care-pass-2026-06-08.html",
      printHtml: "<!doctype html><html><body>Care pass</body></html>",
    },
  ],
  entries: [
    {
      id: "meal_1",
      type: "meal",
      title: "Breakfast",
      caregiver: "Apollo",
      occurredAt: "2026-06-08T14:00:00.000Z",
      details: { expectedPortion: "1 cup", householdVisible: true },
    },
  ],
};

function completeStorageEvidence(): AttachmentStorageProviderEvidence {
  return {
    fileName: "attachment-storage-provider-proof.json",
    uri: "file:///provider-proof/attachment-storage-provider-proof.json",
    mimeType: "application/json",
    byteSize: 24_512,
    bucketNames: ["care-proof-photos", "record-documents", "qa-evidence"],
    signedUploadPolicy: "Signed upload policy covers care proof photos, record documents, reports, and QA screenshots.",
    signedDownloadPolicy: "Signed downloads are household scoped with expiring links.",
    householdScopePolicy: "Objects are keyed by household and dog id, with owner/admin access review.",
    retentionPolicy: "Retention rules match care export, deletion, and legal hold requirements.",
    exportPolicy: "Owner exports include attachment object ids, names, and signed export references.",
    deletionPolicy: "Deletion receipts cover all attachment buckets and object ids.",
    qaEvidenceStoragePolicy: "QA screenshots and native proof files are stored separately with release audit ownership.",
    apolloApprovalOwner: "Apollo Duran",
    signedAccessApproved: true,
    householdScopeApproved: true,
    retentionExportDeletionApproved: true,
    qaEvidenceStorageApproved: true,
    apolloApproved: true,
  };
}

test("builds an owner export bundle with counts and care data", () => {
  const bundle = buildPrivacyExportBundle(
    state,
    { userId: "user_123", householdId: "house_123", householdName: "Phoenix House" },
    NOW,
  );

  assert.equal(bundle.app, "WoofWatcher");
  assert.equal(bundle.generatedAt, "2026-06-08T14:00:00.000Z");
  assert.equal(bundle.dogName, "Phoenix");
  assert.deepEqual(bundle.counts, {
    caregivers: 1,
    pets: 1,
    accessPasses: 1,
    adventureMemories: 1,
    routines: 1,
    entries: 1,
    records: 2,
    reportArtifacts: 1,
    calendarEvents: 1,
    attachedDocuments: 1,
    localAttachments: 2,
  });
  assert.equal(bundle.storage.attachmentQueue.total, 2);
  assert.deepEqual(bundle.storage.attachmentQueue.labels, ["record document", "report artifact"]);
  assert.deepEqual(
    bundle.storage.attachmentReviewRows.map((row) => row.label),
    ["Record documents", "Care Pass reports"],
  );
  assert.equal(bundle.storage.attachmentReviewRows[0]?.statusLabel, "Waiting for storage rules");
  assert.equal(bundle.care.profile?.name, "Phoenix");
  assert.equal(bundle.care.activePetId, "primary");
  assert.equal(bundle.care.pets[0]?.name, "London");
  assert.deepEqual(bundle.care.householdSetup, state.householdSetup);
  assert.deepEqual(bundle.care.launchSupportProfile, state.launchSupportProfile);
  assert.deepEqual(bundle.care.launchProviderProfile, state.launchProviderProfile);
  assert.deepEqual(bundle.care.reminderNotificationPreferences, state.reminderNotificationPreferences);
  assert.equal((bundle.care.accessPasses[0] as { holderName?: string })?.holderName, "Maya");
  assert.equal((bundle.care.adventureMemories[0] as { title?: string })?.title, "Wildflower Loop");
  assert.equal(bundle.care.entries[0]?.id, "meal_1");
  assert.deepEqual(bundle.care.reportArtifacts[0], state.reportArtifacts[0]);
  assert.match(bundle.disclosures.ai, /not a veterinary diagnosis/i);
  assert.match(bundle.disclosures.documents, /2 local files waiting/i);
});

test("uses saved structured storage proof for owner export attachment queue", () => {
  const bundle = buildPrivacyExportBundle(
    {
      ...state,
      launchProviderProfile: {
        ...state.launchProviderProfile,
        storageProviderConfigured: true,
        storageProviderEvidence: completeStorageEvidence(),
      },
    },
    { userId: "user_123", householdId: "house_123", householdName: "Phoenix House" },
    NOW,
  );

  assert.equal(bundle.storage.attachmentQueue.total, 2);
  assert.equal(bundle.storage.attachmentQueue.localOnly, 0);
  assert.equal(bundle.storage.attachmentQueue.uploadReady, 2);
  assert.equal(bundle.storage.attachmentSummary, "2 local files ready for provider upload.");
  assert.equal(bundle.storage.attachmentReviewRows[0]?.statusLabel, "Ready for provider upload");
  assert.match(bundle.disclosures.documents, /2 local files ready for provider upload/i);
});

test("clamps exported launch approval statuses until structured proof is attached", () => {
  const bundle = buildPrivacyExportBundle(
    {
      ...state,
      launchSupportProfile: {
        ...state.launchSupportProfile,
        accountDeletionEscalationApproved: true,
        incidentResponseApproved: true,
        providerStatus: "provider-approved",
      },
      launchProviderProfile: {
        ...state.launchProviderProfile,
        databaseConfigured: true,
        storageProviderConfigured: true,
        aiProviderConfigured: true,
        paymentsEnabled: true,
        pushNotificationsConfigured: true,
        appStoreAccountsReady: true,
        accountDeletionEnabled: true,
        providerStatus: "provider-approved",
      },
    },
    { userId: "user_123", householdId: "house_123", householdName: "Phoenix House" },
    NOW,
  );

  assert.equal(
    (bundle.care.launchSupportProfile as { providerStatus?: string } | null)?.providerStatus,
    "owner-reviewed",
  );
  assert.equal(
    (bundle.care.launchProviderProfile as { providerStatus?: string } | null)?.providerStatus,
    "owner-reviewed",
  );
});

test("serializes export without auth tokens or secrets", () => {
  const bundle = buildPrivacyExportBundle(
    {
      ...state,
      sessionToken: "should-not-export",
      authToken: "should-not-export",
    },
    { userId: "user_123" },
    NOW,
  );

  const text = serializePrivacyExportBundle(bundle);

  assert.match(text, /"dogName": "Phoenix"/);
  assert.doesNotMatch(text, /should-not-export|authToken|sessionToken/i);
});

test("derives launch safety plan before storage, deletion, AI, and payments are enabled", () => {
  const plan = deriveAccountSafetyPlan({
    state,
    aiProviderConfigured: false,
    storageProviderConfigured: false,
    accountDeletionEnabled: false,
    paymentsEnabled: false,
  });

  assert.equal(plan.export.status, "ready");
  assert.equal(plan.accountDeletion.status, "manual_required");
  assert.equal(plan.aiDisclosure.status, "limited");
  assert.equal(plan.documentStorage.status, "blocked");
  assert.match(plan.documentStorage.detail, /2 local files waiting/i);
  assert.equal(plan.payments.status, "blocked");
  assert.ok(plan.launchBlockers.some((blocker) => /account deletion/i.test(blocker)));
  assert.ok(plan.launchBlockers.some((blocker) => /document storage/i.test(blocker)));
});

test("keeps document storage blocked when provider setup lacks structured proof evidence", () => {
  const plan = deriveAccountSafetyPlan({
    state,
    aiProviderConfigured: true,
    storageProviderConfigured: true,
    accountDeletionEnabled: true,
    paymentsEnabled: true,
  });

  assert.equal(plan.documentStorage.status, "blocked");
  assert.match(plan.documentStorage.detail, /structured storage proof/i);
  assert.ok(plan.launchBlockers.some((blocker) => /structured storage proof/i.test(blocker)));
});

test("keeps WoofGuide AI disclosure limited until structured provider proof is attached", () => {
  const plan = deriveAccountSafetyPlan({
    state,
    aiProviderConfigured: true,
    storageProviderConfigured: true,
    storageProviderEvidence: completeStorageEvidence(),
    accountDeletionEnabled: true,
    paymentsEnabled: true,
  });

  assert.equal(plan.documentStorage.status, "ready");
  assert.equal(plan.aiDisclosure.status, "limited");
  assert.match(plan.aiDisclosure.detail, /structured WoofGuide AI provider proof/i);
  assert.ok(plan.launchBlockers.some((blocker) => /WoofGuide AI provider proof/i.test(blocker)));
});

test("keeps account deletion blocked until structured deletion proof is attached", () => {
  const plan = deriveAccountSafetyPlan({
    state,
    aiProviderConfigured: false,
    storageProviderConfigured: true,
    storageProviderEvidence: completeStorageEvidence(),
    accountDeletionEnabled: true,
    paymentsEnabled: true,
  });

  assert.equal(plan.accountDeletion.status, "blocked");
  assert.match(plan.accountDeletion.detail, /structured account deletion proof/i);
  assert.ok(plan.launchBlockers.some((blocker) => /account deletion proof/i.test(blocker)));
});

test("keeps payments blocked until structured payments proof is attached", () => {
  const plan = deriveAccountSafetyPlan({
    state,
    aiProviderConfigured: false,
    storageProviderConfigured: true,
    storageProviderEvidence: completeStorageEvidence(),
    accountDeletionEnabled: false,
    paymentsEnabled: true,
  });

  assert.equal(plan.payments.status, "blocked");
  assert.match(plan.payments.detail, /structured payments proof/i);
  assert.ok(plan.launchBlockers.some((blocker) => /payments proof/i.test(blocker)));
});

test("opens document storage review only with complete structured provider proof", () => {
  const plan = deriveAccountSafetyPlan({
    state,
    aiProviderConfigured: true,
    storageProviderConfigured: true,
    storageProviderEvidence: completeStorageEvidence(),
    accountDeletionEnabled: true,
    paymentsEnabled: true,
  });

  assert.equal(plan.documentStorage.status, "ready");
  assert.match(plan.documentStorage.detail, /ready for provider upload/i);
  assert.ok(plan.launchBlockers.every((blocker) => !/document storage/i.test(blocker)));
});

test("builds a non-destructive account deletion request", () => {
  const request = buildAccountDeletionRequest(
    state,
    { userId: "user_123", householdId: "house_123", householdName: "Phoenix House" },
    NOW,
  );

  assert.match(request.subject, /Account deletion request/);
  assert.match(request.body, /Phoenix/);
  assert.match(request.body, /user_123/);
  assert.match(request.body, /manual review/i);
  assert.match(request.body, /Export data before deletion/i);
  assert.match(request.body, /pet roster slots/i);
  assert.match(request.body, /Access Pass drafts/i);
  assert.match(request.body, /Adventure memories/i);
  assert.match(request.body, /local attachment queue/i);
});

test("uses saved structured storage proof in deletion request attachment summary", () => {
  const request = buildAccountDeletionRequest(
    {
      ...state,
      launchProviderProfile: {
        ...state.launchProviderProfile,
        storageProviderConfigured: true,
        storageProviderEvidence: completeStorageEvidence(),
      },
    },
    { userId: "user_123", householdId: "house_123", householdName: "Phoenix House" },
    NOW,
  );

  assert.match(request.body, /2 local files ready for provider upload/);
  assert.doesNotMatch(request.body, /2 local files waiting/);
});
