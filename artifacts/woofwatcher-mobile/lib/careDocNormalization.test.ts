import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createFreshCareDocMetadata,
  createLegacyCareDocMetadata,
  normalizeCareDoc,
} from "./careDocNormalization.ts";

function defaults() {
  return {
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z",
    activePetId: "primary",
    profile: { name: "My Dog" },
    pets: [],
    caregivers: [],
    householdSetup: {
      mode: "create",
      householdName: "",
      inviteCode: "",
      providerStatus: "local-only",
    },
    launchSupportProfile: {
      supportEmail: "",
      privacyPolicyUrl: "",
      termsUrl: "",
      refundPolicyApproved: false,
      veterinaryBoundaryApproved: false,
      accountDeletionEscalationApproved: false,
      incidentResponseApproved: false,
      supportLegalReadinessEvidence: null,
      providerStatus: "local-draft",
    },
    launchProviderProfile: {
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
      providerStatus: "local-draft",
      notes: "",
    },
    reminderNotificationPreferences: {
      pushEnabled: false,
      permissionStatus: "unknown",
      quietHoursStart: "",
      quietHoursEnd: "",
      optOut: false,
    },
    dietProfile: {},
    routines: [],
    goals: [],
    records: [],
    accessPasses: [],
    adventureMemories: [],
    reportArtifacts: [],
    calendarEvents: [],
  } as any;
}

test("normalization preserves unknown future care fields recursively while sanitizing known fields", () => {
  const normalized = normalizeCareDoc(
    {
      createdAt: "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-23T10:00:00.000Z",
      activePetId: 42,
      futureTopLevel: {
        protocol: {
          revision: 3,
          flags: ["one", "two"],
        },
      },
      pets: [],
      caregivers: [],
      routines: [],
      goals: [],
      records: [],
      accessPasses: [],
      adventureMemories: [],
      reportArtifacts: [],
      calendarEvents: [],
      householdSetup: {
        mode: "future-mode",
        householdName: 7,
        inviteCode: null,
        providerStatus: "future-status",
        futureHouseholdPolicy: {
          sharing: { approval: "two-adults" },
        },
      },
      launchSupportProfile: {
        supportEmail: 42,
        privacyPolicyUrl: null,
        termsUrl: {},
        refundPolicyApproved: true,
        veterinaryBoundaryApproved: false,
        accountDeletionEscalationApproved: true,
        incidentResponseApproved: false,
        supportLegalReadinessEvidence: {
          fileName: "approval.pdf",
          futureEvidence: {
            signatures: [{ role: "owner", verified: true }],
          },
        },
        providerStatus: "future-status",
        futureSupportPolicy: {
          escalation: { hours: 4 },
        },
      },
      launchProviderProfile: {
        authConfigured: true,
        storageProviderConfigured: true,
        storageProviderEvidence: {
          bucketNames: ["household-care"],
          futureEvidence: {
            encryption: { scheme: "future-kms" },
          },
        },
        providerStatus: "future-status",
        notes: 42,
        futureProviderCapability: {
          migration: { generation: 2 },
        },
      },
      reminderNotificationPreferences: {
        pushEnabled: true,
        permissionStatus: "future-permission",
        quietHoursStart: " 21:00 ",
        quietHoursEnd: null,
        optOut: true,
        futureReminderPolicy: {
          channels: { critical: "care-team" },
        },
      },
    },
    defaults(),
  ) as any;

  assert.equal(normalized.activePetId, "primary");
  for (const field of [
    "pets",
    "caregivers",
    "routines",
    "goals",
    "records",
    "accessPasses",
    "adventureMemories",
    "reportArtifacts",
    "calendarEvents",
  ]) {
    assert.deepEqual(normalized[field], [], `${field} must remain an array`);
  }

  assert.deepEqual(normalized.futureTopLevel, {
    protocol: { revision: 3, flags: ["one", "two"] },
  });
  assert.equal(normalized.householdSetup.mode, "create");
  assert.equal(normalized.householdSetup.householdName, "");
  assert.equal(normalized.householdSetup.providerStatus, "local-only");
  assert.deepEqual(normalized.householdSetup.futureHouseholdPolicy, {
    sharing: { approval: "two-adults" },
  });

  assert.equal(normalized.launchSupportProfile.supportEmail, "");
  assert.equal(normalized.launchSupportProfile.providerStatus, "local-draft");
  assert.deepEqual(
    normalized.launchSupportProfile.supportLegalReadinessEvidence
      .futureEvidence,
    { signatures: [{ role: "owner", verified: true }] },
  );
  assert.deepEqual(normalized.launchSupportProfile.futureSupportPolicy, {
    escalation: { hours: 4 },
  });

  assert.equal(normalized.launchProviderProfile.authConfigured, true);
  assert.equal(normalized.launchProviderProfile.providerStatus, "local-draft");
  assert.equal(normalized.launchProviderProfile.notes, "");
  assert.deepEqual(
    normalized.launchProviderProfile.storageProviderEvidence.futureEvidence,
    { encryption: { scheme: "future-kms" } },
  );
  assert.deepEqual(
    normalized.launchProviderProfile.futureProviderCapability,
    { migration: { generation: 2 } },
  );

  assert.equal(normalized.reminderNotificationPreferences.pushEnabled, false);
  assert.equal(
    normalized.reminderNotificationPreferences.permissionStatus,
    "unknown",
  );
  assert.equal(
    normalized.reminderNotificationPreferences.quietHoursStart,
    "21:00",
  );
  assert.deepEqual(
    normalized.reminderNotificationPreferences.futureReminderPolicy,
    { channels: { critical: "care-team" } },
  );
});

test("normalization rejects a non-object care document", () => {
  assert.throws(
    () => normalizeCareDoc(42, defaults()),
    /care document must be an object/i,
  );
});

test("normalization rejects present malformed known object sections", () => {
  for (const field of [
    "profile",
    "dietProfile",
    "householdSetup",
    "launchSupportProfile",
    "launchProviderProfile",
    "reminderNotificationPreferences",
  ]) {
    assert.throws(
      () => normalizeCareDoc({ [field]: 42 }, defaults()),
      new RegExp(field, "i"),
      `${field} must fail closed instead of silently becoming defaults`,
    );
  }
});

test("normalization rejects every present malformed care array", () => {
  for (const field of [
    "pets",
    "caregivers",
    "routines",
    "goals",
    "records",
    "accessPasses",
    "adventureMemories",
    "reportArtifacts",
    "calendarEvents",
  ]) {
    assert.throws(
      () => normalizeCareDoc({ [field]: {} }, defaults()),
      new RegExp(field, "i"),
      `${field} must fail closed instead of silently becoming an empty array`,
    );
  }
});

test("normalization preserves future nested content inside stable array rows", () => {
  const normalized = normalizeCareDoc(
    {
      routines: [
        {
          id: "routine-1",
          label: "Breakfast",
          futureSchedule: {
            windows: [{ startsAt: "07:00", toleranceMinutes: 15 }],
          },
        },
      ],
      records: [
        {
          id: "record-1",
          title: "Care note",
          futureClinicalEnvelope: {
            provenance: { source: "future-provider", revision: 4 },
          },
        },
      ],
    },
    defaults(),
  ) as any;

  assert.deepEqual(normalized.routines[0].futureSchedule, {
    windows: [{ startsAt: "07:00", toleranceMinutes: 15 }],
  });
  assert.deepEqual(normalized.records[0].futureClinicalEnvelope, {
    provenance: { source: "future-provider", revision: 4 },
  });
});

test("fresh document metadata records creation time but remains pristine for first server refresh", () => {
  assert.deepEqual(
    createFreshCareDocMetadata("2026-07-23T12:34:56.000Z"),
    {
      createdAt: "2026-07-23T12:34:56.000Z",
      updatedAt: "1970-01-01T00:00:00.000Z",
    },
  );
});

test("legacy normalization metadata is deterministic across devices", () => {
  assert.deepEqual(createLegacyCareDocMetadata(), {
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z",
  });
  assert.deepEqual(
    createLegacyCareDocMetadata(),
    createLegacyCareDocMetadata(),
  );
});
