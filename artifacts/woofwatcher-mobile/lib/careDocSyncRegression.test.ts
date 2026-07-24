import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createCareDocSyncCoordinator,
  parseCareDocSyncSnapshot,
} from "./careSync.ts";
import {
  isCompleteCareDocSnapshot,
  normalizeCareDoc,
} from "./careDocNormalization.ts";

const HOUSEHOLD_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_HOUSEHOLD_ID =
  "22222222-2222-4222-8222-222222222222";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const epochDoc = {
  createdAt: "1970-01-01T00:00:00.000Z",
  updatedAt: "1970-01-01T00:00:00.000Z",
  profile: { name: "Fresh device" },
} as any;

const acceptSyntheticTestDoc = () => true;

function completeDoc(
  overrides: Record<string, unknown> = {},
): Record<string, any> {
  return {
    createdAt: "2026-07-20T08:00:00.000Z",
    updatedAt: "2026-07-23T09:00:00.000Z",
    activePetId: "primary",
    profile: {
      name: "Household dog",
      publicLabel: "Household dog",
      breed: "",
      background: "",
      careFocus: "",
      weight: { current: 0, goal: "", unit: "lb" },
      vetBoundary: "Care patterns require veterinarian review.",
    },
    pets: [],
    caregivers: [],
    householdSetup: {
      mode: "create",
      householdName: "Household",
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
    dietProfile: {
      primaryFood: "",
      normalPortion: "",
      mealSchedule: "",
      toppers: "",
      supplements: "",
      bedtimeSnack: "",
      treatsAllowed: "",
      avoid: "",
      sensitivities: "",
      appetiteQuirks: "",
      vetNotes: "",
    },
    routines: [],
    goals: [],
    records: [],
    accessPasses: [],
    adventureMemories: [],
    reportArtifacts: [],
    calendarEvents: [],
    ...overrides,
  };
}

test("incomplete established object snapshots quarantine instead of becoming default edits", async (t) => {
  const acknowledgedDoc = completeDoc({
    routines: [
      {
        id: "routine-1",
        label: "Breakfast",
        type: "meal",
        time: "08:00",
        owner: "Alex",
        note: "",
      },
    ],
  });
  const incompleteCases = [
    { label: "empty object", value: {} },
    {
      label: "partial root missing stable arrays",
      value: {
        createdAt: acknowledgedDoc.createdAt,
        updatedAt: acknowledgedDoc.updatedAt,
        activePetId: "primary",
        profile: acknowledgedDoc.profile,
      },
    },
    {
      label: "complete root with incomplete profile",
      value: { ...acknowledgedDoc, profile: {} },
    },
  ];

  for (const current of incompleteCases) {
    await t.test(current.label, async () => {
      let snapshot: any = parseCareDocSyncSnapshot({
        parsed: {
          currentDoc: current.value,
          serverVersion: 7,
          acknowledged: { version: 7, doc: acknowledgedDoc },
          conflicts: [],
          documentSyncError: null,
        },
        fallbackDoc: completeDoc({
          createdAt: "2026-07-23T10:00:00.000Z",
          updatedAt: "1970-01-01T00:00:00.000Z",
          profile: {
            ...acknowledgedDoc.profile,
            name: "Fresh install default",
          },
        }) as any,
        normalizeDoc: (value) =>
          normalizeCareDoc(value, completeDoc() as any),
        isCompleteCurrentDoc: isCompleteCareDocSnapshot,
      });
      let putCalls = 0;
      const coordinator = createCareDocSyncCoordinator({
        readSnapshot: () => snapshot,
        commitSnapshot: (next) => {
          snapshot = next;
        },
        normalizeDoc: (value) =>
          normalizeCareDoc(value, completeDoc() as any),
        isCompleteDoc: isCompleteCareDocSnapshot,
        getRemote: async () => ({
          householdId: HOUSEHOLD_ID,
          version: 7,
          doc: acknowledgedDoc,
          updatedAt: acknowledgedDoc.updatedAt,
          updatedBy: "household-member",
        }),
        putRemote: async () => {
          putCalls += 1;
          throw new Error("An incomplete cache must never be pushed.");
        },
        now: () => "2026-07-23T10:00:00.000Z",
      });

      assert.equal(snapshot.cacheStatus, "corrupt");
      assert.equal(snapshot.serverVersion, 0);
      assert.equal(snapshot.acknowledged, null);
      assert.equal(
        await coordinator.syncFromServer(HOUSEHOLD_ID),
        true,
      );
      assert.equal(putCalls, 0);
      assert.equal(snapshot.serverVersion, 7);
      assert.deepEqual(
        JSON.parse(JSON.stringify(snapshot.acknowledged)),
        {
          version: 7,
          doc: acknowledgedDoc,
        },
      );
      assert.deepEqual(
        JSON.parse(JSON.stringify(snapshot.currentDoc)),
        acknowledgedDoc,
      );
    });
  }
});

test("an incomplete acknowledged baseline quarantines an otherwise complete established cache", async () => {
  const currentDoc = completeDoc({
    dietProfile: {
      ...completeDoc().dietProfile,
      primaryFood: "Cached food",
    },
  });
  const serverDoc = completeDoc({
    dietProfile: {
      ...completeDoc().dietProfile,
      primaryFood: "Server prescription",
    },
  });
  let snapshot: any = parseCareDocSyncSnapshot({
    parsed: {
      currentDoc,
      serverVersion: 7,
      acknowledged: {
        version: 7,
        doc: {
          createdAt: currentDoc.createdAt,
          updatedAt: currentDoc.updatedAt,
          profile: currentDoc.profile,
        },
      },
      conflicts: [],
    },
    fallbackDoc: completeDoc({
      createdAt: "2026-07-23T10:00:00.000Z",
      updatedAt: "1970-01-01T00:00:00.000Z",
    }) as any,
    normalizeDoc: (value) =>
      normalizeCareDoc(value, completeDoc() as any),
    isCompleteCurrentDoc: isCompleteCareDocSnapshot,
  });
  let putCalls = 0;
  const coordinator = createCareDocSyncCoordinator({
    readSnapshot: () => snapshot,
    commitSnapshot: (next) => {
      snapshot = next;
    },
    normalizeDoc: (value) =>
      normalizeCareDoc(value, completeDoc() as any),
    isCompleteDoc: isCompleteCareDocSnapshot,
    getRemote: async () => ({
      householdId: HOUSEHOLD_ID,
      version: 7,
      doc: serverDoc,
      updatedAt: serverDoc.updatedAt,
      updatedBy: "household-member",
    }),
    putRemote: async () => {
      putCalls += 1;
      throw new Error("An incomplete baseline must never be pushed.");
    },
    now: () => "2026-07-23T10:00:00.000Z",
  });

  assert.equal(snapshot.cacheStatus, "corrupt");
  assert.equal(snapshot.serverVersion, 0);
  assert.equal(snapshot.acknowledged, null);
  assert.equal(await coordinator.syncFromServer(HOUSEHOLD_ID), true);
  assert.equal(putCalls, 0);
  assert.equal(
    snapshot.currentDoc.dietProfile.primaryFood,
    "Server prescription",
  );
});

test("a non-empty incomplete remote document is rejected without replacing healthy local care", async () => {
  const healthyDoc = completeDoc({
    dietProfile: {
      ...completeDoc().dietProfile,
      primaryFood: "Household prescription",
    },
  });
  let snapshot: any = {
    currentDoc: healthyDoc,
    serverVersion: 7,
    acknowledged: { version: 7, doc: healthyDoc },
    conflicts: [],
    documentSyncError: null,
  };
  let putCalls = 0;
  const coordinator = createCareDocSyncCoordinator({
    readSnapshot: () => snapshot,
    commitSnapshot: (next) => {
      snapshot = next;
    },
    normalizeDoc: (value) =>
      normalizeCareDoc(value, completeDoc() as any),
    isCompleteDoc: isCompleteCareDocSnapshot,
    getRemote: async () => ({
      householdId: HOUSEHOLD_ID,
      version: 8,
      doc: {
        createdAt: healthyDoc.createdAt,
        updatedAt: "2026-07-23T10:00:00.000Z",
        profile: healthyDoc.profile,
      },
      updatedAt: "2026-07-23T10:00:00.000Z",
      updatedBy: "household-member",
    }),
    putRemote: async () => {
      putCalls += 1;
      throw new Error("An incomplete remote document must never be pushed.");
    },
    now: () => "2026-07-23T10:01:00.000Z",
  });

  assert.equal(await coordinator.syncFromServer(HOUSEHOLD_ID), false);
  assert.equal(putCalls, 0);
  assert.equal(snapshot.serverVersion, 7);
  assert.equal(
    snapshot.currentDoc.dietProfile.primaryFood,
    "Household prescription",
  );
  assert.match(snapshot.documentSyncError, /invalid/i);
});

test("the exact version-one empty server sentinel seeds care once instead of being normalized away", async () => {
  const localDoc = completeDoc({
    updatedAt: "2026-07-23T09:30:00.000Z",
    dietProfile: {
      ...completeDoc().dietProfile,
      primaryFood: "Local prescription",
    },
  });
  let snapshot: any = {
    currentDoc: localDoc,
    serverVersion: 0,
    acknowledged: null,
    conflicts: [],
    documentSyncError: null,
  };
  const puts: Array<{
    householdId: string;
    version: number;
    doc: Record<string, any>;
  }> = [];
  const coordinator = createCareDocSyncCoordinator({
    readSnapshot: () => snapshot,
    commitSnapshot: (next) => {
      snapshot = next;
    },
    normalizeDoc: (value) =>
      normalizeCareDoc(value, completeDoc() as any),
    isCompleteDoc: isCompleteCareDocSnapshot,
    getRemote: async () => ({
      householdId: HOUSEHOLD_ID,
      version: 1,
      doc: {},
      updatedAt: "2026-07-23T09:00:00.000Z",
      updatedBy: "bootstrap",
    }),
    putRemote: async (body) => {
      puts.push(body);
      return {
        householdId: HOUSEHOLD_ID,
        version: 2,
        doc: body.doc,
        updatedAt: "2026-07-23T10:00:00.000Z",
        updatedBy: "owner",
      };
    },
    now: () => "2026-07-23T10:00:00.000Z",
  });

  assert.equal(await coordinator.syncFromServer(HOUSEHOLD_ID), true);
  assert.equal(puts.length, 1);
  assert.equal(puts[0]?.householdId, HOUSEHOLD_ID);
  assert.equal(puts[0]?.version, 1);
  assert.equal(
    puts[0]?.doc.dietProfile.primaryFood,
    "Local prescription",
  );
  assert.equal(snapshot.serverVersion, 2);
  assert.equal(
    snapshot.acknowledged.doc.dietProfile.primaryFood,
    "Local prescription",
  );
  assert.deepEqual(
    snapshot.conflicts,
    [],
    "the bootstrap sentinel must use the seed path, not a synthetic no-base merge",
  );
});

test("a failed bootstrap push can restart and retry the empty acknowledged sentinel", async () => {
  const localDoc = completeDoc({
    updatedAt: "2026-07-23T09:30:00.000Z",
    dietProfile: {
      ...completeDoc().dietProfile,
      primaryFood: "Local prescription",
    },
  });
  let snapshot: any = parseCareDocSyncSnapshot({
    parsed: JSON.parse(
      JSON.stringify({
        currentDoc: localDoc,
        serverVersion: 1,
        acknowledged: { version: 1, doc: {} },
        conflicts: [],
        documentSyncError:
          "Household care sync needs a retry. Local care remains saved.",
      }),
    ),
    fallbackDoc: completeDoc() as any,
    normalizeDoc: (value) =>
      normalizeCareDoc(value, completeDoc() as any),
    isCompleteCurrentDoc: isCompleteCareDocSnapshot,
  });

  assert.equal(snapshot.cacheStatus, undefined);
  assert.equal(snapshot.serverVersion, 1);
  assert.deepEqual(snapshot.acknowledged, { version: 1, doc: {} });
  assert.equal(
    snapshot.currentDoc.dietProfile.primaryFood,
    "Local prescription",
  );

  const coordinator = createCareDocSyncCoordinator({
    readSnapshot: () => snapshot,
    commitSnapshot: (next) => {
      snapshot = next;
    },
    normalizeDoc: (value) =>
      normalizeCareDoc(value, completeDoc() as any),
    isCompleteDoc: isCompleteCareDocSnapshot,
    getRemote: async () => ({
      householdId: HOUSEHOLD_ID,
      version: 1,
      doc: {},
      updatedAt: "2026-07-23T10:00:00.000Z",
      updatedBy: "bootstrap",
    }),
    // Deliberately echo the in-memory body without a JSON round trip. The
    // normalizer/completeness contract must agree even when optional
    // undefined fields have not been stripped by serialization.
    putRemote: async (body) => ({
      householdId: HOUSEHOLD_ID,
      version: 2,
      doc: body.doc,
      updatedAt: "2026-07-23T10:01:00.000Z",
      updatedBy: "owner",
    }),
    now: () => "2026-07-23T10:01:00.000Z",
  });

  assert.equal(await coordinator.syncFromServer(HOUSEHOLD_ID), true);
  assert.equal(snapshot.serverVersion, 2);
  assert.equal(
    snapshot.acknowledged.doc.dietProfile.primaryFood,
    "Local prescription",
  );
  assert.equal(snapshot.documentSyncError, null);
});

test("an empty sentinel is never accepted as the success body of a document write", async () => {
  const localDoc = completeDoc({
    updatedAt: "2026-07-23T09:30:00.000Z",
  });
  let snapshot: any = {
    currentDoc: localDoc,
    serverVersion: 0,
    acknowledged: null,
    conflicts: [],
    documentSyncError: null,
  };
  const coordinator = createCareDocSyncCoordinator({
    readSnapshot: () => snapshot,
    commitSnapshot: (next) => {
      snapshot = next;
    },
    normalizeDoc: (value) =>
      normalizeCareDoc(value, completeDoc() as any),
    isCompleteDoc: isCompleteCareDocSnapshot,
    getRemote: async () => {
      throw new Error("not used");
    },
    putRemote: async () => ({
      householdId: HOUSEHOLD_ID,
      version: 1,
      doc: {},
      updatedAt: "2026-07-23T10:00:00.000Z",
      updatedBy: "unexpected-writer",
    }),
    now: () => "2026-07-23T10:00:00.000Z",
  });

  assert.equal(await coordinator.requestPush(HOUSEHOLD_ID), false);
  assert.equal(snapshot.serverVersion, 0);
  assert.deepEqual(snapshot.currentDoc, localDoc);
  assert.equal(snapshot.acknowledged, null);
  assert.match(snapshot.documentSyncError, /invalid/i);
});

test("a malformed cached current document cannot inherit its acknowledged base or trigger a PUT", async () => {
  const serverDoc = {
    createdAt: "2026-07-20T08:00:00.000Z",
    updatedAt: "2026-07-23T09:00:00.000Z",
    profile: { name: "Household dog" },
  };
  let snapshot: any = parseCareDocSyncSnapshot({
    parsed: {
      currentDoc: 42,
      serverVersion: 7,
      acknowledged: {
        version: 7,
        doc: serverDoc,
      },
      conflicts: [],
      documentSyncError: null,
    },
    fallbackDoc: epochDoc,
    normalizeDoc: (value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError("Care document must be an object.");
      }
      return value as any;
    },
    isCompleteCurrentDoc: acceptSyntheticTestDoc,
  });
  let putCalls = 0;
  const coordinator = createCareDocSyncCoordinator({
    readSnapshot: () => snapshot,
    commitSnapshot: (next) => {
      snapshot = next;
    },
    normalizeDoc: (value: unknown) => value as any,
    isCompleteDoc: acceptSyntheticTestDoc,
    getRemote: async () => ({
      householdId: HOUSEHOLD_ID,
      version: 7,
      doc: serverDoc,
      updatedAt: serverDoc.updatedAt,
      updatedBy: "household-member",
    }),
    putRemote: async () => {
      putCalls += 1;
      throw new Error("A corrupt cache must never be pushed.");
    },
    now: () => "2026-07-23T10:00:00.000Z",
  });

  assert.equal(snapshot.cacheStatus, "corrupt");
  assert.equal(snapshot.serverVersion, 0);
  assert.equal(snapshot.acknowledged, null);
  assert.deepEqual(snapshot.currentDoc, epochDoc);

  assert.equal(await coordinator.syncFromServer(HOUSEHOLD_ID), true);
  assert.equal(putCalls, 0);
  assert.equal(snapshot.serverVersion, 7);
  assert.equal(snapshot.acknowledged.version, 7);
  assert.deepEqual(snapshot.currentDoc, serverDoc);
});

test("an established cache missing both currentDoc and legacy doc is corrupt", () => {
  const parsed = parseCareDocSyncSnapshot({
    parsed: {
      serverVersion: 7,
      acknowledged: {
        version: 7,
        doc: {
          createdAt: "2026-07-20T08:00:00.000Z",
          updatedAt: "2026-07-23T09:00:00.000Z",
          profile: { name: "Household dog" },
        },
      },
      conflicts: [],
      documentSyncError: null,
    },
    fallbackDoc: epochDoc,
    normalizeDoc: (value: unknown) => value as any,
    isCompleteCurrentDoc: acceptSyntheticTestDoc,
  });

  assert.equal(parsed.cacheStatus, "corrupt");
  assert.equal(parsed.serverVersion, 0);
  assert.equal(parsed.acknowledged, null);
  assert.deepEqual(parsed.currentDoc, epochDoc);
});

test("a malformed remote known section cannot move the baseline or trigger a PUT", async () => {
  const acknowledgedDoc = {
    ...epochDoc,
    updatedAt: "2026-07-23T09:00:00.000Z",
    profile: { name: "Household dog" },
  };
  let snapshot: any = {
    currentDoc: acknowledgedDoc,
    serverVersion: 7,
    acknowledged: {
      version: 7,
      doc: acknowledgedDoc,
    },
    conflicts: [],
    documentSyncError: null,
  };
  let putCalls = 0;
  const coordinator = createCareDocSyncCoordinator({
    readSnapshot: () => snapshot,
    commitSnapshot: (next) => {
      snapshot = next;
    },
    normalizeDoc: (value: unknown) =>
      normalizeCareDoc(value, epochDoc),
    isCompleteDoc: acceptSyntheticTestDoc,
    getRemote: async () => ({
      householdId: HOUSEHOLD_ID,
      version: 8,
      doc: {
        ...acknowledgedDoc,
        updatedAt: "2026-07-23T10:00:00.000Z",
        profile: 42,
      },
      updatedAt: "2026-07-23T10:00:00.000Z",
      updatedBy: "other",
    }),
    putRemote: async () => {
      putCalls += 1;
      throw new Error("Malformed remote care must not be pushed.");
    },
    now: () => "2026-07-23T10:01:00.000Z",
  });

  assert.equal(await coordinator.syncFromServer(HOUSEHOLD_ID), false);
  assert.equal(putCalls, 0);
  assert.equal(snapshot.serverVersion, 7);
  assert.deepEqual(snapshot.acknowledged, {
    version: 7,
    doc: acknowledgedDoc,
  });
  assert.deepEqual(snapshot.currentDoc, acknowledgedDoc);
  assert.match(snapshot.documentSyncError, /invalid|retry/i);
});

test("a no-op push retains a visible document error until a network refresh succeeds", async () => {
  const acknowledgedDoc = {
    createdAt: "2026-07-20T08:00:00.000Z",
    updatedAt: "2026-07-23T09:00:00.000Z",
    profile: { name: "Household dog" },
  };
  const visibleError =
    "Household care sync needs a retry. Local care remains saved.";
  let snapshot: any = {
    currentDoc: acknowledgedDoc,
    serverVersion: 7,
    acknowledged: {
      version: 7,
      doc: acknowledgedDoc,
    },
    conflicts: [],
    documentSyncError: visibleError,
  };
  let putCalls = 0;
  const coordinator = createCareDocSyncCoordinator({
    readSnapshot: () => snapshot,
    commitSnapshot: (next) => {
      snapshot = next;
    },
    normalizeDoc: (value: unknown) => value as any,
    isCompleteDoc: acceptSyntheticTestDoc,
    getRemote: async () => ({
      householdId: HOUSEHOLD_ID,
      version: 7,
      doc: acknowledgedDoc,
      updatedAt: acknowledgedDoc.updatedAt,
      updatedBy: "household-member",
    }),
    putRemote: async () => {
      putCalls += 1;
      throw new Error("No content changed.");
    },
    now: () => "2026-07-23T10:00:00.000Z",
  });

  assert.equal(await coordinator.requestPush(HOUSEHOLD_ID), false);
  assert.equal(putCalls, 0);
  assert.equal(snapshot.documentSyncError, visibleError);

  assert.equal(await coordinator.syncFromServer(HOUSEHOLD_ID), true);
  assert.equal(snapshot.documentSyncError, null);
});

test("a 409 must advance beyond the attempted version before it can become the acknowledged base", async () => {
  const localDoc = {
    createdAt: "2026-07-20T08:00:00.000Z",
    updatedAt: "2026-07-23T10:00:00.000Z",
    profile: { name: "Local edit" },
  };
  const baseDoc = {
    ...localDoc,
    updatedAt: "2026-07-23T09:00:00.000Z",
    profile: { name: "Base" },
  };
  let snapshot: any = {
    currentDoc: localDoc,
    serverVersion: 7,
    acknowledged: { version: 7, doc: baseDoc },
    conflicts: [],
    documentSyncError: null,
  };
  let putCalls = 0;
  const coordinator = createCareDocSyncCoordinator({
    readSnapshot: () => snapshot,
    commitSnapshot: (next) => {
      snapshot = next;
    },
    normalizeDoc: (value: unknown) => value as any,
    isCompleteDoc: acceptSyntheticTestDoc,
    getRemote: async () => {
      throw new Error("not used");
    },
    putRemote: async () => {
      putCalls += 1;
      throw {
        status: 409,
        data: {
          householdId: HOUSEHOLD_ID,
          version: 7,
          doc: {
            ...baseDoc,
            profile: { name: "Equal-version response" },
          },
          updatedAt: "2026-07-23T10:01:00.000Z",
          updatedBy: "other",
        },
      };
    },
    now: () => "2026-07-23T10:02:00.000Z",
  });

  assert.equal(await coordinator.requestPush(HOUSEHOLD_ID), false);
  assert.equal(putCalls, 1);
  assert.equal(snapshot.serverVersion, 7);
  assert.deepEqual(snapshot.acknowledged, { version: 7, doc: baseDoc });
  assert.deepEqual(snapshot.currentDoc, localDoc);
  assert.deepEqual(snapshot.conflicts, []);
  assert.match(snapshot.documentSyncError, /invalid|retry/i);
});

test("a 409 with an invalid updatedAt is rejected without retry or baseline movement", async () => {
  const localDoc = {
    createdAt: "2026-07-20T08:00:00.000Z",
    updatedAt: "2026-07-23T10:00:00.000Z",
    profile: { name: "Local edit" },
  };
  const baseDoc = {
    ...localDoc,
    updatedAt: "2026-07-23T09:00:00.000Z",
    profile: { name: "Base" },
  };
  let snapshot: any = {
    currentDoc: localDoc,
    serverVersion: 7,
    acknowledged: { version: 7, doc: baseDoc },
    conflicts: [],
    documentSyncError: null,
  };
  let putCalls = 0;
  const coordinator = createCareDocSyncCoordinator({
    readSnapshot: () => snapshot,
    commitSnapshot: (next) => {
      snapshot = next;
    },
    normalizeDoc: (value: unknown) => value as any,
    isCompleteDoc: acceptSyntheticTestDoc,
    getRemote: async () => {
      throw new Error("not used");
    },
    putRemote: async () => {
      putCalls += 1;
      throw {
        status: 409,
        data: {
          householdId: HOUSEHOLD_ID,
          version: 8,
          doc: {
            ...baseDoc,
            profile: { name: "Invalid timestamp response" },
          },
          updatedAt: "not-a-real-timestamp",
          updatedBy: "other",
        },
      };
    },
    now: () => "2026-07-23T10:02:00.000Z",
  });

  assert.equal(await coordinator.requestPush(HOUSEHOLD_ID), false);
  assert.equal(putCalls, 1);
  assert.equal(snapshot.serverVersion, 7);
  assert.deepEqual(snapshot.acknowledged, { version: 7, doc: baseDoc });
  assert.deepEqual(snapshot.currentDoc, localDoc);
  assert.deepEqual(snapshot.conflicts, []);
  assert.match(snapshot.documentSyncError, /invalid|retry/i);
});

test("a hung PUT from an old household generation cannot block or overwrite the new household", async () => {
  const oldPut = deferred<any>();
  let putCalls = 0;
  let snapshot: any = {
    currentDoc: {
      createdAt: "2026-07-01T08:00:00.000Z",
      updatedAt: "2026-07-23T10:00:00.000Z",
      profile: { name: "Household one local" },
    },
    serverVersion: 7,
    acknowledged: {
      version: 7,
      doc: {
        createdAt: "2026-07-01T08:00:00.000Z",
        updatedAt: "2026-07-23T09:00:00.000Z",
        profile: { name: "Household one base" },
      },
    },
    conflicts: [],
    documentSyncError: null,
  };
  const coordinator = createCareDocSyncCoordinator({
    readSnapshot: () => snapshot,
    commitSnapshot: (next) => {
      snapshot = next;
    },
    normalizeDoc: (value: unknown) => value as any,
    isCompleteDoc: acceptSyntheticTestDoc,
    getRemote: async () => {
      throw new Error("not used");
    },
    putRemote: async (body) => {
      putCalls += 1;
      if (putCalls === 1) return oldPut.promise;
      return {
        householdId: OTHER_HOUSEHOLD_ID,
        version: body.version + 1,
        doc: body.doc,
        updatedAt: "2026-07-23T10:03:00.000Z",
        updatedBy: "new-household-user",
      };
    },
    now: () => "2026-07-23T10:03:00.000Z",
  });

  const oldResult = coordinator.requestPush(HOUSEHOLD_ID);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(putCalls, 1);

  coordinator.beginGeneration();
  snapshot = {
    currentDoc: {
      createdAt: "2026-07-02T08:00:00.000Z",
      updatedAt: "2026-07-23T10:02:00.000Z",
      profile: { name: "Household two local" },
    },
    serverVersion: 3,
    acknowledged: {
      version: 3,
      doc: {
        createdAt: "2026-07-02T08:00:00.000Z",
        updatedAt: "2026-07-23T10:01:00.000Z",
        profile: { name: "Household two base" },
      },
    },
    conflicts: [],
    documentSyncError: null,
  };
  const newResult = coordinator.requestPush(
    OTHER_HOUSEHOLD_ID,
  );
  assert.equal(await newResult, true);
  assert.equal(putCalls, 2);
  assert.equal(snapshot.serverVersion, 4);
  assert.equal(snapshot.currentDoc.profile.name, "Household two local");

  oldPut.resolve({
    householdId: HOUSEHOLD_ID,
    version: 8,
    doc: {
      createdAt: "2026-07-01T08:00:00.000Z",
      updatedAt: "2026-07-23T10:03:30.000Z",
      profile: { name: "Stale household one response" },
    },
    updatedAt: "2026-07-23T10:03:30.000Z",
    updatedBy: "old-household-user",
  });
  assert.equal(await oldResult, false);
  assert.equal(snapshot.serverVersion, 4);
  assert.equal(snapshot.acknowledged.version, 4);
  assert.equal(snapshot.currentDoc.profile.name, "Household two local");
});

test("a second 409 records the exact latest alternatives and stops after one retry", async () => {
  const baseDoc = {
    createdAt: "2026-07-01T08:00:00.000Z",
    updatedAt: "2026-07-23T09:00:00.000Z",
    profile: { name: "Base" },
  };
  const localDoc = {
    ...baseDoc,
    updatedAt: "2026-07-23T10:00:00.000Z",
    profile: { name: "Local" },
  };
  const firstServerDoc = {
    ...baseDoc,
    updatedAt: "2026-07-23T10:01:00.000Z",
    profile: { name: "Server one" },
  };
  const secondServerDoc = {
    ...baseDoc,
    updatedAt: "2026-07-23T10:02:00.000Z",
    profile: { name: "Server two" },
  };
  let snapshot: any = {
    currentDoc: localDoc,
    serverVersion: 7,
    acknowledged: { version: 7, doc: baseDoc },
    conflicts: [],
    documentSyncError: null,
  };
  const putBodies: Array<{ version: number; doc: any }> = [];
  const coordinator = createCareDocSyncCoordinator({
    readSnapshot: () => snapshot,
    commitSnapshot: (next) => {
      snapshot = next;
    },
    normalizeDoc: (value: unknown) => value as any,
    isCompleteDoc: acceptSyntheticTestDoc,
    getRemote: async () => {
      throw new Error("not used");
    },
    putRemote: async (body) => {
      putBodies.push(structuredClone(body));
      const first = putBodies.length === 1;
      throw {
        status: 409,
        data: {
          householdId: HOUSEHOLD_ID,
          version: first ? 8 : 9,
          doc: first ? firstServerDoc : secondServerDoc,
          updatedAt: first
            ? "2026-07-23T10:01:00.000Z"
            : "2026-07-23T10:02:00.000Z",
          updatedBy: "other",
        },
      };
    },
    now: () => "2026-07-23T10:03:00.000Z",
  });

  assert.equal(await coordinator.requestPush(HOUSEHOLD_ID), false);
  assert.equal(putBodies.length, 2);
  assert.equal(putBodies[0].version, 7);
  assert.equal(putBodies[1].version, 8);
  assert.equal(putBodies[1].doc.profile.name, "Local");
  assert.equal(snapshot.serverVersion, 9);
  assert.deepEqual(snapshot.acknowledged, {
    version: 9,
    doc: secondServerDoc,
  });
  assert.equal(snapshot.currentDoc.profile.name, "Local");
  assert.deepEqual(
    snapshot.conflicts.map((conflict: any) => ({
      path: conflict.path,
      server: conflict.server,
      local: conflict.local,
    })),
    [
      {
        path: "profile.name",
        server: { present: true, value: "Server one" },
        local: { present: true, value: "Local" },
      },
      {
        path: "profile.name",
        server: { present: true, value: "Server two" },
        local: { present: true, value: "Local" },
      },
    ],
  );
  assert.match(snapshot.documentSyncError, /changed again|review.*retry/i);
});
