import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collectCareWipeFailures,
  createCareLifecycleCoordinator,
  resolveCareWipeCompletion,
  resolveCareWipeVerdict,
} from "./careLifecycle.ts";
import * as careLifecycleModule from "./careLifecycle.ts";
import * as careSyncModule from "./careSync.ts";
import type { CareDocConflict } from "./careDocMerge.ts";

const { createHouseholdScopeReloadCoordinator } = careLifecycleModule;
const { createCareDocConflictDismissal } = careSyncModule;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("an identity switch rejects a deferred server result from the previous account", async () => {
  const lifecycle = createCareLifecycleCoordinator();
  const accountA = lifecycle.beginIdentityChange();
  assert.equal(lifecycle.completeHydration(accountA), true);
  const server = deferred<string>();

  const result = server.promise.then((value) =>
    lifecycle.isCurrent(accountA) ? value : null,
  );
  lifecycle.beginIdentityChange();
  server.resolve("account-a-care");

  assert.equal(await result, null);
});

test("a delayed conflict confirmation cannot dismiss conflicts after a household switch", () => {
  assert.equal(
    typeof createCareDocConflictDismissal,
    "function",
    "conflict dismissal needs an owned deferred callback",
  );
  if (!createCareDocConflictDismissal) return;
  const lifecycle = createCareLifecycleCoordinator();
  const householdA = lifecycle.beginIdentityChange();
  assert.equal(lifecycle.completeHydration(householdA), true);
  let scopeKey = "account:user-1:household-a";
  const conflictA: CareDocConflict = {
    path: "profile.name",
    base: { present: true, value: "Phoenix" },
    server: { present: true, value: "Phoenix A" },
    local: { present: true, value: "Phoenix Local" },
    resolution: "local",
  };
  const conflictB: CareDocConflict = {
    path: "dietProfile.primaryFood",
    base: { present: true, value: "Old food" },
    server: { present: true, value: "Food B" },
    local: { present: true, value: "Local food B" },
    resolution: "local",
  };
  let conflicts = [conflictA];
  const delayedConfirmation = createCareDocConflictDismissal({
    conflict: conflictA,
    scopeKey,
    isLifecycleCurrent: () => lifecycle.isCurrent(householdA),
    readScopeKey: () => scopeKey,
    readConflicts: () => conflicts,
    commitConflicts: (next) => {
      conflicts = next;
    },
  });

  const householdB = lifecycle.beginIdentityChange();
  scopeKey = "account:user-1:household-b";
  conflicts = [conflictB];
  assert.equal(lifecycle.completeHydration(householdB), true);

  assert.equal(delayedConfirmation(), false);
  assert.deepEqual(conflicts, [conflictB]);
});

test("conflict dismissal rejects a changed snapshot and removes only its reviewed row", () => {
  assert.equal(typeof createCareDocConflictDismissal, "function");
  if (!createCareDocConflictDismissal) return;
  const lifecycle = createCareLifecycleCoordinator();
  const household = lifecycle.beginIdentityChange();
  assert.equal(lifecycle.completeHydration(household), true);
  const scopeKey = "account:user-1:household-a";
  const first: CareDocConflict = {
    path: "profile.name",
    base: { present: true, value: "Phoenix" },
    server: { present: true, value: "Phoenix A" },
    local: { present: true, value: "Phoenix Local" },
    resolution: "local",
  };
  const second: CareDocConflict = {
    path: "profile.breed",
    base: { present: true, value: "Mix" },
    server: { present: true, value: "Shepherd mix" },
    local: { present: true, value: "Rescue mix" },
    resolution: "local",
  };
  let conflicts = [first, second];
  const dependencies = {
    scopeKey,
    isLifecycleCurrent: () => lifecycle.isCurrent(household),
    readScopeKey: () => scopeKey,
    readConflicts: () => conflicts,
    commitConflicts: (next: CareDocConflict[]) => {
      conflicts = next;
    },
  };
  const staleConfirmation = createCareDocConflictDismissal({
    ...dependencies,
    conflict: first,
  });

  conflicts = [second, first];
  assert.equal(staleConfirmation(), false);
  assert.deepEqual(conflicts, [second, first]);

  const currentConfirmation = createCareDocConflictDismissal({
    ...dependencies,
    conflict: first,
  });
  assert.equal(currentConfirmation(), true);
  assert.deepEqual(conflicts, [second]);
});

test("a household reload synchronously invalidates deferred H1 get, put, and list commits", async () => {
  assert.equal(
    typeof createHouseholdScopeReloadCoordinator,
    "function",
    "household reloads need a generation-owned coordinator",
  );
  if (!createHouseholdScopeReloadCoordinator) return;

  const lifecycle = createCareLifecycleCoordinator();
  const h1 = lifecycle.beginIdentityChange();
  assert.equal(lifecycle.completeHydration(h1), true);
  const reloads = createHouseholdScopeReloadCoordinator(lifecycle);
  const getResult = deferred<void>();
  const putResult = deferred<void>();
  const listResult = deferred<void>();
  let signedInForSync = true;
  const currentStateCommits: string[] = [];
  const storageCommits: string[] = [];
  const serverFollowups: string[] = [];

  const getFlow = getResult.promise.then(() => {
    if (!lifecycle.isCurrent(h1)) return;
    currentStateCommits.push("get");
    serverFollowups.push("put");
  });
  const putFlow = putResult.promise.then(() => {
    if (!lifecycle.isCurrent(h1)) return;
    currentStateCommits.push("put");
    serverFollowups.push("list");
  });
  const listFlow = listResult.promise.then(async () => {
    if (!lifecycle.isCurrent(h1)) return;
    currentStateCommits.push("list");
    await lifecycle.queueStorageWrite(h1, async () => {
      storageCommits.push("h1");
    });
  });

  const h2Reload = reloads.requestReload(() => {
    signedInForSync = false;
  });
  assert.equal(signedInForSync, false);
  assert.equal(lifecycle.isCurrent(h1), false);

  getResult.resolve();
  putResult.resolve();
  listResult.resolve();
  await Promise.all([getFlow, putFlow, listFlow]);

  assert.deepEqual(currentStateCommits, []);
  assert.deepEqual(storageCommits, []);
  assert.deepEqual(serverFollowups, []);
  await reloads.settleFrom(h2Reload, Promise.resolve(true));
  assert.equal(await h2Reload.promise, true);
});

test("two concurrent household reload callers both settle without cross-generation ownership", async () => {
  assert.equal(typeof createHouseholdScopeReloadCoordinator, "function");
  if (!createHouseholdScopeReloadCoordinator) return;

  const lifecycle = createCareLifecycleCoordinator();
  const reloads = createHouseholdScopeReloadCoordinator(lifecycle);
  const first = reloads.requestReload(() => undefined);
  const second = reloads.requestReload(() => undefined);
  let secondSettled = false;
  void second.promise.then(() => {
    secondSettled = true;
  });

  assert.equal(await first.promise, false);
  await reloads.settleFrom(first, Promise.resolve(true));
  await Promise.resolve();
  assert.equal(secondSettled, false);
  await reloads.settleFrom(second, Promise.resolve(true));
  assert.equal(await second.promise, true);
});

test("household getMe and storage-read failures settle the owned reload false", async () => {
  assert.equal(typeof createHouseholdScopeReloadCoordinator, "function");
  if (!createHouseholdScopeReloadCoordinator) return;

  const lifecycle = createCareLifecycleCoordinator();
  const reloads = createHouseholdScopeReloadCoordinator(lifecycle);
  const getMeReload = reloads.requestReload(() => undefined);
  await reloads.settleFrom(
    getMeReload,
    Promise.reject(new Error("getMe unavailable")),
  );
  assert.equal(await getMeReload.promise, false);

  const storageReload = reloads.requestReload(() => undefined);
  await reloads.settleFrom(storageReload, Promise.resolve(false));
  assert.equal(await storageReload.promise, false);
});

test("provider unmount settles an active household reload false", async () => {
  assert.equal(typeof createHouseholdScopeReloadCoordinator, "function");
  if (!createHouseholdScopeReloadCoordinator) return;

  const lifecycle = createCareLifecycleCoordinator();
  const reloads = createHouseholdScopeReloadCoordinator(lifecycle);
  const active = reloads.requestReload(() => undefined);
  const lateResult = deferred<boolean>();
  const settlement = reloads.settleFrom(active, lateResult.promise);

  reloads.dispose();

  assert.equal(await active.promise, false);
  lateResult.resolve(true);
  await settlement;
});

test("a wipe during hydration cannot release persistence for erased bytes", async () => {
  const lifecycle = createCareLifecycleCoordinator();
  const hydration = lifecycle.beginIdentityChange();
  const storageRead = deferred<string>();
  const result = storageRead.promise.then((value) => ({
    accepted: lifecycle.completeHydration(hydration),
    value,
  }));

  lifecycle.beginWipe();
  storageRead.resolve("pre-wipe-care");

  assert.deepEqual(await result, {
    accepted: false,
    value: "pre-wipe-care",
  });
  assert.equal(
    await lifecycle.queueStorageWrite(
      lifecycle.capture(),
      async () => undefined,
    ),
    "paused",
  );
});

test("a wipe waits for a deferred persistence write before deleting storage", async () => {
  const lifecycle = createCareLifecycleCoordinator();
  const hydration = lifecycle.beginIdentityChange();
  assert.equal(lifecycle.completeHydration(hydration), true);
  const write = deferred<void>();
  const writeStarted = deferred<void>();
  const order: string[] = [];

  const persistence = lifecycle.queueStorageWrite(hydration, async () => {
    order.push("write-start");
    writeStarted.resolve();
    await write.promise;
    order.push("write-finish");
  });
  await writeStarted.promise;

  const wipe = lifecycle.beginWipe();
  const deletion = (async () => {
    await lifecycle.waitForStorageWrites();
    order.push("delete");
  })();
  await Promise.resolve();
  assert.deepEqual(order, ["write-start"]);

  write.resolve();
  assert.equal(await persistence, "stale");
  await deletion;
  assert.deepEqual(order, ["write-start", "write-finish", "delete"]);
  assert.equal(lifecycle.finishWipe(wipe), true);
});

test("a successful authenticated wipe cannot release persistence or automatic sync", async () => {
  const lifecycle = createCareLifecycleCoordinator();
  const hydration = lifecycle.beginIdentityChange();
  assert.equal(lifecycle.completeHydration(hydration), true);
  const wipe = lifecycle.beginWipe();

  const completion = resolveCareWipeCompletion("account", true);
  if (completion.resumeHydration) {
    lifecycle.finishWipe(wipe);
  }

  assert.deepEqual(completion, {
    resumeHydration: false,
    requiresSignOut: true,
  });
  assert.equal(
    await lifecycle.queueStorageWrite(
      lifecycle.capture(),
      async () => undefined,
    ),
    "paused",
  );
  assert.equal(completion.resumeHydration, false);
});

test("a required sign-out rejection produces an incomplete account wipe verdict", async () => {
  let signOutCalls = 0;
  const [careResult, avatarSetResult, avatarConfigResult] =
    await Promise.allSettled([
      Promise.resolve({
        ok: true,
        failures: [],
        requiresSignOut: true,
      }),
      Promise.resolve(),
      Promise.resolve(),
    ]);

  const verdict = await resolveCareWipeVerdict({
    careResult,
    avatarSetResult,
    avatarConfigResult,
    signOut: async () => {
      signOutCalls += 1;
      throw new Error("Clerk unavailable");
    },
  });

  assert.deepEqual(verdict, {
    complete: false,
    failures: ["account-sign-out"],
    clearedAccountCare: false,
  });
  assert.equal(signOutCalls, 1);
});

test("a successful local-preview wipe resumes clean persistence without signing out", async () => {
  const lifecycle = createCareLifecycleCoordinator();
  const hydration = lifecycle.beginIdentityChange();
  assert.equal(lifecycle.completeHydration(hydration), true);
  const wipe = lifecycle.beginWipe();
  const completion = resolveCareWipeCompletion("local", true);
  let signOutCalls = 0;

  if (completion.resumeHydration) {
    assert.equal(lifecycle.finishWipe(wipe), true);
  }
  const [careResult, avatarSetResult, avatarConfigResult] =
    await Promise.allSettled([
      Promise.resolve({
        ok: true,
        failures: [],
        requiresSignOut: completion.requiresSignOut,
      }),
      Promise.resolve(),
      Promise.resolve(),
    ]);
  const verdict = await resolveCareWipeVerdict({
    careResult,
    avatarSetResult,
    avatarConfigResult,
    signOut: async () => {
      signOutCalls += 1;
    },
  });
  let persisted = false;

  assert.deepEqual(completion, {
    resumeHydration: true,
    requiresSignOut: false,
  });
  assert.deepEqual(verdict, {
    complete: true,
    failures: [],
    clearedAccountCare: false,
  });
  assert.equal(signOutCalls, 0);
  assert.equal(
    await lifecycle.queueStorageWrite(lifecycle.capture(), async () => {
      persisted = true;
    }),
    "written",
  );
  assert.equal(persisted, true);
});

test("a deferred file deletion finishes before a new identity hydrates or uses files", async () => {
  const lifecycle = createCareLifecycleCoordinator();
  const accountA = lifecycle.beginIdentityChange();
  assert.equal(lifecycle.completeHydration(accountA), true);
  const wipe = lifecycle.beginWipe();
  const deletionGate = deferred<void>();
  const deletionStarted = deferred<void>();
  const order: string[] = [];

  const deletion = lifecycle.queueDeviceOperation(
    wipe,
    async () => {
      order.push("delete-start");
      deletionStarted.resolve();
      await deletionGate.promise;
      order.push("delete-finish");
    },
    { allowWhilePaused: true, runWhenStale: true },
  );
  await deletionStarted.promise;

  const accountB = lifecycle.beginIdentityChange();
  const hydration = (async () => {
    await lifecycle.waitForDeviceOperations();
    order.push("hydrate-b");
    return lifecycle.completeHydration(accountB);
  })();
  await Promise.resolve();
  assert.deepEqual(order, ["delete-start"]);

  deletionGate.resolve();
  assert.equal(await deletion, "stale");
  assert.equal(await hydration, true);
  assert.deepEqual(order, ["delete-start", "delete-finish", "hydrate-b"]);
});

test("wipe operation failures are reported by exact target", async () => {
  const result = await collectCareWipeFailures([
    { target: "async-storage", run: async () => undefined },
    {
      target: "reports-directory",
      run: async () => {
        throw new Error("filesystem unavailable");
      },
    },
    {
      target: "attachments-directory",
      run: async () => {
        throw new Error("permission denied");
      },
    },
  ]);

  assert.deepEqual(result, {
    ok: false,
    failures: ["reports-directory", "attachments-directory"],
  });
});
