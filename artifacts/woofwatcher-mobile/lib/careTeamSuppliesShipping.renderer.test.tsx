import "./test-support/reactDomLifecycleHost.test.ts";

import assert from "node:assert/strict";
import test from "node:test";
import React, { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { LocalDataResetAppShield } from "@/components/LocalDataResetAppShield";
import { QueryCacheAuthIdentityBoundary } from "@/components/QueryCacheAuthIdentityBoundary";
import { WalkRouteRecorderBridge } from "@/components/WalkRouteRecorder";
import { CareTeamSuppliesScreen } from "@/components/more/CareTeamSuppliesScreen";
import { CareProvider, useCare } from "@/context/CareContext";
import { DevicePreferencesProvider } from "@/context/DevicePreferencesContext";
import {
  LocalDataResetProvider,
  useLocalDataReset,
  type LocalDataResetContextValue,
} from "@/context/LocalDataResetContext";
import { QueryCacheLocalDataResetProvider } from "@/context/QueryCacheLocalDataResetContext";
import {
  CARE_PRESERVED_LOCAL_DATA_KEY,
  CARE_PRIMARY_LOCAL_DATA_KEY,
} from "./careLocalDataReset.ts";
import type { RequiredLocalDataParticipantId } from "./localDataResetRuntime.ts";
import {
  document,
  type MiniElement,
} from "./test-support/reactDomLifecycleHost.test.ts";
import {
  emitCareHouseholdRendererAppState,
  resetCareHouseholdRendererAppState,
} from "./test-support/careHouseholdReactNativeHost.test.tsx";
import {
  getCareHouseholdRendererLocationSnapshot,
  resetCareHouseholdRendererLocation,
  setCareHouseholdRendererLocationPermission,
} from "./test-support/careHouseholdExpoAdapters.test.tsx";
import {
  getCareHouseholdRendererApiCalls,
  resetCareHouseholdRendererApi,
  setCareHouseholdRendererApiHandlers,
} from "./test-support/careHouseholdRendererApi.test.tsx";
import {
  getCareHouseholdRendererPrimaryReadAttempts,
  getCareHouseholdRendererStoredValue,
  resetCareHouseholdRendererAuthStorage,
  setCareHouseholdRendererAuth,
  setCareHouseholdRendererPrimaryReadFailures,
  setCareHouseholdRendererStoredValue,
} from "./test-support/careHouseholdRendererAuthStorage.test.ts";
import {
  createCareIdentityVault,
  parseCareIdentityVault,
  readCareIdentitySlot,
  replaceCareCleanupLedgerScope,
  serializeCareIdentityVault,
  writeCareIdentitySlot,
} from "./careIdentityStorage.ts";
import { CURRENT_CARE_DOC_DATA_VERSION } from "./careDocMigration.ts";
import { CARE_READ_ONLY_MESSAGE } from "./careWriteProtection.ts";
import { CARE_ENTRY_CREATE_REVOKED_CODE } from "./careEntryMutationRevocation.ts";

const A = "household-a";
const B = "household-b";
const C = "household-c";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function freshMe(householdId: string, householdName: string) {
  return {
    authorityObservedAt: "2026-08-29T12:00:00.000Z",
    user: {
      id: "user-a",
      email: "apollo@example.com",
      displayName: "Apollo",
    },
    household: { id: householdId, name: householdName, inviteCode: "" },
    members: [
      {
        id: `member-${householdId}`,
        userId: "user-a",
        role: "owner",
        displayName: "Apollo",
        email: "apollo@example.com",
        isSelf: true,
        accessPassExpiresAt: null,
        accessPassExpired: false,
      },
    ],
  };
}

function temporaryMe(householdId: string, householdName: string) {
  const me = freshMe(householdId, householdName);
  return {
    ...me,
    members: [
      {
        ...me.members[0],
        role: "sitter",
        accessPassExpiresAt: "2026-08-29T13:00:00.000Z",
        accessPassExpired: false,
      },
    ],
  };
}

function freshMeForUser(
  householdId: string,
  householdName: string,
  userId: string,
) {
  const me = freshMe(householdId, householdName);
  return {
    ...me,
    user: {
      ...me.user,
      id: userId,
      email: `${userId}@example.com`,
      displayName: userId,
    },
    members: [
      {
        ...me.members[0],
        id: `member-${userId}-${householdId}`,
        userId,
        displayName: userId,
        email: `${userId}@example.com`,
      },
    ],
  };
}

function memberships(activeHouseholdId = A) {
  return {
    activeHouseholdId,
    memberships: [
      {
        householdId: A,
        householdName: "Phoenix Pack",
        role: "owner",
        accessPassExpiresAt: null,
      },
      {
        householdId: B,
        householdName: "Family Pack",
        role: "adult",
        accessPassExpiresAt: null,
      },
    ],
  };
}

function careEnvelope(householdId: string) {
  return {
    householdId,
    version: 1,
    doc: {},
    updatedAt: "2026-08-29T00:00:00.000Z",
  };
}

const FUTURE_SCHEMA_SNAPSHOT_RAW =
  '{"doc":{"dataVersion":1e400,"futureOnlyValue":"must-remain-opaque","opaqueInteger":9007199254740993},"entries":{"futureIndex":"opaque"},"serverVersion":{"futureClock":41},"futureEnvelope":{"codec":7}}';
const DUPLICATE_SCHEMA_SNAPSHOT_RAW =
  '{"doc":{"dataVersion":999,"futureOnlyValue":"earlier"},"d\\u006fc":{"dataVersion":1,"owner":"last-wins-must-not-open"},"entries":[],"serverVersion":41}';

function futureSchemaVault(dataScope: string): string {
  return `{"format":"woofwatcher.care.identity-v1","slots":{${JSON.stringify(dataScope)}:${FUTURE_SCHEMA_SNAPSHOT_RAW}},"quarantine":[]}`;
}

function duplicateSchemaVault(dataScope: string): string {
  return `{"format":"woofwatcher.care.identity-v1","slots":{${JSON.stringify(dataScope)}:${DUPLICATE_SCHEMA_SNAPSHOT_RAW}},"quarantine":[]}`;
}

const UNSELECTED_FUTURE_SLOT_RAW =
  '{ "doc" : { "dataVersion" : 999, "opaqueInteger" : 9007199254740993, "futureOnlyValue" : "A must remain exact" }, "entries" : [ ], "serverVersion" : 73 }';

function futureAndSupportedVault(
  futureDataScope: string,
  supportedDataScope: string,
): string {
  const foreignCachedEntry = {
    id: "foreign-cached-entry",
    type: "meal",
    title: "Must be quarantined for user B",
    caregiver: "Another user",
    caregiverUserId: "user-a",
    occurredAt: "2026-08-29T00:00:00.000Z",
    details: {
      title: "Must be quarantined for user B",
      householdVisible: false,
    },
  };
  const supportedSlot = {
    doc: { dataVersion: CURRENT_CARE_DOC_DATA_VERSION },
    entries: supportedDataScope === "local" ? [] : [foreignCachedEntry],
    serverVersion: 0,
  };
  return `{"format":"woofwatcher.care.identity-v1","slots":{${JSON.stringify(futureDataScope)}:${UNSELECTED_FUTURE_SLOT_RAW},${JSON.stringify(supportedDataScope)}:${JSON.stringify(supportedSlot)}},"quarantine":[]}`;
}

function cachedOpenWalk(id = "cached-open-walk") {
  return {
    id,
    type: "walk",
    title: "Walk - In progress",
    caregiver: "Apollo",
    caregiverUserId: "user-a",
    occurredAt: "2026-08-29T00:00:00.000Z",
    details: {
      title: "Walk - In progress",
      householdVisible: true,
      walkLifecycle: "in-progress",
      walkStartedAt: "2026-08-29T00:00:00.000Z",
    },
  };
}

function openWalkVault(dataScope: string): string {
  const vault = createCareIdentityVault();
  writeCareIdentitySlot(vault, dataScope, {
    doc: { dataVersion: CURRENT_CARE_DOC_DATA_VERSION },
    entries: [cachedOpenWalk()],
    serverVersion: 1,
  });
  return serializeCareIdentityVault(vault);
}

function retryableCareEntryVault(entries: readonly unknown[]): string {
  const vault = createCareIdentityVault();
  writeCareIdentitySlot(vault, `care-v2:${JSON.stringify(["user-a", A])}`, {
    doc: {},
    entries: [...entries],
    serverVersion: 1,
  });
  return serializeCareIdentityVault(vault);
}

function storedUserAEntryIds(): string[] {
  const dataScope = `care-v2:${JSON.stringify(["user-a", A])}`;
  const raw = getCareHouseholdRendererStoredValue(CARE_PRIMARY_LOCAL_DATA_KEY);
  const slot = readCareIdentitySlot<{
    entries?: Array<{ id?: unknown }>;
  }>(parseCareIdentityVault(raw, dataScope).vault, dataScope);
  return (slot?.entries ?? [])
    .map((entry) => entry.id)
    .filter((id): id is string => typeof id === "string");
}

function cachedRetryableCareEntry(
  id: string,
  options: { create?: boolean } = {},
) {
  return {
    id,
    caregiverUserId: "user-a",
    type: "meal",
    title: options.create ? "Deleted create retry" : "Formerly shared edit",
    caregiver: "Apollo",
    occurredAt: "2026-08-29T00:00:00.000Z",
    note: options.create
      ? "This create was deleted on another device."
      : "This edit must not flash after access is revoked.",
    details: { householdVisible: true, clientSyncRevision: 1 },
    syncStatus: "failed" as const,
    syncError: "Saved locally. Refresh to retry sync.",
    ...(options.create
      ? {}
      : {
          pendingSyncPatch: {
            note: "This edit must not flash after access is revoked.",
          },
        }),
  };
}

function acknowledgedCareEntryRow(
  id: string,
  options: { clientKey?: string; note?: string } = {},
) {
  const row = sharedRendererCareRow(id);
  return {
    ...row,
    note: options.note ?? "Server accepted the pending care change.",
    details: {
      ...row.details,
      title: "Verified care entry",
      ...(options.clientKey ? { clientKey: options.clientKey } : {}),
    },
  };
}

function find(container: MiniElement, label: string): MiniElement | null {
  return container.querySelector(`[aria-label="${label}"]`);
}

async function waitFor(
  predicate: () => unknown,
  description: string,
): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for ${description}.`);
    }
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function waitForOutsideAct(
  predicate: () => unknown,
  description: string,
): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for ${description}.`);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

type CareProbe = ReturnType<typeof useCare>;
let careProbe: CareProbe | null = null;
let resetProbe: LocalDataResetContextValue | null = null;
let filesPrepare: () => Promise<void> = async () => {};

function Probe(): null {
  careProbe = useCare();
  resetProbe = useLocalDataReset();
  return null;
}

function ResetSupportOwners(): null {
  const { attachRequiredParticipant } = useLocalDataReset();
  useEffect(() => {
    const ids: RequiredLocalDataParticipantId[] = [
      "auth-credentials",
      "avatar",
      "files",
      "web-runtime",
    ];
    const cleanups = ids.map((id) =>
      attachRequiredParticipant(id, {
        async prepare() {
          if (id === "files") await filesPrepare();
        },
        async commit() {},
      }),
    );
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [attachRequiredParticipant]);
  return null;
}

function Harness(): React.JSX.Element {
  return (
    <LocalDataResetProvider>
      <QueryCacheLocalDataResetProvider>
        <DevicePreferencesProvider>
          <CareProvider>
            <Probe />
            <ResetSupportOwners />
            <WalkRouteRecorderBridge />
            <LocalDataResetAppShield>
              <QueryCacheAuthIdentityBoundary>
                <CareTeamSuppliesScreen section="care-team" onBack={() => {}} />
              </QueryCacheAuthIdentityBoundary>
            </LocalDataResetAppShield>
          </CareProvider>
        </DevicePreferencesProvider>
      </QueryCacheLocalDataResetProvider>
    </LocalDataResetProvider>
  );
}

function installHealthyApi(): void {
  let currentMe = freshMe(A, "Phoenix Pack");
  resetCareHouseholdRendererApi({
    getMe: async () => currentMe,
    getCareState: async () => careEnvelope(currentMe.household.id),
    listCareEntries: async () => [],
    putCareState: async (input: { version: number; doc: unknown }) => ({
      householdId: currentMe.household.id,
      version: input.version + 1,
      doc: input.doc,
      updatedAt: "2026-08-29T00:00:00.000Z",
    }),
    listMyHouseholdMemberships: async () => memberships(currentMe.household.id),
    activateHousehold: async () => currentMe,
    updateMe: async () => currentMe,
  });
}

function sharedRendererCareRow(id: string) {
  return {
    id,
    householdId: A,
    petId: null,
    type: "meal",
    occurredAt: "2026-08-29T00:00:00.000Z",
    caregiverUserId: "user-a",
    caregiverName: "Apollo",
    mood: null,
    severity: null,
    note: "Formerly shared private note",
    details: {
      title: "Formerly shared meal",
      householdVisible: true,
    },
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
  };
}

function CareEntryBoundaryProbe({
  renderLog,
  onRender,
}: {
  renderLog: string[];
  onRender?: (entryIds: string) => void;
}): React.JSX.Element {
  const { state } = useCare();
  const entryIds = state.entries.map((entry) => entry.id).join(",") || "empty";
  renderLog.push(entryIds);
  onRender?.(entryIds);
  return <div aria-label={`care-entry-probe-${entryIds}`}>{entryIds}</div>;
}

function CareEntryBoundaryHarness({
  renderLog,
  onRender,
}: {
  renderLog: string[];
  onRender?: (entryIds: string) => void;
}): React.JSX.Element {
  return (
    <LocalDataResetProvider>
      <QueryCacheLocalDataResetProvider>
        <CareProvider>
          <Probe />
          <QueryCacheAuthIdentityBoundary>
            <CareEntryBoundaryProbe renderLog={renderLog} onRender={onRender} />
          </QueryCacheAuthIdentityBoundary>
        </CareProvider>
      </QueryCacheLocalDataResetProvider>
    </LocalDataResetProvider>
  );
}

function CareContextIdentityHarness({
  parentEpoch,
}: {
  parentEpoch: number;
}): React.JSX.Element {
  return (
    <LocalDataResetProvider>
      <QueryCacheLocalDataResetProvider>
        <CareProvider>
          <div aria-label={`care-context-parent-${parentEpoch}`} />
          <Probe />
        </CareProvider>
      </QueryCacheLocalDataResetProvider>
    </LocalDataResetProvider>
  );
}

async function mountCareEntryBoundary(
  renderLog: string[],
  onRender?: (entryIds: string) => void,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container as never);
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <CareEntryBoundaryHarness renderLog={renderLog} onRender={onRender} />
      </QueryClientProvider>,
    );
  });
  return {
    container,
    async dispose() {
      await act(async () => root.unmount());
      queryClient.clear();
      container.parentNode?.removeChild(container);
    },
  };
}

function WalkRecorderHarness(): React.JSX.Element {
  return (
    <LocalDataResetProvider>
      <CareProvider>
        <Probe />
        <WalkRouteRecorderBridge />
      </CareProvider>
    </LocalDataResetProvider>
  );
}

test(
  "an unrelated parent render preserves the settled Care context value identity",
  { timeout: 10_000 },
  async () => {
    resetCareHouseholdRendererAuthStorage();
    resetCareHouseholdRendererAppState();
    resetCareHouseholdRendererLocation();
    installHealthyApi();

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container as never);

    try {
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <CareContextIdentityHarness parentEpoch={0} />
          </QueryClientProvider>,
        );
      });
      await waitFor(
        () => careProbe?.isInitialSyncSettled,
        "the Care provider to settle before the identity comparison",
      );

      const before = careProbe;
      assert.ok(before);

      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <CareContextIdentityHarness parentEpoch={1} />
          </QueryClientProvider>,
        );
      });

      assert.equal(
        careProbe,
        before,
        "a parent-only render must not fan out a new Care context value",
      );
    } finally {
      await act(async () => root.unmount());
      queryClient.clear();
      container.parentNode?.removeChild(container);
      careProbe = null;
      resetCareHouseholdRendererAuthStorage();
      resetCareHouseholdRendererAppState();
      resetCareHouseholdRendererLocation();
    }
  },
);

async function seedFormerlySharedUserBCache(): Promise<string> {
  const staleRow = sharedRendererCareRow("formerly-shared-row");
  setCareHouseholdRendererAuth({
    isLoaded: true,
    isSignedIn: true,
    userId: "user-b",
    sessionId: "session-b",
  });
  resetCareHouseholdRendererApi({
    getMe: async () => freshMeForUser(A, "Phoenix Pack", "user-b"),
    getCareState: async () => careEnvelope(A),
    listCareEntries: async () => [staleRow],
    putCareState: async (input: { version: number; doc: unknown }) => ({
      ...careEnvelope(A),
      version: input.version + 1,
      doc: input.doc,
    }),
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container as never);
  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CareEntryBoundaryHarness renderLog={[]} />
        </QueryClientProvider>,
      );
    });
    await waitFor(
      () => find(container, "care-entry-probe-formerly-shared-row"),
      "the authoritative formerly-shared row used to seed user B's cache",
    );
    await waitFor(
      () =>
        getCareHouseholdRendererStoredValue(
          CARE_PRIMARY_LOCAL_DATA_KEY,
        )?.includes("formerly-shared-row"),
      "the formerly-shared row to persist in user B's identity slot",
    );
    const raw = getCareHouseholdRendererStoredValue(
      CARE_PRIMARY_LOCAL_DATA_KEY,
    );
    assert.ok(raw);
    return raw;
  } finally {
    await act(async () => root.unmount());
    queryClient.clear();
    container.parentNode?.removeChild(container);
  }
}

test(
  "a cached signed-in open walk cannot start location capture before authoritative omission settles",
  { timeout: 10_000 },
  async () => {
    resetCareHouseholdRendererAuthStorage();
    setCareHouseholdRendererStoredValue(
      CARE_PRIMARY_LOCAL_DATA_KEY,
      openWalkVault(`care-v2:${JSON.stringify(["user-a", A])}`),
    );
    const freshDoc = deferred<ReturnType<typeof careEnvelope>>();
    let docAttempts = 0;
    resetCareHouseholdRendererLocation();
    setCareHouseholdRendererLocationPermission(true);
    const priorNavigator = Object.getOwnPropertyDescriptor(
      globalThis,
      "navigator",
    );
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        product: "ReactNative",
      },
    });
    resetCareHouseholdRendererApi({
      getMe: async () => freshMe(A, "Phoenix Pack"),
      getCareState: async () => {
        docAttempts += 1;
        return freshDoc.promise;
      },
      listCareEntries: async () => [],
      putCareState: async (input: { version: number; doc: unknown }) => ({
        ...careEnvelope(A),
        version: input.version + 1,
        doc: input.doc,
      }),
    });
    careProbe = null;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container as never);

    try {
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <WalkRecorderHarness />
          </QueryClientProvider>,
        );
      });
      await waitFor(
        () =>
          docAttempts === 1 &&
          careProbe?.isLoaded &&
          careProbe.initialSyncStatus.state === "pending" &&
          careProbe.state.entries.some(
            (entry) => entry.id === "cached-open-walk",
          ),
        "the hydrated cached walk and deferred first authoritative sync",
      );
      assert.equal(
        getCareHouseholdRendererLocationSnapshot().permissionRequests,
        0,
        "cached Care must not prompt for or start location before first sync",
      );
      assert.equal(getCareHouseholdRendererLocationSnapshot().watchStarts, 0);

      await act(async () => freshDoc.resolve(careEnvelope(A)));
      await waitFor(
        () =>
          careProbe?.initialSyncStatus.state === "settled" &&
          careProbe.state.entries.length === 0,
        "the authoritative empty list to replace the cached open walk",
      );
      assert.equal(
        getCareHouseholdRendererLocationSnapshot().permissionRequests,
        0,
        "an authoritatively omitted walk must never start location capture",
      );
      assert.deepEqual(getCareHouseholdRendererLocationSnapshot(), {
        permissionRequests: 0,
        watchStarts: 0,
        watchStops: 0,
      });
    } finally {
      freshDoc.resolve(careEnvelope(A));
      await act(async () => root.unmount());
      queryClient.clear();
      container.parentNode?.removeChild(container);
      if (priorNavigator) {
        Object.defineProperty(globalThis, "navigator", priorNavigator);
      } else {
        delete (globalThis as any).navigator;
      }
      resetCareHouseholdRendererLocation();
      resetCareHouseholdRendererAuthStorage();
    }
  },
);

test(
  "successfully hydrated local Care starts its cached open walk without a server authority call",
  { timeout: 10_000 },
  async () => {
    resetCareHouseholdRendererAuthStorage();
    setCareHouseholdRendererAuth({
      isLoaded: true,
      isSignedIn: false,
      userId: null,
      sessionId: null,
    });
    setCareHouseholdRendererStoredValue(
      CARE_PRIMARY_LOCAL_DATA_KEY,
      openWalkVault("local"),
    );
    resetCareHouseholdRendererApi();
    resetCareHouseholdRendererLocation();
    setCareHouseholdRendererLocationPermission(true);
    const priorNavigator = Object.getOwnPropertyDescriptor(
      globalThis,
      "navigator",
    );
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        product: "ReactNative",
      },
    });
    careProbe = null;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container as never);

    try {
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <WalkRecorderHarness />
          </QueryClientProvider>,
        );
      });
      await waitFor(
        () =>
          careProbe?.identityScopeStatus.state === "local" &&
          careProbe.initialSyncStatus.isSettled &&
          careProbe.state.entries.some(
            (entry) => entry.id === "cached-open-walk",
          ) &&
          getCareHouseholdRendererLocationSnapshot().watchStarts === 1,
        "successful local hydration to admit its cached open walk",
      );
      assert.deepEqual(getCareHouseholdRendererLocationSnapshot(), {
        permissionRequests: 1,
        watchStarts: 1,
        watchStops: 0,
      });
      assert.deepEqual(getCareHouseholdRendererApiCalls(), []);
    } finally {
      await act(async () => root.unmount());
      assert.equal(
        getCareHouseholdRendererLocationSnapshot().watchStops,
        getCareHouseholdRendererLocationSnapshot().watchStarts === 0 ? 0 : 1,
      );
      queryClient.clear();
      container.parentNode?.removeChild(container);
      if (priorNavigator) {
        Object.defineProperty(globalThis, "navigator", priorNavigator);
      } else {
        delete (globalThis as any).navigator;
      }
      resetCareHouseholdRendererLocation();
      resetCareHouseholdRendererAuthStorage();
    }
  },
);

test(
  "real initial Care sync hides a formerly-shared cache through failure, deferred retry, and authoritative omission",
  { timeout: 10_000 },
  async () => {
    resetCareHouseholdRendererAuthStorage();
    setCareHouseholdRendererAuth({
      isLoaded: true,
      isSignedIn: true,
      userId: "user-b",
      sessionId: "session-b",
    });
    careProbe = null;
    const staleRow = sharedRendererCareRow("formerly-shared-row");
    resetCareHouseholdRendererApi({
      getMe: async () => freshMeForUser(A, "Phoenix Pack", "user-b"),
      getCareState: async () => careEnvelope(A),
      listCareEntries: async () => [staleRow],
      putCareState: async (input: { version: number; doc: unknown }) => ({
        ...careEnvelope(A),
        version: input.version + 1,
        doc: input.doc,
      }),
    });

    const seedClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const seedContainer = document.createElement("div");
    document.body.appendChild(seedContainer);
    const seedRoot = createRoot(seedContainer as never);
    try {
      await act(async () => {
        seedRoot.render(
          <QueryClientProvider client={seedClient}>
            <CareEntryBoundaryHarness renderLog={[]} />
          </QueryClientProvider>,
        );
      });
      await waitFor(
        () => find(seedContainer, "care-entry-probe-formerly-shared-row"),
        "the first authoritative shared row",
      );
      await waitFor(
        () =>
          getCareHouseholdRendererStoredValue(
            CARE_PRIMARY_LOCAL_DATA_KEY,
          )?.includes("formerly-shared-row"),
        "the identity-scoped cache to persist the formerly-shared row",
      );
    } finally {
      await act(async () => seedRoot.unmount());
      seedClient.clear();
      seedContainer.parentNode?.removeChild(seedContainer);
    }

    const retryDoc = deferred<ReturnType<typeof careEnvelope>>();
    let docAttempts = 0;
    resetCareHouseholdRendererApi({
      getMe: async () => freshMeForUser(A, "Phoenix Pack", "user-b"),
      getCareState: async () => {
        docAttempts += 1;
        if (docAttempts <= 3) throw new TypeError("offline");
        return retryDoc.promise;
      },
      listCareEntries: async () => [],
      putCareState: async (input: { version: number; doc: unknown }) => ({
        ...careEnvelope(A),
        version: input.version + 1,
        doc: input.doc,
      }),
    });
    careProbe = null;
    const renderLog: string[] = [];
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container as never);

    try {
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <CareEntryBoundaryHarness renderLog={renderLog} />
          </QueryClientProvider>,
        );
      });
      await waitFor(
        () => docAttempts >= 1,
        "the first authoritative replacement attempt",
      );
      assert.equal(
        find(container, "care-entry-probe-formerly-shared-row"),
        null,
        "the cached row must be omitted before the exact generation refresh settles",
      );
      await waitFor(
        () => careProbe?.initialSyncStatus.state === "error",
        "bounded initial sync failures to become actionable",
      );
      assert.equal(docAttempts, 3);
      assert.ok(find(container, "Retry care refresh"));
      assert.ok(
        find(
          container,
          "Care refresh needs attention. WoofWatcher could not confirm the current household records. Try again.",
        ),
      );
      assert.deepEqual(renderLog, []);

      const retry = find(container, "Retry care refresh");
      assert.ok(retry);
      await act(async () => retry.click());
      await waitFor(
        () => docAttempts === 4,
        "the manual initial sync retry to start",
      );
      assert.equal(careProbe?.initialSyncStatus.state, "pending");
      assert.ok(
        find(
          container,
          "Refreshing care records…. Personal screens will reopen after the current household records are refreshed.",
        ),
      );
      assert.equal(
        find(container, "care-entry-probe-formerly-shared-row"),
        null,
      );
      assert.deepEqual(renderLog, []);

      await act(async () => retryDoc.resolve(careEnvelope(A)));
      await waitFor(
        () => find(container, "care-entry-probe-empty"),
        "the authoritative omission to replace the stale cache before mount",
      );
      assert.deepEqual(
        renderLog,
        ["empty"],
        "no personal child render may observe the formerly-shared cached row",
      );
    } finally {
      retryDoc.resolve(careEnvelope(A));
      await act(async () => root.unmount());
      queryClient.clear();
      container.parentNode?.removeChild(container);
      resetCareHouseholdRendererAuthStorage();
    }
  },
);

test(
  "initial sync keeps an absent failed PATCH shielded until exact 404 revocation is durable",
  { timeout: 10_000 },
  async () => {
    resetCareHouseholdRendererAuthStorage();
    const entryId = "server-formerly-shared-edit";
    setCareHouseholdRendererStoredValue(
      CARE_PRIMARY_LOCAL_DATA_KEY,
      retryableCareEntryVault([cachedRetryableCareEntry(entryId)]),
    );
    const patchResult = deferred<ReturnType<typeof acknowledgedCareEntryRow>>();
    let patchStarted = false;
    resetCareHouseholdRendererApi({
      getMe: async () => freshMe(A, "Phoenix Pack"),
      getCareState: async () => careEnvelope(A),
      listCareEntries: async () => [],
      putCareState: async (input: { version: number; doc: unknown }) => ({
        ...careEnvelope(A),
        version: input.version + 1,
        doc: input.doc,
      }),
      updateCareEntry: async () => {
        patchStarted = true;
        return patchResult.promise;
      },
    });
    careProbe = null;
    const renderLog: string[] = [];
    const storedIdsAtRender: string[][] = [];
    const mounted = await mountCareEntryBoundary(renderLog, () => {
      storedIdsAtRender.push(storedUserAEntryIds());
    });

    try {
      await waitFor(() => patchStarted, "the exact pending PATCH retry");
      assert.equal(careProbe?.initialSyncStatus.state, "pending");
      assert.deepEqual(
        renderLog,
        [],
        "the absent local edit must not render while its exact PATCH is unresolved",
      );

      await act(async () => {
        patchResult.reject(
          Object.assign(new Error("entry is no longer visible"), {
            status: 404,
          }),
        );
      });
      await waitFor(
        () => find(mounted.container, "care-entry-probe-empty"),
        "durable PATCH 404 purge before admission",
      );

      assert.equal(renderLog.includes(entryId), false);
      assert.ok(renderLog.length > 0);
      assert.ok(renderLog.every((entryIds) => entryIds === "empty"));
      assert.ok(
        storedIdsAtRender.every((entryIds) => !entryIds.includes(entryId)),
        "the exact identity slot must be clean before the personal child mounts",
      );
      assert.ok(
        getCareHouseholdRendererStoredValue(
          CARE_PRESERVED_LOCAL_DATA_KEY,
        )?.includes(entryId),
        "terminal PATCH revocation keeps its independent durable suppression ledger",
      );
      assert.equal(careProbe?.initialSyncStatus.state, "settled");
    } finally {
      patchResult.resolve(acknowledgedCareEntryRow(entryId));
      await mounted.dispose();
      resetCareHouseholdRendererAuthStorage();
    }
  },
);

test(
  "initial sync keeps an absent failed PATCH shielded until exact success is durable",
  { timeout: 10_000 },
  async () => {
    resetCareHouseholdRendererAuthStorage();
    const entryId = "server-valid-offline-edit";
    setCareHouseholdRendererStoredValue(
      CARE_PRIMARY_LOCAL_DATA_KEY,
      retryableCareEntryVault([cachedRetryableCareEntry(entryId)]),
    );
    const patchResult = deferred<ReturnType<typeof acknowledgedCareEntryRow>>();
    let patchStarted = false;
    resetCareHouseholdRendererApi({
      getMe: async () => freshMe(A, "Phoenix Pack"),
      getCareState: async () => careEnvelope(A),
      listCareEntries: async () => [],
      putCareState: async (input: { version: number; doc: unknown }) => ({
        ...careEnvelope(A),
        version: input.version + 1,
        doc: input.doc,
      }),
      updateCareEntry: async () => {
        patchStarted = true;
        return patchResult.promise;
      },
    });
    careProbe = null;
    const renderLog: string[] = [];
    const storedIdsAtRender: string[][] = [];
    const mounted = await mountCareEntryBoundary(renderLog, () => {
      storedIdsAtRender.push(storedUserAEntryIds());
    });

    try {
      await waitFor(() => patchStarted, "the deferred successful PATCH retry");
      assert.equal(careProbe?.initialSyncStatus.state, "pending");
      assert.deepEqual(renderLog, []);

      await act(async () => {
        patchResult.resolve(
          acknowledgedCareEntryRow(entryId, {
            note: "The exact offline edit reached the server.",
          }),
        );
      });
      await waitFor(
        () => find(mounted.container, `care-entry-probe-${entryId}`),
        "verified PATCH success before admission",
      );

      assert.deepEqual(renderLog, [entryId]);
      assert.ok(
        storedIdsAtRender.every((entryIds) => entryIds.includes(entryId)),
      );
      const entry = careProbe?.state.entries.find(
        (candidate) => candidate.id === entryId,
      );
      assert.equal(entry?.syncStatus, "synced");
      assert.equal(entry?.pendingSyncPatch, undefined);
      assert.equal(careProbe?.initialSyncStatus.state, "settled");
    } finally {
      patchResult.resolve(acknowledgedCareEntryRow(entryId));
      await mounted.dispose();
      resetCareHouseholdRendererAuthStorage();
    }
  },
);

test(
  "initial sync keeps a deleted temp CREATE shielded until exact 410 revocation is durable",
  { timeout: 10_000 },
  async () => {
    resetCareHouseholdRendererAuthStorage();
    const tempId = "temp_deleted-on-another-device";
    setCareHouseholdRendererStoredValue(
      CARE_PRIMARY_LOCAL_DATA_KEY,
      retryableCareEntryVault([
        cachedRetryableCareEntry(tempId, { create: true }),
      ]),
    );
    const createResult = deferred<ReturnType<typeof acknowledgedCareEntryRow>>();
    let createStarted = false;
    let submittedClientKey: unknown;
    resetCareHouseholdRendererApi({
      getMe: async () => freshMe(A, "Phoenix Pack"),
      getCareState: async () => careEnvelope(A),
      listCareEntries: async () => [],
      putCareState: async (input: { version: number; doc: unknown }) => ({
        ...careEnvelope(A),
        version: input.version + 1,
        doc: input.doc,
      }),
      createCareEntry: async (input: { details?: Record<string, unknown> }) => {
        createStarted = true;
        submittedClientKey = input.details?.clientKey;
        return createResult.promise;
      },
    });
    careProbe = null;
    const renderLog: string[] = [];
    const storedIdsAtRender: string[][] = [];
    const mounted = await mountCareEntryBoundary(renderLog, () => {
      storedIdsAtRender.push(storedUserAEntryIds());
    });

    try {
      await waitFor(() => createStarted, "the exact pending CREATE retry");
      assert.equal(submittedClientKey, tempId);
      assert.equal(careProbe?.initialSyncStatus.state, "pending");
      assert.deepEqual(renderLog, []);

      await act(async () => {
        createResult.reject(
          Object.assign(new Error("create identity was revoked"), {
            status: 410,
            data: {
              code: CARE_ENTRY_CREATE_REVOKED_CODE,
              clientKey: tempId,
            },
          }),
        );
      });
      await waitFor(
        () => find(mounted.container, "care-entry-probe-empty"),
        "durable CREATE 410 purge before admission",
      );

      assert.equal(renderLog.includes(tempId), false);
      assert.ok(renderLog.length > 0);
      assert.ok(renderLog.every((entryIds) => entryIds === "empty"));
      assert.ok(
        storedIdsAtRender.every((entryIds) => !entryIds.includes(tempId)),
      );
      assert.ok(
        getCareHouseholdRendererStoredValue(
          CARE_PRESERVED_LOCAL_DATA_KEY,
        )?.includes(tempId),
      );
      assert.equal(careProbe?.initialSyncStatus.state, "settled");
    } finally {
      createResult.resolve(
        acknowledgedCareEntryRow("server-cleanup", { clientKey: tempId }),
      );
      await mounted.dispose();
      resetCareHouseholdRendererAuthStorage();
    }
  },
);

test(
  "initial sync keeps a retryable CREATE shielded until exact success is durable",
  { timeout: 10_000 },
  async () => {
    resetCareHouseholdRendererAuthStorage();
    const tempId = "temp_valid-offline-create";
    const serverId = "server-valid-offline-create";
    setCareHouseholdRendererStoredValue(
      CARE_PRIMARY_LOCAL_DATA_KEY,
      retryableCareEntryVault([
        cachedRetryableCareEntry(tempId, { create: true }),
      ]),
    );
    const createResult = deferred<ReturnType<typeof acknowledgedCareEntryRow>>();
    const patchResult = deferred<ReturnType<typeof acknowledgedCareEntryRow>>();
    let createStarted = false;
    let patchStarted = false;
    resetCareHouseholdRendererApi({
      getMe: async () => freshMe(A, "Phoenix Pack"),
      getCareState: async () => careEnvelope(A),
      listCareEntries: async () => [],
      putCareState: async (input: { version: number; doc: unknown }) => ({
        ...careEnvelope(A),
        version: input.version + 1,
        doc: input.doc,
      }),
      createCareEntry: async () => {
        createStarted = true;
        return createResult.promise;
      },
      updateCareEntry: async () => {
        patchStarted = true;
        return patchResult.promise;
      },
    });
    careProbe = null;
    const renderLog: string[] = [];
    const storedIdsAtRender: string[][] = [];
    const mounted = await mountCareEntryBoundary(renderLog, () => {
      storedIdsAtRender.push(storedUserAEntryIds());
    });

    try {
      await waitFor(() => createStarted, "the deferred successful CREATE retry");
      assert.equal(careProbe?.initialSyncStatus.state, "pending");
      assert.deepEqual(renderLog, []);

      await act(async () => {
        createResult.resolve(
          acknowledgedCareEntryRow(serverId, { clientKey: tempId }),
        );
      });
      await waitFor(
        () => patchStarted,
        "the exact PATCH that verifies the retried CREATE snapshot",
      );
      assert.deepEqual(
        renderLog,
        [],
        "an idempotent CREATE acknowledgement is not enough to expose a possibly newer local snapshot",
      );
      await act(async () => {
        patchResult.resolve(
          acknowledgedCareEntryRow(serverId, { clientKey: tempId }),
        );
      });
      await waitFor(
        () => find(mounted.container, `care-entry-probe-${serverId}`),
        "verified CREATE success before admission",
      );

      assert.equal(renderLog.includes(tempId), false);
      assert.ok(renderLog.length > 0);
      assert.ok(renderLog.every((entryIds) => entryIds === serverId));
      assert.ok(
        storedIdsAtRender.every(
          (entryIds) =>
            !entryIds.includes(tempId) && entryIds.includes(serverId),
        ),
      );
      assert.equal(careProbe?.state.entries[0]?.syncStatus, "synced");
      assert.equal(careProbe?.initialSyncStatus.state, "settled");
    } finally {
      createResult.resolve(
        acknowledgedCareEntryRow(serverId, { clientKey: tempId }),
      );
      patchResult.resolve(
        acknowledgedCareEntryRow(serverId, { clientKey: tempId }),
      );
      await mounted.dispose();
      resetCareHouseholdRendererAuthStorage();
    }
  },
);

test(
  "initial sync exposes retry instead of rendering an unverifiable PATCH after transient failures",
  { timeout: 10_000 },
  async () => {
    resetCareHouseholdRendererAuthStorage();
    const entryId = "server-offline-unverified-edit";
    setCareHouseholdRendererStoredValue(
      CARE_PRIMARY_LOCAL_DATA_KEY,
      retryableCareEntryVault([cachedRetryableCareEntry(entryId)]),
    );
    let patchAttempts = 0;
    resetCareHouseholdRendererApi({
      getMe: async () => freshMe(A, "Phoenix Pack"),
      getCareState: async () => careEnvelope(A),
      listCareEntries: async () => [],
      putCareState: async (input: { version: number; doc: unknown }) => ({
        ...careEnvelope(A),
        version: input.version + 1,
        doc: input.doc,
      }),
      updateCareEntry: async () => {
        patchAttempts += 1;
        throw Object.assign(new Error("provider unavailable"), { status: 503 });
      },
    });
    careProbe = null;
    const renderLog: string[] = [];
    const mounted = await mountCareEntryBoundary(renderLog);

    try {
      await waitFor(
        () => careProbe?.initialSyncStatus.state === "error",
        "bounded transient reconciliation failures",
      );
      assert.equal(patchAttempts, 3);
      assert.deepEqual(renderLog, []);
      assert.equal(
        find(mounted.container, `care-entry-probe-${entryId}`),
        null,
      );
      assert.ok(find(mounted.container, "Retry care refresh"));
      assert.equal(careProbe?.initialSyncStatus.retryable, true);
    } finally {
      await mounted.dispose();
      resetCareHouseholdRendererAuthStorage();
    }
  },
);

test(
  "identity change cancels A reconciliation without rendering A or blocking fresh B",
  { timeout: 10_000 },
  async () => {
    resetCareHouseholdRendererAuthStorage();
    const entryId = "server-a-pending-during-user-change";
    setCareHouseholdRendererStoredValue(
      CARE_PRIMARY_LOCAL_DATA_KEY,
      retryableCareEntryVault([cachedRetryableCareEntry(entryId)]),
    );
    const stalePatch = deferred<ReturnType<typeof acknowledgedCareEntryRow>>();
    const aMe = freshMeForUser(A, "Phoenix Pack", "user-a");
    const bMe = freshMeForUser(B, "Family Pack", "user-b");
    let meAttempts = 0;
    let patchStarted = false;
    resetCareHouseholdRendererApi({
      getMe: async () => {
        meAttempts += 1;
        return meAttempts === 1 ? aMe : bMe;
      },
      getCareState: async (headers: Record<string, string>) =>
        careEnvelope(headers["X-WoofWatcher-Expected-Household-Id"]),
      listCareEntries: async () => [],
      putCareState: async (
        input: { version: number; doc: unknown },
        headers: Record<string, string>,
      ) => ({
        ...careEnvelope(headers["X-WoofWatcher-Expected-Household-Id"]),
        version: input.version + 1,
        doc: input.doc,
      }),
      updateCareEntry: async () => {
        patchStarted = true;
        return stalePatch.promise;
      },
    });
    careProbe = null;
    const renderLog: string[] = [];
    const mounted = await mountCareEntryBoundary(renderLog);

    try {
      await waitFor(() => patchStarted, "user A's pending PATCH barrier");
      assert.equal(careProbe?.initialSyncStatus.state, "pending");
      assert.deepEqual(renderLog, []);

      await act(async () => {
        setCareHouseholdRendererAuth({
          isLoaded: true,
          isSignedIn: true,
          userId: "user-b",
          sessionId: "session-b",
        });
      });
      await waitFor(
        () =>
          meAttempts === 2 &&
          careProbe?.identityScopeKey?.includes(B) &&
          careProbe.initialSyncStatus.state === "settled" &&
          Boolean(find(mounted.container, "care-entry-probe-empty")),
        "fresh B admission while A's obsolete transport drains",
      );
      const bPermit = careProbe!.captureCareHouseholdOperationPermit();
      assert.equal(bPermit?.householdId, B);
      assert.equal(renderLog.includes(entryId), false);

      await act(async () => {
        stalePatch.reject(
          Object.assign(new Error("stale A row is gone"), { status: 404 }),
        );
        await Promise.resolve();
      });
      await act(async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      });

      assert.equal(careProbe?.identityScopeKey?.includes(B), true);
      assert.equal(careProbe?.initialSyncStatus.state, "settled");
      assert.equal(
        careProbe?.isCareHouseholdOperationPermitCurrent(bPermit!),
        true,
      );
      assert.ok(find(mounted.container, "care-entry-probe-empty"));
      assert.equal(renderLog.includes(entryId), false);
    } finally {
      stalePatch.resolve(acknowledgedCareEntryRow(entryId));
      await mounted.dispose();
      resetCareHouseholdRendererAuthStorage();
    }
  },
);

test(
  "off-page cancelled CREATE awaits exact client-key deletion before releasing its durable ledger",
  { timeout: 10_000 },
  async () => {
    resetCareHouseholdRendererAuthStorage();
    const tempId = "temp_cancelled_outside_capped_page";
    const dataScope = `care-v2:${JSON.stringify(["user-a", A])}`;
    setCareHouseholdRendererStoredValue(
      CARE_PRIMARY_LOCAL_DATA_KEY,
      retryableCareEntryVault([
        cachedRetryableCareEntry(tempId, { create: true }),
      ]),
    );
    setCareHouseholdRendererStoredValue(
      CARE_PRESERVED_LOCAL_DATA_KEY,
      replaceCareCleanupLedgerScope(null, dataScope, [tempId]),
    );
    const cappedRows = Array.from({ length: 250 }, (_, index) =>
      sharedRendererCareRow(`server-capped-${index}`),
    );
    const exactDelete = deferred<void>();
    let exactDeleteStarted = false;
    resetCareHouseholdRendererApi({
      getMe: async () => freshMe(A, "Phoenix Pack"),
      getCareState: async () => careEnvelope(A),
      listCareEntries: async () => cappedRows,
      putCareState: async (input: { version: number; doc: unknown }) => ({
        ...careEnvelope(A),
        version: input.version + 1,
        doc: input.doc,
      }),
      deleteCareEntryByClientKey: async () => {
        exactDeleteStarted = true;
        return exactDelete.promise;
      },
      createCareEntry: async () => {
        throw new Error("a cancelled temp identity must never retry CREATE");
      },
    });
    careProbe = null;
    const renderLog: string[] = [];
    const storedIdsAtRender: string[][] = [];
    const mounted = await mountCareEntryBoundary(renderLog, () => {
      storedIdsAtRender.push(storedUserAEntryIds());
    });

    try {
      await waitFor(
        () => exactDeleteStarted,
        "the authoritative off-page client-key delete",
      );
      assert.equal(careProbe?.initialSyncStatus.state, "pending");
      assert.deepEqual(renderLog, []);
      assert.equal(storedUserAEntryIds().includes(tempId), false);
      assert.ok(
        getCareHouseholdRendererStoredValue(
          CARE_PRESERVED_LOCAL_DATA_KEY,
        )?.includes(tempId),
        "the cleanup ledger must remain pinned while remote deletion waits",
      );

      await act(async () => exactDelete.resolve());
      await waitFor(
        () => careProbe?.initialSyncStatus.state === "settled",
        "the clean capped-page snapshot to persist before ledger release",
      );

      const deleteCall = getCareHouseholdRendererApiCalls().find(
        (call) => call.name === "deleteCareEntryByClientKey",
      );
      assert.deepEqual(deleteCall?.args, [
        tempId,
        { "X-WoofWatcher-Expected-Household-Id": A },
      ]);
      assert.equal(
        getCareHouseholdRendererStoredValue(CARE_PRESERVED_LOCAL_DATA_KEY),
        "[]",
      );
      assert.equal(storedUserAEntryIds().length, 250);
      assert.equal(storedUserAEntryIds().includes(tempId), false);
      assert.ok(renderLog.length > 0);
      assert.ok(renderLog.every((entryIds) => !entryIds.includes(tempId)));
      assert.ok(
        storedIdsAtRender.every((entryIds) => !entryIds.includes(tempId)),
      );
      assert.equal(
        getCareHouseholdRendererApiCalls().some(
          (call) => call.name === "createCareEntry",
        ),
        false,
      );
    } finally {
      exactDelete.resolve();
      await mounted.dispose();
      resetCareHouseholdRendererAuthStorage();
    }
  },
);

test(
  "failed off-page client-key deletion stays suppressed and durably retryable",
  { timeout: 10_000 },
  async () => {
    resetCareHouseholdRendererAuthStorage();
    const tempId = "temp_failed_off_page_delete";
    const dataScope = `care-v2:${JSON.stringify(["user-a", A])}`;
    setCareHouseholdRendererStoredValue(
      CARE_PRIMARY_LOCAL_DATA_KEY,
      retryableCareEntryVault([
        cachedRetryableCareEntry(tempId, { create: true }),
      ]),
    );
    setCareHouseholdRendererStoredValue(
      CARE_PRESERVED_LOCAL_DATA_KEY,
      replaceCareCleanupLedgerScope(null, dataScope, [tempId]),
    );
    let exactDeleteAttempts = 0;
    resetCareHouseholdRendererApi({
      getMe: async () => freshMe(A, "Phoenix Pack"),
      getCareState: async () => careEnvelope(A),
      listCareEntries: async () =>
        Array.from({ length: 250 }, (_, index) =>
          sharedRendererCareRow(`server-failure-page-${index}`),
        ),
      putCareState: async (input: { version: number; doc: unknown }) => ({
        ...careEnvelope(A),
        version: input.version + 1,
        doc: input.doc,
      }),
      deleteCareEntryByClientKey: async () => {
        exactDeleteAttempts += 1;
        throw Object.assign(new Error("provider unavailable"), { status: 503 });
      },
      createCareEntry: async () => {
        throw new Error("a suppressed temp identity must never retry CREATE");
      },
    });
    careProbe = null;
    const renderLog: string[] = [];
    const storedIdsAtRender: string[][] = [];
    const mounted = await mountCareEntryBoundary(renderLog, () => {
      storedIdsAtRender.push(storedUserAEntryIds());
    });

    try {
      await waitFor(
        () => careProbe?.initialSyncStatus.state === "settled",
        "safe local admission after the retryable remote cleanup failure",
      );
      assert.equal(exactDeleteAttempts, 1);
      assert.ok(
        getCareHouseholdRendererStoredValue(
          CARE_PRESERVED_LOCAL_DATA_KEY,
        )?.includes(tempId),
        "a failed exact delete must retain the durable retry obligation",
      );
      assert.equal(storedUserAEntryIds().includes(tempId), false);
      assert.ok(renderLog.length > 0);
      assert.ok(renderLog.every((entryIds) => !entryIds.includes(tempId)));
      assert.ok(
        storedIdsAtRender.every((entryIds) => !entryIds.includes(tempId)),
      );
      assert.equal(
        getCareHouseholdRendererApiCalls().some(
          (call) => call.name === "createCareEntry",
        ),
        false,
      );
    } finally {
      await mounted.dispose();
      resetCareHouseholdRendererAuthStorage();
    }
  },
);

test(
  "signed-in local hydration failure preserves intact bytes and retries before fresh server omission mounts",
  { timeout: 10_000 },
  async () => {
    resetCareHouseholdRendererAuthStorage();
    const intactCache = await seedFormerlySharedUserBCache();
    const readsBeforeFailure = getCareHouseholdRendererPrimaryReadAttempts();
    setCareHouseholdRendererPrimaryReadFailures(2);
    const freshDoc = deferred<ReturnType<typeof careEnvelope>>();
    let serverRefreshAttempts = 0;
    resetCareHouseholdRendererApi({
      getMe: async () => freshMeForUser(A, "Phoenix Pack", "user-b"),
      getCareState: async () => {
        serverRefreshAttempts += 1;
        return freshDoc.promise;
      },
      listCareEntries: async () => [],
      putCareState: async (input: { version: number; doc: unknown }) => ({
        ...careEnvelope(A),
        version: input.version + 1,
        doc: input.doc,
      }),
    });
    careProbe = null;
    const renderLog: string[] = [];
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container as never);

    try {
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <CareEntryBoundaryHarness renderLog={renderLog} />
          </QueryClientProvider>,
        );
      });
      await waitFor(
        () => careProbe?.storageWarning === "read-failed",
        "both bounded local hydration reads to fail",
      );
      assert.equal(
        getCareHouseholdRendererPrimaryReadAttempts(),
        readsBeforeFailure + 2,
      );
      assert.equal(serverRefreshAttempts, 0);
      assert.deepEqual(renderLog, []);
      assert.ok(
        find(
          container,
          "Local care data needs attention. WoofWatcher could not safely read the local Care cache. Retry before continuing.",
        ),
      );
      assert.ok(find(container, "Retry loading local care data"));
      assert.equal(
        getCareHouseholdRendererStoredValue(CARE_PRIMARY_LOCAL_DATA_KEY),
        intactCache,
        "failed reads must not overwrite or normalize the intact cache",
      );

      const retry = find(container, "Retry loading local care data");
      assert.ok(retry);
      await act(async () => retry.click());
      await waitFor(
        () =>
          getCareHouseholdRendererPrimaryReadAttempts() ===
            readsBeforeFailure + 3 && serverRefreshAttempts === 1,
        "successful hydration followed by the deferred fresh server sync",
      );
      assert.equal(careProbe?.initialSyncStatus.state, "pending");
      assert.deepEqual(renderLog, []);
      assert.equal(
        getCareHouseholdRendererStoredValue(CARE_PRIMARY_LOCAL_DATA_KEY),
        intactCache,
        "hydration retry must preserve stored bytes while authority is pending",
      );

      await act(async () => freshDoc.resolve(careEnvelope(A)));
      await waitFor(
        () => find(container, "care-entry-probe-empty"),
        "fresh authoritative omission before first personal mount",
      );
      assert.deepEqual(renderLog, ["empty"]);
    } finally {
      freshDoc.resolve(careEnvelope(A));
      await act(async () => root.unmount());
      queryClient.clear();
      container.parentNode?.removeChild(container);
      resetCareHouseholdRendererAuthStorage();
    }
  },
);

test(
  "local mode keeps children hidden through failed hydration and admits only the successful retry",
  { timeout: 10_000 },
  async () => {
    resetCareHouseholdRendererAuthStorage();
    setCareHouseholdRendererAuth({
      isLoaded: true,
      isSignedIn: false,
      userId: null,
      sessionId: null,
    });
    setCareHouseholdRendererPrimaryReadFailures(2);
    resetCareHouseholdRendererApi();
    careProbe = null;
    const renderLog: string[] = [];
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container as never);

    try {
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <CareEntryBoundaryHarness renderLog={renderLog} />
          </QueryClientProvider>,
        );
      });
      await waitFor(
        () => careProbe?.storageWarning === "read-failed",
        "local mode's bounded hydration failure",
      );
      assert.equal(getCareHouseholdRendererPrimaryReadAttempts(), 2);
      assert.deepEqual(renderLog, []);
      assert.ok(find(container, "Retry loading local care data"));
      assert.deepEqual(getCareHouseholdRendererApiCalls(), []);

      const retry = find(container, "Retry loading local care data");
      assert.ok(retry);
      await act(async () => retry.click());
      await waitFor(
        () => find(container, "care-entry-probe-empty"),
        "successful local hydration retry",
      );
      assert.equal(getCareHouseholdRendererPrimaryReadAttempts(), 3);
      assert.deepEqual(renderLog, ["empty"]);
      assert.deepEqual(getCareHouseholdRendererApiCalls(), []);
    } finally {
      await act(async () => root.unmount());
      queryClient.clear();
      container.parentNode?.removeChild(container);
      resetCareHouseholdRendererAuthStorage();
    }
  },
);

test(
  "real signed-in and local hydration show a nonretryable update-required shield for future Care data",
  { timeout: 10_000 },
  async () => {
    const scenarios = [
      {
        label: "signed-in",
        dataScope: `care-v2:${JSON.stringify(["user-b", A])}`,
        storedValue: futureSchemaVault(
          `care-v2:${JSON.stringify(["user-b", A])}`,
        ),
        auth: {
          isLoaded: true,
          isSignedIn: true,
          userId: "user-b",
          sessionId: "session-b",
        },
      },
      {
        label: "signed-in duplicate-key",
        dataScope: `care-v2:${JSON.stringify(["user-b", A])}`,
        storedValue: duplicateSchemaVault(
          `care-v2:${JSON.stringify(["user-b", A])}`,
        ),
        auth: {
          isLoaded: true,
          isSignedIn: true,
          userId: "user-b",
          sessionId: "session-b",
        },
      },
      {
        label: "local",
        dataScope: "local",
        storedValue: futureSchemaVault("local"),
        auth: {
          isLoaded: true,
          isSignedIn: false,
          userId: null,
          sessionId: null,
        },
      },
      {
        label: "legacy local",
        dataScope: "local",
        storedValue: FUTURE_SCHEMA_SNAPSHOT_RAW,
        auth: {
          isLoaded: true,
          isSignedIn: false,
          userId: null,
          sessionId: null,
        },
      },
    ] as const;

    for (const scenario of scenarios) {
      resetCareHouseholdRendererAuthStorage();
      setCareHouseholdRendererAuth(scenario.auth);
      setCareHouseholdRendererStoredValue(
        CARE_PRIMARY_LOCAL_DATA_KEY,
        scenario.storedValue,
      );
      resetCareHouseholdRendererApi({
        getMe: async () => freshMeForUser(A, "Phoenix Pack", "user-b"),
        getCareState: async () => {
          throw new Error(
            `${scenario.label} future data must block authoritative refresh.`,
          );
        },
        listCareEntries: async () => {
          throw new Error(
            `${scenario.label} future data must block entry refresh.`,
          );
        },
      });
      careProbe = null;
      const renderLog: string[] = [];
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity } },
      });
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container as never);

      try {
        await act(async () => {
          root.render(
            <QueryClientProvider client={queryClient}>
              <CareEntryBoundaryHarness renderLog={renderLog} />
            </QueryClientProvider>,
          );
        });
        await waitFor(
          () => careProbe?.storageWarning === "newer-version",
          `${scenario.label} future-schema protection`,
        );
        assert.equal(careProbe?.isLoaded, true);
        assert.equal(careProbe?.careMutationsBlocked, true);
        assert.deepEqual(renderLog, []);
        assert.equal(find(container, "care-entry-probe-empty"), null);
        assert.ok(
          find(
            container,
            `WoofWatcher update required. ${CARE_READ_ONLY_MESSAGE}`,
          ),
        );
        assert.equal(container.textContent.includes("Retry"), false);

        const apiCalls = getCareHouseholdRendererApiCalls();
        assert.equal(
          apiCalls.some(
            (call) =>
              call.name === "getCareState" ||
              call.name === "listCareEntries" ||
              call.name === "putCareState",
          ),
          false,
          `${scenario.label} future data must stay opaque and unwritten`,
        );
        assert.equal(
          getCareHouseholdRendererStoredValue(CARE_PRIMARY_LOCAL_DATA_KEY),
          scenario.storedValue,
          `${scenario.label} future bytes must remain exact`,
        );
      } finally {
        await act(async () => root.unmount());
        queryClient.clear();
        container.parentNode?.removeChild(container);
        resetCareHouseholdRendererAuthStorage();
      }
    }
  },
);

test(
  "real provider persistence and relaunch keep an unselected future identity byte-exact for signed-in and local scopes",
  { timeout: 20_000 },
  async () => {
    const futureDataScope = `care-v2:${JSON.stringify(["user-a", A])}`;
    const scenarios = [
      {
        label: "signed-in B",
        dataScope: `care-v2:${JSON.stringify(["user-b", B])}`,
        marker: "B supported slot persisted",
        auth: {
          isLoaded: true,
          isSignedIn: true,
          userId: "user-b",
          sessionId: "session-b",
        },
      },
      {
        label: "local",
        dataScope: "local",
        marker: "Local supported slot persisted",
        auth: {
          isLoaded: true,
          isSignedIn: false,
          userId: null,
          sessionId: null,
        },
      },
    ] as const;

    for (const scenario of scenarios) {
      resetCareHouseholdRendererAuthStorage();
      setCareHouseholdRendererAuth(scenario.auth);
      setCareHouseholdRendererStoredValue(
        CARE_PRIMARY_LOCAL_DATA_KEY,
        futureAndSupportedVault(futureDataScope, scenario.dataScope),
      );
      resetCareHouseholdRendererApi({
        getMe: async () => freshMeForUser(B, "Family Pack", "user-b"),
        getCareState: async () => careEnvelope(B),
        listCareEntries: async () => [],
        putCareState: async (input: { version: number; doc: unknown }) => ({
          ...careEnvelope(B),
          version: input.version + 1,
          doc: input.doc,
        }),
      });

      for (let launch = 0; launch < 2; launch += 1) {
        careProbe = null;
        const queryClient = new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: Infinity } },
        });
        const container = document.createElement("div");
        document.body.appendChild(container);
        const root = createRoot(container as never);

        try {
          await act(async () => {
            root.render(
              <QueryClientProvider client={queryClient}>
                <CareEntryBoundaryHarness renderLog={[]} />
              </QueryClientProvider>,
            );
          });
          await waitFor(
            () => Boolean(find(container, "care-entry-probe-empty")),
            `${scenario.label} supported identity admission on launch ${launch + 1}`,
          );

          if (launch === 0) {
            await act(async () => {
              const updated = careProbe!.updateCareDoc((doc) => ({
                ...doc,
                profile: { ...doc.profile, name: scenario.marker },
              }));
              assert.equal(updated, true);
            });
            await waitFor(
              () =>
                getCareHouseholdRendererStoredValue(
                  CARE_PRIMARY_LOCAL_DATA_KEY,
                )?.includes(scenario.marker),
              `${scenario.label} identity-slot persistence`,
            );
          }

          const persisted = getCareHouseholdRendererStoredValue(
            CARE_PRIMARY_LOCAL_DATA_KEY,
          );
          assert.ok(persisted);
          assert.ok(
            persisted.includes(
              `${JSON.stringify(futureDataScope)}:${UNSELECTED_FUTURE_SLOT_RAW}`,
            ),
            `${scenario.label} must retain the unselected future slot's exact source fragment on launch ${launch + 1}`,
          );
          assert.equal(
            persisted.includes("9007199254740992"),
            false,
            `${scenario.label} must not persist a rounded rendering on launch ${launch + 1}`,
          );
          if (scenario.label === "signed-in B") {
            assert.match(
              persisted,
              /Private Care entries for another or unknown creator were hidden during signed-in recovery/,
              "the real signed-in recovery rewrite must pass through the byte-preserving vault serializer",
            );
          }
        } finally {
          await act(async () => root.unmount());
          queryClient.clear();
          container.parentNode?.removeChild(container);
        }
      }

      if (scenario.label === "local") {
        assert.deepEqual(
          getCareHouseholdRendererApiCalls(),
          [],
          "local relaunch must not contact signed-in Care APIs",
        );
      }
      resetCareHouseholdRendererAuthStorage();
    }
  },
);

test(
  "a failed previous identity hydration warning is hidden before the replacement identity resolves",
  { timeout: 10_000 },
  async () => {
    resetCareHouseholdRendererAuthStorage();
    setCareHouseholdRendererPrimaryReadFailures(2);
    const userBMe = deferred<ReturnType<typeof freshMeForUser>>();
    let meAttempts = 0;
    resetCareHouseholdRendererApi({
      getMe: async () => {
        meAttempts += 1;
        return meAttempts === 1
          ? freshMeForUser(A, "Phoenix Pack", "user-a")
          : userBMe.promise;
      },
      getCareState: async () => careEnvelope(B),
      listCareEntries: async () => [],
      putCareState: async (input: { version: number; doc: unknown }) => ({
        ...careEnvelope(B),
        version: input.version + 1,
        doc: input.doc,
      }),
    });
    careProbe = null;
    const renderLog: string[] = [];
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container as never);

    try {
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <CareEntryBoundaryHarness renderLog={renderLog} />
          </QueryClientProvider>,
        );
      });
      await waitFor(
        () => careProbe?.storageWarning === "read-failed",
        "user A's current-generation hydration failure",
      );
      assert.ok(find(container, "Retry loading local care data"));

      await act(async () => {
        setCareHouseholdRendererAuth({
          isLoaded: true,
          isSignedIn: true,
          userId: "user-b",
          sessionId: "session-b",
        });
      });
      await waitFor(
        () => meAttempts === 2,
        "user B's deferred exact household resolution",
      );
      assert.equal(
        careProbe?.storageWarning,
        null,
        "user A's read failure must not be exposed for user B",
      );
      assert.equal(find(container, "Retry loading local care data"), null);
      assert.ok(
        find(
          container,
          "Checking your account…. Personal screens will reopen after account requests settle and the private cache is ready.",
        ),
      );
      assert.deepEqual(renderLog, []);

      await act(async () => {
        userBMe.resolve(freshMeForUser(B, "Family Pack", "user-b"));
      });
      await waitFor(
        () => find(container, "care-entry-probe-empty"),
        "user B's successful hydration and authoritative refresh",
      );
      assert.equal(careProbe?.storageWarning, null);
      assert.equal(getCareHouseholdRendererPrimaryReadAttempts(), 3);
      assert.deepEqual(renderLog, ["empty"]);
    } finally {
      userBMe.resolve(freshMeForUser(B, "Family Pack", "user-b"));
      await act(async () => root.unmount());
      queryClient.clear();
      container.parentNode?.removeChild(container);
      resetCareHouseholdRendererAuthStorage();
    }
  },
);

async function assertStaleARefreshFailureIsInertAfterBAdmission(
  label: string,
  createError: () => Error,
): Promise<void> {
  resetCareHouseholdRendererAuthStorage();
  careProbe = null;
  const staleADoc = deferred<ReturnType<typeof careEnvelope>>();
  const unexpectedAuthorityRecovery = deferred<ReturnType<typeof freshMeForUser>>();
  const aMe = freshMeForUser(A, "Phoenix Pack", "user-a");
  const bMe = freshMeForUser(B, "Family Pack", "user-b");
  let meAttempts = 0;
  let aDocAttempts = 0;
  let bDocAttempts = 0;

  resetCareHouseholdRendererApi({
    getMe: async () => {
      meAttempts += 1;
      if (meAttempts === 1) return aMe;
      if (meAttempts === 2) return bMe;
      return unexpectedAuthorityRecovery.promise;
    },
    getCareState: async (headers: Record<string, string>) => {
      const householdId =
        headers["X-WoofWatcher-Expected-Household-Id"];
      if (householdId === A) {
        aDocAttempts += 1;
        if (aDocAttempts === 1) return careEnvelope(A);
        if (aDocAttempts === 2) return staleADoc.promise;
        throw new Error(`Unexpected stale-A Care read ${aDocAttempts}.`);
      }
      assert.equal(householdId, B);
      bDocAttempts += 1;
      return careEnvelope(B);
    },
    listCareEntries: async () => [],
    putCareState: async (
      input: { version: number; doc: unknown },
      headers: Record<string, string>,
    ) => ({
      ...careEnvelope(headers["X-WoofWatcher-Expected-Household-Id"]),
      version: input.version + 1,
      doc: input.doc,
    }),
  });

  const renderLog: string[] = [];
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container as never);

  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CareEntryBoundaryHarness renderLog={renderLog} />
        </QueryClientProvider>,
      );
    });
    await waitFor(
      () =>
        careProbe?.identityScopeKey?.includes(A) &&
        careProbe.initialSyncStatus.state === "settled" &&
        Boolean(find(container, "care-entry-probe-empty")),
      `${label} initial A admission`,
    );

    await act(async () => careProbe!.refresh());
    await waitFor(
      () => aDocAttempts === 2,
      `${label} deferred A Care refresh`,
    );

    await act(async () => {
      setCareHouseholdRendererAuth({
        isLoaded: true,
        isSignedIn: true,
        userId: "user-b",
        sessionId: "session-b",
      });
    });
    await waitFor(
      () =>
        meAttempts === 2 &&
        bDocAttempts === 1 &&
        careProbe?.identityScopeKey?.includes(B) &&
        careProbe.initialSyncStatus.state === "settled" &&
        Boolean(find(container, "care-entry-probe-empty")),
      `${label} full B admission`,
    );
    const admittedBPermit = careProbe!.captureCareHouseholdOperationPermit();
    assert.equal(admittedBPermit?.householdId, B);

    await act(async () => {
      staleADoc.reject(createError());
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    assert.equal(
      meAttempts,
      2,
      `${label} from stale A must not restart B authority resolution`,
    );
    assert.equal(careProbe?.identityScopeKey?.includes(B), true);
    assert.equal(careProbe?.identityScopeStatus.state, "resolved");
    assert.equal(careProbe?.initialSyncStatus.state, "settled");
    assert.equal(careProbe?.storageWarning, null);
    assert.equal(careProbe?.careMutationsBlocked, false);
    assert.equal(
      careProbe?.isCareHouseholdOperationPermitCurrent(admittedBPermit!),
      true,
    );
    assert.ok(find(container, "care-entry-probe-empty"));
  } finally {
    staleADoc.resolve(careEnvelope(A));
    unexpectedAuthorityRecovery.resolve(bMe);
    await act(async () => root.unmount());
    queryClient.clear();
    container.parentNode?.removeChild(container);
    resetCareHouseholdRendererAuthStorage();
  }
}

test(
  "a deferred A 412 rejection cannot revoke fully admitted B",
  { timeout: 10_000 },
  async () => {
    await assertStaleARefreshFailureIsInertAfterBAdmission(
      "stale 412",
      () => Object.assign(new Error("A authority changed"), { status: 412 }),
    );
  },
);

test(
  "a deferred A future-schema conflict cannot block fully admitted B",
  { timeout: 10_000 },
  async () => {
    await assertStaleARefreshFailureIsInertAfterBAdmission(
      "stale future-schema 409",
      () =>
        Object.assign(new Error("A has newer Care data"), {
          status: 409,
          data: {
            ...careEnvelope(A),
            doc: {
              dataVersion: CURRENT_CARE_DOC_DATA_VERSION + 1,
              futureOnlyValue: "stale-A-must-remain-inert",
            },
          },
        }),
    );
  },
);

test(
  "temporary Access Pass re-admission resets initial-sync readiness and rejects the prior foreground callback",
  { timeout: 10_000 },
  async () => {
    resetCareHouseholdRendererAuthStorage();
    resetCareHouseholdRendererAppState();
    careProbe = null;
    const staleForegroundDoc = deferred<ReturnType<typeof careEnvelope>>();
    const freshForegroundDoc = deferred<ReturnType<typeof careEnvelope>>();
    const aMe = temporaryMe(A, "Phoenix Pack");
    let meAttempts = 0;
    let docAttempts = 0;
    resetCareHouseholdRendererApi({
      getMe: async () => {
        meAttempts += 1;
        return aMe;
      },
      getCareState: async () => {
        docAttempts += 1;
        if (docAttempts === 1) return careEnvelope(A);
        if (docAttempts === 2) return staleForegroundDoc.promise;
        if (docAttempts === 3) return freshForegroundDoc.promise;
        throw new Error(`Unexpected Care refresh attempt ${docAttempts}.`);
      },
      listCareEntries: async () => [],
      putCareState: async (input: { version: number; doc: unknown }) => ({
        ...careEnvelope(A),
        version: input.version + 1,
        doc: input.doc,
      }),
    });
    const renderLog: string[] = [];
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container as never);
    const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;

    try {
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <CareEntryBoundaryHarness renderLog={renderLog} />
          </QueryClientProvider>,
        );
      });
      await waitFor(
        () => find(container, "care-entry-probe-empty"),
        "the initially settled temporary Access Pass generation",
      );
      assert.equal(meAttempts, 1);
      assert.equal(docAttempts, 1);

      await act(async () => {
        emitCareHouseholdRendererAppState("background");
      });
      assert.equal(find(container, "care-entry-probe-empty"), null);
      await act(async () => {
        emitCareHouseholdRendererAppState("active");
      });
      await waitFor(
        () => meAttempts >= 2 && docAttempts === 2,
        "the first foreground generation's deferred Care refresh",
      );
      assert.equal(careProbe?.initialSyncStatus.state, "pending");
      assert.equal(find(container, "care-entry-probe-empty"), null);

      globalThis.IS_REACT_ACT_ENVIRONMENT = false;
      emitCareHouseholdRendererAppState("background");
      await waitForOutsideAct(
        () => find(container, "care-entry-probe-empty") === null,
        "the stale foreground generation to be revoked",
      );
      emitCareHouseholdRendererAppState("active");
      await waitForOutsideAct(
        () => meAttempts >= 3 && docAttempts === 3,
        "the replacement foreground generation's deferred Care refresh",
      );
      assert.equal(careProbe?.initialSyncStatus.state, "pending");
      assert.equal(find(container, "care-entry-probe-empty"), null);

      staleForegroundDoc.resolve(careEnvelope(A));
      await waitForOutsideAct(
        () => careProbe?.initialSyncStatus.state === "pending",
        "the stale callback to remain unable to settle replacement readiness",
      );
      assert.equal(
        careProbe?.initialSyncStatus.state,
        "pending",
        "the stale foreground callback cannot settle the replacement generation",
      );
      assert.equal(find(container, "care-entry-probe-empty"), null);

      freshForegroundDoc.resolve(careEnvelope(A));
      await waitForOutsideAct(
        () => find(container, "care-entry-probe-empty"),
        "the replacement generation's own initial sync settlement",
      );
      globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      assert.equal(careProbe?.initialSyncStatus.state, "settled");
    } finally {
      globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      staleForegroundDoc.resolve(careEnvelope(A));
      freshForegroundDoc.resolve(careEnvelope(A));
      await act(async () => root.unmount());
      queryClient.clear();
      container.parentNode?.removeChild(container);
      resetCareHouseholdRendererAppState();
      resetCareHouseholdRendererAuthStorage();
    }
  },
);

test("real CareProvider and Care Team screen render an admitted A/B household list", async () => {
  resetCareHouseholdRendererAuthStorage();
  installHealthyApi();
  careProbe = null;
  resetProbe = null;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container as never);

  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });
    await waitFor(
      () => find(container, "Phoenix Pack, current household, Owner"),
      "the real Care screen to render current household A",
    );
    assert.ok(find(container, "Switch to Family Pack household, Adult"));
    assert.equal(careProbe?.identityScopeStatus.state, "resolved");
    assert.equal(careProbe?.identityScopeKey?.includes(A), true);
    assert.ok(resetProbe);
    assert.ok(
      getCareHouseholdRendererApiCalls().some(
        (call) => call.name === "listMyHouseholdMemberships",
      ),
    );
  } finally {
    await act(async () => root.unmount());
    queryClient.clear();
    container.parentNode?.removeChild(container);
    resetCareHouseholdRendererAuthStorage();
  }
});

test("rendered Care Team switch closes A before transport and admits only fresh B", async () => {
  resetCareHouseholdRendererAuthStorage();
  careProbe = null;
  resetProbe = null;
  filesPrepare = async () => {};
  const aMe = freshMe(A, "Phoenix Pack");
  const bMe = freshMe(B, "Family Pack");
  const cMe = freshMe(C, "Wrong Response Pack");
  const recovery = deferred<ReturnType<typeof freshMe>>();
  let currentMe = aMe;
  let activationSettled = false;
  let recoveryStarted = false;
  let transportSnapshot:
    | {
        target: unknown;
        expected: unknown;
        aStillRendered: boolean;
        liveObserverCount: number;
        permitStillCurrent: boolean;
      }
    | undefined;

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container as never);

  resetCareHouseholdRendererApi({
    getMe: async () => {
      if (!activationSettled) return currentMe;
      recoveryStarted = true;
      return recovery.promise;
    },
    getCareState: async () => careEnvelope(currentMe.household.id),
    listCareEntries: async () => [],
    putCareState: async (input: { version: number; doc: unknown }) => ({
      ...careEnvelope(currentMe.household.id),
      version: input.version + 1,
      doc: input.doc,
    }),
    listMyHouseholdMemberships: async () => memberships(currentMe.household.id),
    activateHousehold: async (body: unknown, headers: any) => {
      transportSnapshot = {
        target: body,
        expected: headers?.["X-WoofWatcher-Expected-Household-Id"],
        aStillRendered: Boolean(
          find(container, "Phoenix Pack, current household, Owner"),
        ),
        liveObserverCount: queryClient
          .getQueryCache()
          .getAll()
          .reduce((count, query) => count + query.getObserversCount(), 0),
        permitStillCurrent: Boolean(
          careProbe?.captureCareHouseholdOperationPermit(),
        ),
      };
      activationSettled = true;
      return cMe;
    },
    updateMe: async () => currentMe,
  });

  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });
    await waitFor(
      () => find(container, "Switch to Family Pack household, Adult"),
      "the rendered B switch control",
    );

    const switchToB = find(container, "Switch to Family Pack household, Adult");
    assert.ok(switchToB);
    await act(async () => {
      switchToB.click();
      switchToB.click();
    });
    await waitFor(
      () => recoveryStarted,
      "fresh post-activation /api/me recovery",
    );

    assert.deepEqual(transportSnapshot, {
      target: { householdId: B },
      expected: A,
      aStillRendered: false,
      liveObserverCount: 0,
      permitStillCurrent: false,
    });
    assert.equal(
      getCareHouseholdRendererApiCalls().filter(
        (call) => call.name === "activateHousehold",
      ).length,
      1,
      "double pressing the rendered switch cannot dispatch overlapping activations",
    );
    assert.equal(
      find(container, "Phoenix Pack, current household, Owner"),
      null,
    );
    assert.equal(container.textContent.includes("Wrong Response Pack"), false);

    currentMe = bMe;
    await act(async () => {
      recovery.resolve(bMe);
    });
    await waitFor(
      () => find(container, "Family Pack, current household, Adult"),
      "fresh B /api/me authority to remount the screen",
    );
    assert.ok(find(container, "Switch to Phoenix Pack household, Owner"));
    assert.equal(container.textContent.includes("Wrong Response Pack"), false);
    assert.equal(careProbe?.identityScopeKey?.includes(B), true);

    const membershipCalls = getCareHouseholdRendererApiCalls().filter(
      (call) => call.name === "listMyHouseholdMemberships",
    );
    assert.equal(
      membershipCalls.at(-1)?.args[0]?.["X-WoofWatcher-Expected-Household-Id"],
      B,
      "the remounted list also uses fresh B authority",
    );
  } finally {
    recovery.resolve(bMe);
    await act(async () => root.unmount());
    queryClient.clear();
    container.parentNode?.removeChild(container);
    resetCareHouseholdRendererAuthStorage();
  }
});

test("rendered Care Team restores fresh A with an enabled retry after 412 and network failures", async () => {
  const scenarios = [
    {
      label: "412",
      error: Object.assign(new Error("source changed"), { status: 412 }),
      notice: "Household changed",
    },
    {
      label: "network",
      error: new TypeError("offline"),
      notice: "Household status rechecked",
    },
  ];

  for (const scenario of scenarios) {
    resetCareHouseholdRendererAuthStorage();
    careProbe = null;
    resetProbe = null;
    filesPrepare = async () => {};
    const aMe = freshMe(A, "Phoenix Pack");
    let activationFailed = false;
    let recoveryReads = 0;
    const notices: string[] = [];
    const previousAlert = (globalThis as any).alert;
    (globalThis as any).alert = (message: string) => notices.push(message);

    resetCareHouseholdRendererApi({
      getMe: async () => {
        if (activationFailed) recoveryReads += 1;
        return aMe;
      },
      getCareState: async () => careEnvelope(A),
      listCareEntries: async () => [],
      putCareState: async (input: { version: number; doc: unknown }) => ({
        ...careEnvelope(A),
        version: input.version + 1,
        doc: input.doc,
      }),
      listMyHouseholdMemberships: async () => memberships(A),
      activateHousehold: async () => {
        activationFailed = true;
        throw scenario.error;
      },
      updateMe: async () => aMe,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container as never);

    try {
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <Harness />
          </QueryClientProvider>,
        );
      });
      await waitFor(
        () => find(container, "Switch to Family Pack household, Adult"),
        `${scenario.label} initial B switch control`,
      );
      const switchToB = find(
        container,
        "Switch to Family Pack household, Adult",
      );
      assert.ok(switchToB);
      await act(async () => switchToB.click());

      await waitFor(
        () =>
          recoveryReads > 0 &&
          Boolean(find(container, "Phoenix Pack, current household, Owner")),
        `${scenario.label} fresh A recovery`,
      );
      const retrySwitch = find(
        container,
        "Switch to Family Pack household, Adult",
      );
      assert.ok(
        retrySwitch,
        `${scenario.label} must restore the B retry action`,
      );
      assert.equal(retrySwitch.getAttribute("aria-disabled"), null);
      assert.equal(
        find(container, "Family Pack, current household, Adult"),
        null,
      );
      assert.equal(careProbe?.identityScopeKey?.includes(A), true);
      assert.ok(
        notices.some((notice) => notice.includes(scenario.notice)),
        `${scenario.label} must surface truthful settlement copy`,
      );
    } finally {
      await act(async () => root.unmount());
      queryClient.clear();
      container.parentNode?.removeChild(container);
      (globalThis as any).alert = previousAlert;
      resetCareHouseholdRendererAuthStorage();
    }
  }
});

test("rendered household-list Retry refetches with exact A authority and replaces the failure", async () => {
  resetCareHouseholdRendererAuthStorage();
  careProbe = null;
  resetProbe = null;
  filesPrepare = async () => {};
  const aMe = freshMe(A, "Phoenix Pack");
  let membershipAttempts = 0;
  resetCareHouseholdRendererApi({
    getMe: async () => aMe,
    getCareState: async () => careEnvelope(A),
    listCareEntries: async () => [],
    putCareState: async (input: { version: number; doc: unknown }) => ({
      ...careEnvelope(A),
      version: input.version + 1,
      doc: input.doc,
    }),
    listMyHouseholdMemberships: async () => {
      membershipAttempts += 1;
      if (membershipAttempts === 1) throw new TypeError("offline");
      return memberships(A);
    },
    activateHousehold: async () => aMe,
    updateMe: async () => aMe,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container as never);

  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });
    await waitFor(
      () => find(container, "Retry household list"),
      "the rendered household-list failure action",
    );
    assert.ok(
      find(
        container,
        "Households unavailable. WoofWatcher could not confirm your retained households. Check your connection and retry; no household was changed.",
      ),
    );
    const retry = find(container, "Retry household list");
    assert.ok(retry);
    assert.equal(retry.getAttribute("aria-disabled"), null);
    await act(async () => retry.click());
    await waitFor(
      () => find(container, "Switch to Family Pack household, Adult"),
      "successful A-authorized membership refetch",
    );
    assert.equal(find(container, "Retry household list"), null);
    assert.equal(membershipAttempts, 2);
    const membershipCalls = getCareHouseholdRendererApiCalls().filter(
      (call) => call.name === "listMyHouseholdMemberships",
    );
    assert.equal(membershipCalls.length, 2);
    assert.ok(
      membershipCalls.every(
        (call) =>
          (call.args[0] as any)?.["X-WoofWatcher-Expected-Household-Id"] === A,
      ),
    );
  } finally {
    await act(async () => root.unmount());
    queryClient.clear();
    container.parentNode?.removeChild(container);
    resetCareHouseholdRendererAuthStorage();
  }
});

test("absent or provider-filtered expired A revokes permits, cached UI, and live walk before recovery", async () => {
  const scenarios = [
    {
      label: "absent A",
      initialMe: freshMe(A, "Phoenix Pack"),
      response: {
        activeHouseholdId: A,
        memberships: memberships(A).memberships.filter(
          (membership) => membership.householdId === B,
        ),
      },
    },
    {
      label: "provider-filtered expired A",
      initialMe: temporaryMe(A, "Phoenix Pack"),
      response: {
        activeHouseholdId: A,
        memberships: [],
      },
    },
  ];

  for (const scenario of scenarios) {
    resetCareHouseholdRendererAuthStorage();
    careProbe = null;
    resetProbe = null;
    filesPrepare = async () => {};
    const aMe = scenario.initialMe;
    const membershipResult = deferred<any>();
    const recoveryResult = deferred<ReturnType<typeof freshMe>>();
    let contradictionDelivered = false;
    let membershipRequested = false;
    let recoveryStarted = false;
    let watchStarts = 0;
    let watchStops = 0;
    const priorNavigator = Object.getOwnPropertyDescriptor(
      globalThis,
      "navigator",
    );
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        geolocation: {
          watchPosition() {
            watchStarts += 1;
            return 91;
          },
          clearWatch(id: number) {
            assert.equal(id, 91);
            watchStops += 1;
          },
        },
      },
    });

    resetCareHouseholdRendererApi({
      getMe: async () => {
        if (!contradictionDelivered) return aMe;
        recoveryStarted = true;
        return recoveryResult.promise;
      },
      getCareState: async () => careEnvelope(A),
      listCareEntries: async () => [
        {
          id: "walk-a",
          householdId: A,
          petId: null,
          type: "walk",
          occurredAt: "2026-08-29T00:00:00.000Z",
          caregiverUserId: "user-a",
          caregiverName: "Apollo",
          mood: null,
          severity: null,
          note: null,
          details: {
            title: "Walk - In progress",
            householdVisible: true,
            walkLifecycle: "in-progress",
            walkStartedAt: "2026-08-29T00:00:00.000Z",
          },
          createdAt: "2026-08-29T00:00:00.000Z",
          updatedAt: "2026-08-29T00:00:00.000Z",
        },
      ],
      putCareState: async (input: { version: number; doc: unknown }) => ({
        ...careEnvelope(A),
        version: input.version + 1,
        doc: input.doc,
      }),
      listMyHouseholdMemberships: async () => {
        membershipRequested = true;
        return membershipResult.promise;
      },
      activateHousehold: async () => aMe,
      updateMe: async () => aMe,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container as never);

    try {
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <Harness />
          </QueryClientProvider>,
        );
      });
      await waitFor(
        () => membershipRequested && watchStarts === 1,
        `${scenario.label} initial A list and walk capture`,
      );
      const initialPermit = careProbe?.captureCareHouseholdOperationPermit();
      assert.equal(initialPermit?.householdId, A);

      contradictionDelivered = true;
      await act(async () => membershipResult.resolve(scenario.response));
      await waitFor(
        () => recoveryStarted,
        `${scenario.label} fresh identity recovery`,
      );

      assert.equal(
        careProbe?.captureCareHouseholdOperationPermit(),
        null,
        `${scenario.label} must synchronously revoke A's permit`,
      );
      assert.equal(
        find(container, "Switch to Family Pack household, Adult"),
        null,
        `${scenario.label} must not flash the retained B row under revoked A`,
      );
      assert.equal(
        find(container, "Phoenix Pack, current household, Owner"),
        null,
      );
      assert.equal(
        queryClient
          .getQueryCache()
          .getAll()
          .reduce((count, query) => count + query.getObserversCount(), 0),
        0,
        `${scenario.label} must remove old-A query observers`,
      );
      assert.equal(
        watchStops,
        1,
        `${scenario.label} must stop A's live route capture before recovery resolves`,
      );
    } finally {
      recoveryResult.resolve(aMe);
      await act(async () => root.unmount());
      queryClient.clear();
      container.parentNode?.removeChild(container);
      if (priorNavigator) {
        Object.defineProperty(globalThis, "navigator", priorNavigator);
      } else {
        delete (globalThis as any).navigator;
      }
      resetCareHouseholdRendererAuthStorage();
    }
  }
});

test("rendered household actions close during export, household work, and reset", async () => {
  resetCareHouseholdRendererAuthStorage();
  careProbe = null;
  resetProbe = null;
  const aMe = freshMe(A, "Phoenix Pack");
  const invitation = deferred<any>();
  let invitationStarted = false;
  resetCareHouseholdRendererApi({
    getMe: async () => aMe,
    getCareState: async () => careEnvelope(A),
    listCareEntries: async () => [],
    putCareState: async (input: { version: number; doc: unknown }) => ({
      ...careEnvelope(A),
      version: input.version + 1,
      doc: input.doc,
    }),
    listMyHouseholdMemberships: async () => memberships(A),
    activateHousehold: async () => aMe,
    createHouseholdInvitation: async () => {
      invitationStarted = true;
      return invitation.promise;
    },
    updateMe: async () => aMe,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container as never);

  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });
    await waitFor(
      () => find(container, "Switch to Family Pack household, Adult"),
      "the healthy household controls",
    );
    assert.ok(resetProbe);

    const exportGate = deferred();
    let exportStarted = false;
    let exportPromise!: Promise<void>;
    await act(async () => {
      exportPromise = resetProbe!.runExport(
        () => ({ householdId: A }),
        async () => {
          exportStarted = true;
          await exportGate.promise;
        },
      );
    });
    await waitFor(
      () =>
        exportStarted &&
        find(container, "Switch to Family Pack household, Adult")?.getAttribute(
          "aria-disabled",
        ) === "true",
      "export to disable the rendered switch action",
    );
    const disabledDuringExport = find(
      container,
      "Switch to Family Pack household, Adult",
    );
    assert.ok(disabledDuringExport);
    await act(async () => disabledDuringExport.click());
    assert.equal(
      getCareHouseholdRendererApiCalls().filter(
        (call) => call.name === "activateHousehold",
      ).length,
      0,
    );
    exportGate.resolve();
    await act(async () => exportPromise);
    await waitFor(
      () =>
        find(container, "Switch to Family Pack household, Adult")?.getAttribute(
          "aria-disabled",
        ) === null,
      "household actions to reopen after export",
    );
    await act(async () => resetProbe!.clearResult());

    const invite = find(
      container,
      "Create and share one-time household invite",
    );
    assert.ok(invite);
    await act(async () => invite.click());
    await waitFor(
      () =>
        invitationStarted &&
        find(container, "Switch to Family Pack household, Adult")?.getAttribute(
          "aria-disabled",
        ) === "true",
      "active household invitation to disable the rendered switch",
    );
    const disabledDuringHouseholdWork = find(
      container,
      "Switch to Family Pack household, Adult",
    );
    assert.ok(disabledDuringHouseholdWork);
    assert.equal(
      find(
        container,
        "Create and share one-time household invite",
      )?.getAttribute("aria-disabled"),
      "true",
    );
    await act(async () => disabledDuringHouseholdWork.click());
    assert.equal(
      getCareHouseholdRendererApiCalls().filter(
        (call) => call.name === "activateHousehold",
      ).length,
      0,
    );
    invitation.reject(new TypeError("offline"));
    await waitFor(
      () =>
        careProbe?.householdOperationSnapshot.activeKind === null &&
        find(container, "Switch to Family Pack household, Adult")?.getAttribute(
          "aria-disabled",
        ) === null,
      "household operation settlement to reopen actions",
    );

    const filesStarted = deferred();
    const releaseFiles = deferred();
    filesPrepare = async () => {
      filesStarted.resolve();
      await releaseFiles.promise;
    };
    let resetPromise!: ReturnType<LocalDataResetContextValue["runReset"]>;
    await act(async () => {
      resetPromise = resetProbe!.runReset();
      await filesStarted.promise;
    });
    assert.ok(find(container, "Deleting all local WoofWatcher data"));
    assert.equal(
      find(container, "Switch to Family Pack household, Adult"),
      null,
      "reset removes the action surface before any owner can commit",
    );
    assert.equal(
      queryClient
        .getQueryCache()
        .getAll()
        .reduce((count, query) => count + query.getObserversCount(), 0),
      0,
      "reset has no live personal query observers while owners prepare",
    );
    releaseFiles.resolve();
    await act(async () => {
      await resetPromise;
    });
  } finally {
    invitation.reject(new Error("test cleanup"));
    filesPrepare = async () => {};
    await act(async () => root.unmount());
    queryClient.clear();
    container.parentNode?.removeChild(container);
    resetCareHouseholdRendererAuthStorage();
  }
});

test("temporary Access Pass background and resume require fresh authority, reject stale A, and stay shielded offline", async () => {
  resetCareHouseholdRendererAuthStorage();
  resetCareHouseholdRendererAppState();
  careProbe = null;
  resetProbe = null;
  filesPrepare = async () => {};
  const aMe = temporaryMe(A, "Phoenix Pack");
  const staleA = deferred<ReturnType<typeof temporaryMe>>();
  let meCalls = 0;
  resetCareHouseholdRendererApi({
    getMe: async () => {
      meCalls += 1;
      if (meCalls === 1) return aMe;
      if (meCalls === 2) return staleA.promise;
      throw new TypeError("offline");
    },
    getCareState: async () => careEnvelope(A),
    listCareEntries: async () => [],
    putCareState: async (input: { version: number; doc: unknown }) => ({
      ...careEnvelope(A),
      version: input.version + 1,
      doc: input.doc,
    }),
    listMyHouseholdMemberships: async () => memberships(A),
    activateHousehold: async () => aMe,
    updateMe: async () => aMe,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container as never);

  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });
    await waitFor(
      () =>
        careProbe?.identityScopeStatus.state === "resolved" &&
        Boolean(careProbe.captureCareHouseholdOperationPermit()),
      "temporary A authority",
    );
    const originalPermit = careProbe!.captureCareHouseholdOperationPermit();
    assert.ok(originalPermit);
    assert.equal(meCalls, 1);

    await act(async () => {
      emitCareHouseholdRendererAppState("background");
    });
    await waitFor(
      () => careProbe?.captureCareHouseholdOperationPermit() === null,
      "temporary A revocation while backgrounded",
    );
    assert.equal(
      meCalls,
      1,
      "backgrounding must not start an authority request",
    );
    assert.equal(
      find(container, "Switch to Family Pack household, Adult"),
      null,
    );

    await act(async () => {
      emitCareHouseholdRendererAppState("active");
    });
    await waitFor(() => meCalls === 2, "first foreground Exact Me refresh");

    await act(async () => {
      emitCareHouseholdRendererAppState("background");
    });
    assert.equal(careProbe?.captureCareHouseholdOperationPermit(), null);
    await act(async () => {
      emitCareHouseholdRendererAppState("active");
    });
    await waitFor(
      () => meCalls >= 3,
      "replacement foreground Exact Me refresh",
    );
    await act(async () => {
      staleA.resolve(aMe);
    });

    await waitFor(
      () => careProbe?.identityScopeStatus.state === "error",
      "offline authority retries to fail closed",
    );
    assert.equal(meCalls, 5);
    assert.equal(careProbe?.captureCareHouseholdOperationPermit(), null);
    assert.equal(
      find(container, "Switch to Family Pack household, Adult"),
      null,
      "neither offline recovery nor stale A may remount personal household UI",
    );
    assert.equal(
      careProbe?.isCareHouseholdOperationPermitCurrent(originalPermit!),
      false,
    );
  } finally {
    staleA.resolve(aMe);
    await act(async () => root.unmount());
    queryClient.clear();
    container.parentNode?.removeChild(container);
    resetCareHouseholdRendererAppState();
    resetCareHouseholdRendererAuthStorage();
  }
});

test("backgrounding an unresolved Exact Me attempt rejects its stale callback before foreground admission", async () => {
  resetCareHouseholdRendererAuthStorage();
  resetCareHouseholdRendererAppState();
  careProbe = null;
  resetProbe = null;
  const staleA = deferred<ReturnType<typeof temporaryMe>>();
  const freshA = temporaryMe(A, "Phoenix Pack");
  let meCalls = 0;
  resetCareHouseholdRendererApi({
    getMe: async () => {
      meCalls += 1;
      return meCalls === 1 ? staleA.promise : freshA;
    },
    getCareState: async () => careEnvelope(A),
    listCareEntries: async () => [],
    putCareState: async (input: { version: number; doc: unknown }) => ({
      ...careEnvelope(A),
      version: input.version + 1,
      doc: input.doc,
    }),
    listMyHouseholdMemberships: async () => memberships(A),
    activateHousehold: async () => freshA,
    updateMe: async () => freshA,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container as never);

  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });
    await waitFor(() => meCalls === 1, "initial unresolved Exact Me request");
    await act(async () => {
      emitCareHouseholdRendererAppState("background");
      staleA.resolve(freshA);
    });
    assert.equal(careProbe?.captureCareHouseholdOperationPermit(), null);
    assert.equal(meCalls, 1);

    await act(async () => {
      emitCareHouseholdRendererAppState("active");
    });
    await waitFor(
      () =>
        meCalls >= 2 &&
        Boolean(careProbe?.captureCareHouseholdOperationPermit()) &&
        Boolean(find(container, "Switch to Family Pack household, Adult")),
      "fresh foreground Exact Me admission",
    );
    assert.ok(find(container, "Switch to Family Pack household, Adult"));
  } finally {
    staleA.resolve(freshA);
    await act(async () => root.unmount());
    queryClient.clear();
    container.parentNode?.removeChild(container);
    resetCareHouseholdRendererAppState();
    resetCareHouseholdRendererAuthStorage();
  }
});

test("permanent owner authority stays mounted across background and resume", async () => {
  resetCareHouseholdRendererAuthStorage();
  resetCareHouseholdRendererAppState();
  installHealthyApi();
  careProbe = null;
  resetProbe = null;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container as never);

  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });
    await waitFor(
      () =>
        Boolean(careProbe?.captureCareHouseholdOperationPermit()) &&
        Boolean(find(container, "Switch to Family Pack household, Adult")),
      "permanent owner authority",
    );
    const permit = careProbe!.captureCareHouseholdOperationPermit();
    assert.ok(permit);
    const before = getCareHouseholdRendererApiCalls().filter(
      (call) => call.name === "getMe",
    ).length;

    await act(async () => {
      emitCareHouseholdRendererAppState("background");
      emitCareHouseholdRendererAppState("active");
    });

    assert.equal(
      careProbe?.isCareHouseholdOperationPermitCurrent(permit),
      true,
    );
    assert.ok(find(container, "Switch to Family Pack household, Adult"));
    assert.equal(
      getCareHouseholdRendererApiCalls().filter((call) => call.name === "getMe")
        .length,
      before,
      "permanent owner resume must not churn Exact Me authority",
    );
  } finally {
    await act(async () => root.unmount());
    queryClient.clear();
    container.parentNode?.removeChild(container);
    resetCareHouseholdRendererAppState();
    resetCareHouseholdRendererAuthStorage();
  }
});
