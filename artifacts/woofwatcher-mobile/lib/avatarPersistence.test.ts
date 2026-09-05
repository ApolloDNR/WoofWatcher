import test from "node:test";
import assert from "node:assert/strict";

import {
  AVATAR_CONFIG_RECOVERY_KEY as LEGACY_AVATAR_CONFIG_RECOVERY_KEY,
  AVATAR_CONFIG_STORAGE_KEY as LEGACY_AVATAR_CONFIG_STORAGE_KEY,
  AVATAR_LEGACY_LOCAL_CLAIM_KEY,
  AVATAR_SET_RECOVERY_KEY as LEGACY_AVATAR_SET_RECOVERY_KEY,
  AVATAR_SET_STORAGE_KEY as LEGACY_AVATAR_SET_STORAGE_KEY,
  buildAvatarStorageKeys,
  createAvatarPersistence,
  type AvatarKeyValueStorage,
} from "./avatarPersistence.ts";

const LOCAL_SCOPE = {
  ownerUserId: null,
  householdId: null,
  activePetId: "primary",
} as const;
const LOCAL_KEYS = buildAvatarStorageKeys(LOCAL_SCOPE);
const AVATAR_SET_STORAGE_KEY = LOCAL_KEYS.avatarSet;
const AVATAR_CONFIG_STORAGE_KEY = LOCAL_KEYS.avatarConfig;
const AVATAR_SET_RECOVERY_KEY = LOCAL_KEYS.avatarSetRecovery;
const AVATAR_CONFIG_RECOVERY_KEY = LOCAL_KEYS.avatarConfigRecovery;
const ALL_AVATAR_ERASE_KEYS = [
  LEGACY_AVATAR_SET_STORAGE_KEY,
  LEGACY_AVATAR_CONFIG_STORAGE_KEY,
  LEGACY_AVATAR_SET_RECOVERY_KEY,
  LEGACY_AVATAR_CONFIG_RECOVERY_KEY,
  AVATAR_SET_STORAGE_KEY,
  AVATAR_CONFIG_STORAGE_KEY,
  AVATAR_SET_RECOVERY_KEY,
  AVATAR_CONFIG_RECOVERY_KEY,
  AVATAR_LEGACY_LOCAL_CLAIM_KEY,
] as const;
const AVATAR_DATA_ERASE_KEYS = ALL_AVATAR_ERASE_KEYS.slice(0, -1);

test("scope segments cannot collide through delimiter-shaped identity values", () => {
  const first = buildAvatarStorageKeys({
    ownerUserId: "owner.household.shared",
    householdId: "home",
    activePetId: "dog",
  });
  const second = buildAvatarStorageKeys({
    ownerUserId: "owner",
    householdId: "shared.household.home",
    activePetId: "dog",
  });

  assert.notEqual(first.avatarConfig, second.avatarConfig);
  assert.match(first.scopeKey, /owner%2Ehousehold%2Eshared/);
  assert.match(second.scopeKey, /shared%2Ehousehold%2Ehome/);
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

class FakeAvatarStorage implements AvatarKeyValueStorage {
  readonly values = new Map<string, string>();
  getHandler?: (key: string) => Promise<string | null>;
  setHandler?: (key: string, value: string) => Promise<void>;
  removeHandler?: (key: string) => Promise<void>;

  async getItem(key: string): Promise<string | null> {
    if (this.getHandler) return this.getHandler(key);
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.setHandler) return this.setHandler(key, value);
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (this.removeHandler) return this.removeHandler(key);
    this.values.delete(key);
  }
}

function createPersistence(storage: FakeAvatarStorage) {
  return createAvatarPersistence<
    Record<string, unknown>,
    Record<string, unknown>
  >({
    storage,
    scope: LOCAL_SCOPE,
    parseAvatarSet: (decoded) => ({ value: decoded }),
    parseAvatarConfig: (decoded) => ({ value: decoded }),
  });
}

test("a malformed avatar set is quarantined without disturbing valid config", async () => {
  const storage = new FakeAvatarStorage();
  const malformed = "{not-json";
  const validConfig = JSON.stringify({ templateId: "retriever" });
  storage.values.set(AVATAR_SET_STORAGE_KEY, malformed);
  storage.values.set(AVATAR_CONFIG_STORAGE_KEY, validConfig);

  const result = await createPersistence(storage).hydrate();

  assert.equal(result.status, "recovered-corrupt-data");
  if (result.status !== "recovered-corrupt-data") return;
  assert.deepEqual(result.recoveredKeys, ["avatar-set"]);
  assert.equal(result.avatarSet, null);
  assert.deepEqual(result.avatarConfig, { templateId: "retriever" });
  assert.equal(storage.values.get(AVATAR_SET_RECOVERY_KEY), malformed);
  assert.equal(storage.values.has(AVATAR_SET_STORAGE_KEY), false);
  assert.equal(storage.values.get(AVATAR_CONFIG_STORAGE_KEY), validConfig);
});

test("a malformed avatar config is quarantined without disturbing a valid set", async () => {
  const storage = new FakeAvatarStorage();
  const validSet = JSON.stringify({ calm: "file:///kept.png" });
  const malformed = JSON.stringify(["not", "an", "object"]);
  storage.values.set(AVATAR_SET_STORAGE_KEY, validSet);
  storage.values.set(AVATAR_CONFIG_STORAGE_KEY, malformed);

  const result = await createPersistence(storage).hydrate();

  assert.equal(result.status, "recovered-corrupt-data");
  if (result.status !== "recovered-corrupt-data") return;
  assert.deepEqual(result.recoveredKeys, ["avatar-config"]);
  assert.deepEqual(result.avatarSet, { calm: "file:///kept.png" });
  assert.equal(result.avatarConfig, null);
  assert.equal(storage.values.get(AVATAR_CONFIG_RECOVERY_KEY), malformed);
  assert.equal(storage.values.has(AVATAR_CONFIG_STORAGE_KEY), false);
  assert.equal(storage.values.get(AVATAR_SET_STORAGE_KEY), validSet);
});

test("transport failure stays failed, guards writes, and a retry can become ready", async () => {
  const storage = new FakeAvatarStorage();
  storage.values.set(
    AVATAR_SET_STORAGE_KEY,
    JSON.stringify({ happy: "file:///dog.png" }),
  );
  let readsFail = true;
  storage.getHandler = async (key) => {
    if (readsFail) throw new Error("storage offline");
    return storage.values.get(key) ?? null;
  };
  const persistence = createPersistence(storage);

  const failed = await persistence.hydrate();
  assert.equal(failed.status, "read-failed");
  await assert.rejects(
    persistence.saveAvatarConfig(JSON.stringify({ templateId: "shepherd" })),
    /loads successfully/,
  );

  readsFail = false;
  const retried = await persistence.hydrate();
  assert.equal(retried.status, "ready");
  await persistence.saveAvatarConfig(
    JSON.stringify({ templateId: "shepherd" }),
  );
  assert.equal(
    storage.values.get(AVATAR_CONFIG_STORAGE_KEY),
    JSON.stringify({ templateId: "shepherd" }),
  );
});

test("a StrictMode cleanup and replay can reacquire the same persistence lease", async () => {
  const storage = new FakeAvatarStorage();
  const persistence = createPersistence(storage);

  persistence.activate();
  assert.equal((await persistence.hydrate()).status, "ready");
  persistence.deactivate();
  await assert.rejects(
    persistence.saveAvatarConfig(JSON.stringify({ templateId: "stale" })),
    /loads successfully/,
  );

  persistence.activate();
  assert.equal((await persistence.hydrate()).status, "ready");
  await persistence.saveAvatarConfig(
    JSON.stringify({ templateId: "strict-replay" }),
  );
  assert.equal(
    storage.values.get(AVATAR_CONFIG_STORAGE_KEY),
    JSON.stringify({ templateId: "strict-replay" }),
  );
});

test("owner erase invalidates a deferred stale read and leaves no avatar data", async () => {
  const storage = new FakeAvatarStorage();
  storage.values.set(
    AVATAR_SET_STORAGE_KEY,
    JSON.stringify({ calm: "file:///old.png" }),
  );
  storage.values.set(
    AVATAR_CONFIG_STORAGE_KEY,
    JSON.stringify({ templateId: "old" }),
  );
  storage.values.set(AVATAR_SET_RECOVERY_KEY, "old set recovery");
  storage.values.set(AVATAR_CONFIG_RECOVERY_KEY, "old config recovery");
  const readGate = deferred<void>();
  const readsStarted = deferred<void>();
  let readCount = 0;
  storage.getHandler = async (key) => {
    const staleValue = storage.values.get(key) ?? null;
    readCount += 1;
    if (readCount === 2) readsStarted.resolve();
    await readGate.promise;
    return staleValue;
  };
  const persistence = createPersistence(storage);

  const hydration = persistence.hydrate();
  await readsStarted.promise;
  assert.equal(await persistence.eraseAvatarData(), "erased");
  readGate.resolve();

  assert.equal((await hydration).status, "superseded");
  assert.equal(storage.values.has(AVATAR_SET_STORAGE_KEY), false);
  assert.equal(storage.values.has(AVATAR_CONFIG_STORAGE_KEY), false);
  assert.equal(storage.values.has(AVATAR_SET_RECOVERY_KEY), false);
  assert.equal(storage.values.has(AVATAR_CONFIG_RECOVERY_KEY), false);
});

test("owner erase is allowed after failed hydration and establishes a clean writable state", async () => {
  const storage = new FakeAvatarStorage();
  storage.values.set(AVATAR_SET_STORAGE_KEY, "private set");
  storage.values.set(AVATAR_CONFIG_STORAGE_KEY, "private config");
  let readsFail = true;
  storage.getHandler = async (key) => {
    if (readsFail) throw new Error("read failed");
    return storage.values.get(key) ?? null;
  };
  const persistence = createPersistence(storage);

  assert.equal((await persistence.hydrate()).status, "read-failed");
  assert.equal(await persistence.eraseAvatarData(), "erased");
  readsFail = false;
  await persistence.saveAvatarSet(JSON.stringify({ happy: "file:///new.png" }));

  assert.equal(
    storage.values.get(AVATAR_SET_STORAGE_KEY),
    JSON.stringify({ happy: "file:///new.png" }),
  );
  assert.equal(storage.values.has(AVATAR_CONFIG_STORAGE_KEY), false);
});

test("owner erase supersedes queued saves and runs after an active save", async () => {
  const storage = new FakeAvatarStorage();
  const persistence = createPersistence(storage);
  assert.equal((await persistence.hydrate()).status, "ready");

  const activeWriteGate = deferred<void>();
  const activeWriteStarted = deferred<void>();
  storage.setHandler = async (key, value) => {
    if (key === AVATAR_SET_STORAGE_KEY && value.includes("old-active")) {
      activeWriteStarted.resolve();
      await activeWriteGate.promise;
    }
    storage.values.set(key, value);
  };

  const active = persistence.saveAvatarSet(
    JSON.stringify({ happy: "file:///old-active.png" }),
  );
  const activeWasSuperseded = assert.rejects(active, /scope change/);
  await activeWriteStarted.promise;
  const queued = persistence.saveAvatarConfig(
    JSON.stringify({ templateId: "old-queued" }),
  );
  const queuedWasSuperseded = assert.rejects(queued, /superseded/);
  const erase = persistence.eraseAvatarData();
  activeWriteGate.resolve();

  await activeWasSuperseded;
  await queuedWasSuperseded;
  assert.equal(await erase, "erased");
  assert.equal(storage.values.has(AVATAR_SET_STORAGE_KEY), false);
  assert.equal(storage.values.has(AVATAR_CONFIG_STORAGE_KEY), false);
});

test("successful hydration can durably apply a verified avatar-set migration", async () => {
  const storage = new FakeAvatarStorage();
  storage.values.set(
    AVATAR_SET_STORAGE_KEY,
    JSON.stringify({ calm: "file:///kept.png", happy: "file:///missing.png" }),
  );
  const persistence = createAvatarPersistence<
    Record<string, unknown>,
    Record<string, unknown>
  >({
    storage,
    scope: LOCAL_SCOPE,
    parseAvatarSet: () => {
      const verified = { calm: "file:///kept.png" };
      return { value: verified, rewrite: JSON.stringify(verified) };
    },
    parseAvatarConfig: (decoded) => ({ value: decoded }),
  });

  const result = await persistence.hydrate();

  assert.equal(result.status, "ready");
  assert.deepEqual(result.status === "ready" ? result.avatarSet : null, {
    calm: "file:///kept.png",
  });
  assert.equal(
    storage.values.get(AVATAR_SET_STORAGE_KEY),
    JSON.stringify({ calm: "file:///kept.png" }),
  );
});

test("an async verification failure is not misclassified or quarantined as corrupt data", async () => {
  const storage = new FakeAvatarStorage();
  const validSet = JSON.stringify({ calm: "file:///kept.png" });
  storage.values.set(AVATAR_SET_STORAGE_KEY, validSet);
  const persistence = createAvatarPersistence<
    Record<string, unknown>,
    Record<string, unknown>
  >({
    storage,
    scope: LOCAL_SCOPE,
    parseAvatarSet: async () => {
      throw new Error("filesystem verification unavailable");
    },
    parseAvatarConfig: (decoded) => ({ value: decoded }),
  });

  const result = await persistence.hydrate();

  assert.equal(result.status, "processing-failed");
  assert.equal(storage.values.get(AVATAR_SET_STORAGE_KEY), validSet);
  assert.equal(storage.values.has(AVATAR_SET_RECOVERY_KEY), false);
});

test("a recovery write failure preserves the malformed primary and keeps writes guarded", async () => {
  const storage = new FakeAvatarStorage();
  const malformed = "{broken";
  const validConfig = JSON.stringify({ templateId: "shepherd" });
  storage.values.set(AVATAR_SET_STORAGE_KEY, malformed);
  storage.values.set(AVATAR_CONFIG_STORAGE_KEY, validConfig);
  storage.setHandler = async (key, value) => {
    if (key === AVATAR_SET_RECOVERY_KEY) throw new Error("disk full");
    storage.values.set(key, value);
  };
  const persistence = createPersistence(storage);

  const result = await persistence.hydrate();

  assert.equal(result.status, "recovery-failed");
  assert.equal(storage.values.get(AVATAR_SET_STORAGE_KEY), malformed);
  assert.equal(storage.values.get(AVATAR_CONFIG_STORAGE_KEY), validConfig);
  await assert.rejects(
    persistence.saveAvatarSet(JSON.stringify({ calm: "file:///new.png" })),
    /loads successfully/,
  );
});

test("erase attempts every avatar data key after one removal fails and stays guarded until retry", async () => {
  const storage = new FakeAvatarStorage();
  const persistence = createPersistence(storage);
  assert.equal((await persistence.hydrate()).status, "ready");
  for (const key of ALL_AVATAR_ERASE_KEYS) {
    storage.values.set(key, `private:${key}`);
  }
  const attempted: string[] = [];
  storage.removeHandler = async (key) => {
    attempted.push(key);
    if (key === AVATAR_SET_STORAGE_KEY) throw new Error("locked");
    storage.values.delete(key);
  };

  await assert.rejects(persistence.eraseAvatarData(), /locked/);
  assert.deepEqual(attempted, AVATAR_DATA_ERASE_KEYS);
  assert.equal(
    storage.values.get(AVATAR_LEGACY_LOCAL_CLAIM_KEY),
    `complete:${LOCAL_KEYS.scopeKey}`,
    "a failed erase keeps legacy payloads non-claimable until retry",
  );
  await assert.rejects(
    persistence.saveAvatarConfig(JSON.stringify({ templateId: "blocked" })),
    /loads successfully/,
  );

  storage.removeHandler = undefined;
  assert.equal(await persistence.eraseAvatarData(), "erased");
  assert.equal(storage.values.has(AVATAR_SET_STORAGE_KEY), false);
});

test("erase during deferred async verification suppresses its migration write", async () => {
  const storage = new FakeAvatarStorage();
  storage.values.set(
    AVATAR_SET_STORAGE_KEY,
    JSON.stringify({ calm: "file:///old.png", happy: "file:///missing.png" }),
  );
  const verificationGate = deferred<void>();
  const verificationStarted = deferred<void>();
  const persistence = createAvatarPersistence<
    Record<string, unknown>,
    Record<string, unknown>
  >({
    storage,
    scope: LOCAL_SCOPE,
    parseAvatarSet: async () => {
      verificationStarted.resolve();
      await verificationGate.promise;
      const verified = { calm: "file:///old.png" };
      return { value: verified, rewrite: JSON.stringify(verified) };
    },
    parseAvatarConfig: (decoded) => ({ value: decoded }),
  });

  const hydration = persistence.hydrate();
  await verificationStarted.promise;
  assert.equal(await persistence.eraseAvatarData(), "erased");
  verificationGate.resolve();

  assert.equal((await hydration).status, "superseded");
  assert.equal(storage.values.has(AVATAR_SET_STORAGE_KEY), false);
});

test("concurrent owner erases coalesce into one durable full-key wipe", async () => {
  const storage = new FakeAvatarStorage();
  const persistence = createPersistence(storage);
  assert.equal((await persistence.hydrate()).status, "ready");
  const firstRemovalGate = deferred<void>();
  const firstRemovalStarted = deferred<void>();
  const attempted: string[] = [];
  storage.removeHandler = async (key) => {
    attempted.push(key);
    if (attempted.length === 1) {
      firstRemovalStarted.resolve();
      await firstRemovalGate.promise;
    }
    storage.values.delete(key);
  };

  const first = persistence.eraseAvatarData();
  await firstRemovalStarted.promise;
  const duplicate = persistence.eraseAvatarData();
  assert.equal(duplicate, first);
  firstRemovalGate.resolve();

  assert.deepEqual(await Promise.all([first, duplicate]), ["erased", "erased"]);
  assert.deepEqual(attempted, ALL_AVATAR_ERASE_KEYS);
});

test("verified households under one principal never hydrate each other's avatar", async () => {
  const storage = new FakeAvatarStorage();
  const createForHousehold = (householdId: string) =>
    createAvatarPersistence<Record<string, unknown>, Record<string, unknown>>({
      storage,
      scope: {
        ownerUserId: "user-1",
        householdId,
        activePetId: "primary",
      },
      parseAvatarSet: (decoded) => ({ value: decoded }),
      parseAvatarConfig: (decoded) => ({ value: decoded }),
    });
  const householdA = createForHousehold("house-a");

  assert.equal((await householdA.hydrate()).status, "ready");
  await householdA.saveAvatarConfig(
    JSON.stringify({ templateId: "house-a-retriever" }),
  );

  const householdBResult = await createForHousehold("house-b").hydrate();
  assert.equal(householdBResult.status, "ready");
  assert.equal(
    householdBResult.status === "ready"
      ? householdBResult.avatarConfig
      : undefined,
    null,
  );
});

test("a second signed-in principal cannot hydrate the first principal's avatar", async () => {
  const storage = new FakeAvatarStorage();
  const createForPrincipal = (ownerUserId: string) =>
    createAvatarPersistence<Record<string, unknown>, Record<string, unknown>>({
      storage,
      scope: {
        ownerUserId,
        householdId: "shared-looking-household",
        activePetId: "primary",
      },
      parseAvatarSet: (decoded) => ({ value: decoded }),
      parseAvatarConfig: (decoded) => ({ value: decoded }),
    });
  const principalA = createForPrincipal("user-a");

  assert.equal((await principalA.hydrate()).status, "ready");
  await principalA.saveAvatarConfig(
    JSON.stringify({ templateId: "private-to-user-a" }),
  );

  const principalBResult = await createForPrincipal("user-b").hydrate();
  assert.equal(principalBResult.status, "ready");
  assert.equal(
    principalBResult.status === "ready"
      ? principalBResult.avatarConfig
      : undefined,
    null,
  );
});

test("two dogs in the same verified household keep separate avatar configs", async () => {
  const storage = new FakeAvatarStorage();
  const createForPet = (activePetId: string) =>
    createAvatarPersistence<Record<string, unknown>, Record<string, unknown>>({
      storage,
      scope: {
        ownerUserId: "user-1",
        householdId: "house-a",
        activePetId,
      },
      parseAvatarSet: (decoded) => ({ value: decoded }),
      parseAvatarConfig: (decoded) => ({ value: decoded }),
    });
  const phoenix = createForPet("phoenix-id");

  assert.equal((await phoenix.hydrate()).status, "ready");
  await phoenix.saveAvatarConfig(
    JSON.stringify({ templateId: "phoenix-shepherd" }),
  );

  const mochiResult = await createForPet("mochi-id").hydrate();
  assert.equal(mochiResult.status, "ready");
  assert.equal(
    mochiResult.status === "ready" ? mochiResult.avatarConfig : undefined,
    null,
  );
});

test("an authenticated scope never claims unowned legacy avatar data", async () => {
  const storage = new FakeAvatarStorage();
  const legacyConfig = JSON.stringify({ templateId: "local-owner" });
  storage.values.set(LEGACY_AVATAR_CONFIG_STORAGE_KEY, legacyConfig);
  const authenticated = createAvatarPersistence<
    Record<string, unknown>,
    Record<string, unknown>
  >({
    storage,
    scope: {
      ownerUserId: "user-1",
      householdId: "house-a",
      activePetId: "primary",
    },
    parseAvatarSet: (decoded) => ({ value: decoded }),
    parseAvatarConfig: (decoded) => ({ value: decoded }),
  });

  const result = await authenticated.hydrate();

  assert.equal(result.status, "ready");
  assert.equal(
    result.status === "ready" ? result.avatarConfig : undefined,
    null,
  );
  assert.equal(
    storage.values.get(LEGACY_AVATAR_CONFIG_STORAGE_KEY),
    legacyConfig,
  );
});

test("local device scope claims and copies legacy avatar data into its owned namespace", async () => {
  const storage = new FakeAvatarStorage();
  const legacyConfig = JSON.stringify({ templateId: "local-owner" });
  const scopedConfigKey =
    "woofwatcher.petAvatarConfig.v2.scope.local.pet.primary";
  storage.values.set(LEGACY_AVATAR_CONFIG_STORAGE_KEY, legacyConfig);
  const local = createAvatarPersistence<
    Record<string, unknown>,
    Record<string, unknown>
  >({
    storage,
    scope: {
      ownerUserId: null,
      householdId: null,
      activePetId: "primary",
    },
    parseAvatarSet: (decoded) => ({ value: decoded }),
    parseAvatarConfig: (decoded) => ({ value: decoded }),
  });

  const result = await local.hydrate();

  assert.equal(result.status, "ready");
  assert.deepEqual(
    result.status === "ready" ? result.avatarConfig : undefined,
    { templateId: "local-owner" },
  );
  assert.equal(storage.values.get(scopedConfigKey), legacyConfig);
  assert.equal(
    storage.values.get(AVATAR_LEGACY_LOCAL_CLAIM_KEY),
    "complete:local.pet.primary",
  );
  assert.equal(
    storage.values.get(LEGACY_AVATAR_CONFIG_STORAGE_KEY),
    legacyConfig,
    "the unowned v1 payload remains as a non-rendered recovery backup",
  );
});

test("a failed legacy migration stays reserved for the original local dog", async () => {
  const storage = new FakeAvatarStorage();
  const legacyConfig = JSON.stringify({ templateId: "reserved-local-dog" });
  storage.values.set(LEGACY_AVATAR_CONFIG_STORAGE_KEY, legacyConfig);
  let failFirstDogAWrite = true;
  storage.setHandler = async (key, value) => {
    if (
      failFirstDogAWrite &&
      key.includes("petAvatarConfig.v2.scope.local.pet.dog-a")
    ) {
      failFirstDogAWrite = false;
      throw new Error("interrupted migration");
    }
    storage.values.set(key, value);
  };
  const createForPet = (activePetId: string) =>
    createAvatarPersistence<Record<string, unknown>, Record<string, unknown>>({
      storage,
      scope: { ownerUserId: null, householdId: null, activePetId },
      parseAvatarSet: (decoded) => ({ value: decoded }),
      parseAvatarConfig: (decoded) => ({ value: decoded }),
    });
  const dogA = createForPet("dog-a");

  assert.equal((await dogA.hydrate()).status, "recovery-failed");
  assert.equal(
    storage.values.get(AVATAR_LEGACY_LOCAL_CLAIM_KEY),
    "pending:local.pet.dog-a",
    "the first durable step must reserve the unowned payload before copying it",
  );

  const dogB = await createForPet("dog-b").hydrate();
  assert.equal(dogB.status, "ready");
  assert.equal(dogB.status === "ready" ? dogB.avatarConfig : undefined, null);

  const dogARetry = await dogA.hydrate();
  assert.equal(dogARetry.status, "ready");
  assert.deepEqual(
    dogARetry.status === "ready" ? dogARetry.avatarConfig : undefined,
    { templateId: "reserved-local-dog" },
  );
  assert.equal(
    storage.values.get(AVATAR_LEGACY_LOCAL_CLAIM_KEY),
    "complete:local.pet.dog-a",
  );
});

test("a failed legacy erase keeps the leftover payload fenced from another dog", async () => {
  const storage = new FakeAvatarStorage();
  const legacyConfig = JSON.stringify({ templateId: "private-dog-a" });
  storage.values.set(LEGACY_AVATAR_CONFIG_STORAGE_KEY, legacyConfig);
  storage.values.set(AVATAR_LEGACY_LOCAL_CLAIM_KEY, "complete:local.pet.dog-a");
  const createForPet = (activePetId: string) =>
    createAvatarPersistence<Record<string, unknown>, Record<string, unknown>>({
      storage,
      scope: { ownerUserId: null, householdId: null, activePetId },
      parseAvatarSet: (decoded) => ({ value: decoded }),
      parseAvatarConfig: (decoded) => ({ value: decoded }),
    });
  const dogA = createForPet("dog-a");
  assert.equal((await dogA.hydrate()).status, "ready");
  storage.removeHandler = async (key) => {
    if (key === LEGACY_AVATAR_CONFIG_STORAGE_KEY) {
      throw new Error("locked legacy config");
    }
    storage.values.delete(key);
  };

  await assert.rejects(dogA.eraseAvatarData(), /locked legacy config/);
  assert.equal(
    storage.values.get(AVATAR_LEGACY_LOCAL_CLAIM_KEY),
    "complete:local.pet.dog-a",
    "the claim tombstone must remain while any legacy payload survives",
  );

  storage.removeHandler = undefined;
  const dogB = await createForPet("dog-b").hydrate();
  assert.equal(dogB.status, "ready");
  assert.equal(dogB.status === "ready" ? dogB.avatarConfig : undefined, null);
});

test("a completed corrupt legacy claim is not recovered and announced again on relaunch", async () => {
  const storage = new FakeAvatarStorage();
  const malformedLegacyConfig = "{not-json";
  storage.values.set(LEGACY_AVATAR_CONFIG_STORAGE_KEY, malformedLegacyConfig);

  const first = await createPersistence(storage).hydrate();
  assert.equal(first.status, "recovered-corrupt-data");
  assert.equal(
    storage.values.get(LOCAL_KEYS.avatarConfigRecovery),
    malformedLegacyConfig,
  );
  assert.equal(
    storage.values.get(AVATAR_LEGACY_LOCAL_CLAIM_KEY),
    `complete:${LOCAL_KEYS.scopeKey}`,
  );

  const relaunched = await createPersistence(storage).hydrate();
  assert.equal(relaunched.status, "ready");
  if (relaunched.status !== "ready") return;
  assert.deepEqual(relaunched.recoveredKeys, []);
  assert.equal(relaunched.avatarConfig, null);
  assert.equal(
    storage.values.get(LOCAL_KEYS.avatarConfigRecovery),
    malformedLegacyConfig,
    "the first recovery copy remains owner-recoverable without being surfaced again",
  );
});

test("concurrent local pets cannot both claim the same unowned legacy avatar", async () => {
  const storage = new FakeAvatarStorage();
  const legacyConfig = JSON.stringify({ templateId: "one-local-dog" });
  storage.values.set(LEGACY_AVATAR_CONFIG_STORAGE_KEY, legacyConfig);
  const bothClaimReadsStarted = deferred<void>();
  const claimReadGate = deferred<void>();
  let claimReads = 0;
  storage.getHandler = async (key) => {
    const snapshot = storage.values.get(key) ?? null;
    if (key === AVATAR_LEGACY_LOCAL_CLAIM_KEY) {
      claimReads += 1;
      if (claimReads === 2) bothClaimReadsStarted.resolve();
      await claimReadGate.promise;
    }
    return snapshot;
  };
  const createForPet = (activePetId: string) =>
    createAvatarPersistence<Record<string, unknown>, Record<string, unknown>>({
      storage,
      scope: { ownerUserId: null, householdId: null, activePetId },
      parseAvatarSet: (decoded) => ({ value: decoded }),
      parseAvatarConfig: (decoded) => ({ value: decoded }),
    });

  const firstHydration = createForPet("dog-a").hydrate();
  const secondHydration = createForPet("dog-b").hydrate();
  await bothClaimReadsStarted.promise;
  claimReadGate.resolve();
  await Promise.all([firstHydration, secondHydration]);

  const copiedConfigs = [...storage.values.entries()].filter(
    ([key, value]) =>
      key.startsWith("woofwatcher.petAvatarConfig.v2.scope.local.pet.") &&
      value === legacyConfig,
  );
  assert.equal(copiedConfigs.length, 1);
  assert.equal(
    storage.values.get(AVATAR_LEGACY_LOCAL_CLAIM_KEY),
    copiedConfigs[0]?.[0].endsWith("dog-a")
      ? "complete:local.pet.dog-a"
      : "complete:local.pet.dog-b",
  );
});

test("a new household waits for and fences a deferred prior-household save", async () => {
  const storage = new FakeAvatarStorage();
  const createForHousehold = (householdId: string) =>
    createAvatarPersistence<Record<string, unknown>, Record<string, unknown>>({
      storage,
      scope: {
        ownerUserId: "user-1",
        householdId,
        activePetId: "primary",
      },
      parseAvatarSet: (decoded) => ({ value: decoded }),
      parseAvatarConfig: (decoded) => ({ value: decoded }),
    });
  const householdA = createForHousehold("house-a");
  const householdB = createForHousehold("house-b");
  assert.equal((await householdA.hydrate()).status, "ready");

  const writeStarted = deferred<void>();
  const writeGate = deferred<void>();
  storage.setHandler = async (key, value) => {
    if (key.includes("household.house-a") && value.includes("stale-a")) {
      writeStarted.resolve();
      await writeGate.promise;
    }
    storage.values.set(key, value);
  };
  const staleSave = householdA.saveAvatarConfig(
    JSON.stringify({ templateId: "stale-a" }),
  );
  await writeStarted.promise;
  householdA.deactivate?.();

  let householdBSettled = false;
  const householdBHydration = householdB.hydrate().then((result) => {
    householdBSettled = true;
    return result;
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(
    householdBSettled,
    false,
    "the next scope must wait for the shared writer barrier",
  );

  writeGate.resolve();
  await assert.rejects(staleSave, /scope change/);
  const householdBResult = await householdBHydration;
  assert.equal(householdBResult.status, "ready");
  assert.equal(
    householdBResult.status === "ready"
      ? householdBResult.avatarConfig
      : undefined,
    null,
  );
  assert.equal(
    storage.values.has(
      "woofwatcher.petAvatarConfig.v2.scope.account.user-1.household.house-b.pet.primary",
    ),
    false,
  );
});

test("privacy erase drains an old-scope writer before a global key wipe", async () => {
  const storage = new FakeAvatarStorage();
  const createForHousehold = (householdId: string) =>
    createAvatarPersistence<Record<string, unknown>, Record<string, unknown>>({
      storage,
      scope: {
        ownerUserId: "user-1",
        householdId,
        activePetId: "primary",
      },
      parseAvatarSet: (decoded) => ({ value: decoded }),
      parseAvatarConfig: (decoded) => ({ value: decoded }),
    });
  const oldScope = createForHousehold("house-a");
  const activeScope = createForHousehold("house-b");
  assert.equal((await oldScope.hydrate()).status, "ready");
  assert.equal((await activeScope.hydrate()).status, "ready");

  const writeStarted = deferred<void>();
  const writeGate = deferred<void>();
  storage.setHandler = async (key, value) => {
    if (key.includes("household.house-a") && value.includes("late-private")) {
      writeStarted.resolve();
      await writeGate.promise;
    }
    storage.values.set(key, value);
  };
  const staleSave = oldScope.saveAvatarConfig(
    JSON.stringify({ templateId: "late-private" }),
  );
  await writeStarted.promise;

  let globalWipeStarted = false;
  const privacyWipe = (async () => {
    await activeScope.eraseAvatarData();
    globalWipeStarted = true;
    for (const key of [...storage.values.keys()]) {
      if (key.startsWith("woofwatcher")) storage.values.delete(key);
    }
  })();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(
    globalWipeStarted,
    false,
    "global enumeration must wait for already-dispatched avatar writes",
  );

  writeGate.resolve();
  await Promise.allSettled([staleSave, privacyWipe]);
  assert.deepEqual(
    [...storage.values.keys()].filter((key) => key.startsWith("woofwatcher")),
    [],
  );
  await assert.rejects(
    oldScope.saveAvatarConfig(JSON.stringify({ templateId: "resurrected" })),
    /scope change|loads successfully/,
  );
});
