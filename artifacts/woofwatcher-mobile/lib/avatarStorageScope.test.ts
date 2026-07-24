import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAvatarWriteAllowed,
  commitAvatarMemoryIfCurrent,
  createAvatarWriteCoordinator,
  filterAvatarSetByUriExistence,
  getAvatarStorageKey,
  inspectAvatarStorage,
  inspectLegacyAvatarConfig,
  inspectLegacyAvatarPair,
  inspectLegacyAvatarSet,
  LEGACY_AVATAR_STORAGE_KEYS,
  resolveAvatarLegacyDecision,
  serializeAvatarState,
  type AvatarStoredState,
} from "./avatarStorageScope.ts";
import { createDefaultAvatarConfig } from "./avatarStudio.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function initialState(): AvatarStoredState {
  return {
    avatarSet: null,
    avatarConfig: createDefaultAvatarConfig("Scout"),
  };
}

test("avatar envelope keys are isolated by account and household", () => {
  const a1 = getAvatarStorageKey({
    kind: "account",
    userId: "user-a",
    householdId: "house-1",
  });
  const b1 = getAvatarStorageKey({
    kind: "account",
    userId: "user-b",
    householdId: "house-1",
  });
  const a2 = getAvatarStorageKey({
    kind: "account",
    userId: "user-a",
    householdId: "house-2",
  });

  assert.notEqual(a1, b1);
  assert.notEqual(a1, a2);
  assert.match(a1, /account\.user-a\.house-1\.avatar\.v1$/);
});

test("a scope switch after persistence cannot commit the old avatar to memory", () => {
  const next = initialState();
  let committed: AvatarStoredState | null = null;
  assert.equal(
    commitAvatarMemoryIfCurrent(next, () => false, (state) => {
      committed = state;
    }),
    false,
  );
  assert.equal(committed, null);
});

test("legacy avatar review drops missing custom image URIs before import", async () => {
  const verified = await filterAvatarSetByUriExistence(
    {
      happy: "file:///present.png",
      calm: "file:///missing.png",
    },
    async (uri) => uri.endsWith("present.png"),
  );
  assert.deepEqual(verified, { happy: "file:///present.png" });
});

test("legacy avatar import stays blocked when one stored half is unreadable", () => {
  const pair = inspectLegacyAvatarPair(
    inspectLegacyAvatarSet(
      JSON.stringify({ happy: "file:///legacy-happy.png" }),
    ),
    inspectLegacyAvatarConfig("{broken", "Scout"),
  );

  assert.deepEqual(pair, { status: "invalid", state: null });
});

test("legacy avatar decisions import or keep the exact selected envelope", () => {
  const current = initialState();
  const candidate: AvatarStoredState = {
    avatarSet: { happy: "file:///legacy-happy.png" },
    avatarConfig: {
      ...createDefaultAvatarConfig("Scout"),
      templateId: "retriever",
    },
  };
  assert.equal(
    resolveAvatarLegacyDecision(current, candidate, "import"),
    candidate,
  );
  assert.equal(
    resolveAvatarLegacyDecision(current, candidate, "keep-current"),
    current,
  );
});

test("ordinary avatar writes stay blocked until a legacy decision is made", () => {
  const candidate = initialState();
  assert.throws(() => assertAvatarWriteAllowed(candidate), /Review the older/);
  assert.doesNotThrow(() => assertAvatarWriteAllowed(candidate, true));
  assert.doesNotThrow(() => assertAvatarWriteAllowed(null));
});

test("local preview envelope does not reuse ambiguous legacy keys", () => {
  const local = getAvatarStorageKey({ kind: "local" });
  assert.notEqual(local, LEGACY_AVATAR_STORAGE_KEYS.avatarSet);
  assert.notEqual(local, LEGACY_AVATAR_STORAGE_KEYS.avatarConfig);
});

test("avatar state round-trips as one versioned envelope", () => {
  const state: AvatarStoredState = {
    avatarSet: { happy: "file:///scout-happy.png" },
    avatarConfig: {
      ...createDefaultAvatarConfig("Scout"),
      collarId: "copper-collar",
    },
  };
  assert.deepEqual(
    inspectAvatarStorage(serializeAvatarState(state), "Scout"),
    { status: "valid", state },
  );
});

test("serialized avatar writes preserve image and config changes in either order", async () => {
  const firstGate = deferred<void>();
  const persisted: AvatarStoredState[] = [];
  const coordinator = createAvatarWriteCoordinator(initialState());

  const imageWrite = coordinator.enqueue(
    (current) => ({
      ...current,
      avatarSet: { calm: "file:///scout-calm.png" },
    }),
    async (next) => {
      persisted.push(next);
      await firstGate.promise;
    },
  );
  const configWrite = coordinator.enqueue(
    (current) => ({
      ...current,
      avatarConfig: {
        ...current.avatarConfig,
        collarId: "copper-collar",
      },
    }),
    async (next) => {
      persisted.push(next);
    },
  );

  await Promise.resolve();
  assert.equal(persisted.length, 1);
  firstGate.resolve();
  await Promise.all([imageWrite, configWrite]);
  assert.deepEqual(persisted[1]?.avatarSet, {
    calm: "file:///scout-calm.png",
  });
  assert.equal(persisted[1]?.avatarConfig.collarId, "copper-collar");
});
