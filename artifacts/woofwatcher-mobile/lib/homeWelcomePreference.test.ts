import assert from "node:assert/strict";
import test from "node:test";
import {
  createHomeWelcomePreference,
  selectHomeWelcomeDismissal,
} from "./homeWelcomePreference.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const accountAScope = {
  ownerUserId: "user.a",
  householdId: "household.shared",
  activePetId: "pet.phoenix",
};

test("keeps a dismissed welcome isolated when the active account changes", async () => {
  const stored = new Map<string, string>();
  const storage = {
    getItem: async (key: string) => stored.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      stored.set(key, value);
    },
  };
  const accountA = createHomeWelcomePreference(storage, accountAScope);
  const accountB = createHomeWelcomePreference(storage, {
    ownerUserId: "user.b",
    householdId: "household.shared",
    activePetId: "pet.phoenix",
  });
  assert.ok(accountA);
  assert.ok(accountB);

  await accountA.dismiss();

  assert.equal(await accountA.hydrate(), true);
  assert.equal(await accountB.hydrate(), false);
});

test("a remounted scope waits for its in-flight dismissal before hydrating", async () => {
  const writeStarted = deferred<void>();
  const finishWrite = deferred<void>();
  const stored = new Map<string, string>();
  const storage = {
    getItem: async (key: string) => stored.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      writeStarted.resolve();
      await finishWrite.promise;
      stored.set(key, value);
    },
  };
  const firstMount = createHomeWelcomePreference(storage, accountAScope);
  assert.ok(firstMount);
  const dismissal = firstMount.dismiss();
  await writeStarted.promise;

  const secondMount = createHomeWelcomePreference(storage, accountAScope);
  assert.ok(secondMount);
  const hydration = secondMount.hydrate();
  let hydrationFinished = false;
  void hydration.then(() => {
    hydrationFinished = true;
  });
  for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
  assert.equal(
    hydrationFinished,
    false,
    "the remount must not read from the middle of its detached write",
  );

  finishWrite.resolve();
  await dismissal;
  assert.equal(await hydration, true);
});

test("only the local unauthenticated scope preserves the legacy dismissal", async () => {
  const stored = new Map<string, string>([
    ["woofwatcher.homeWelcomeDismissed.v1", "true"],
  ]);
  const storage = {
    getItem: async (key: string) => stored.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      stored.set(key, value);
    },
  };
  const local = createHomeWelcomePreference(storage, {
    ownerUserId: null,
    householdId: null,
    activePetId: "pet.phoenix",
  });
  const authenticated = createHomeWelcomePreference(storage, accountAScope);
  assert.ok(local);
  assert.ok(authenticated);

  assert.equal(await local.hydrate(), true);
  assert.equal(await authenticated.hydrate(), false);
});

test("fails closed until the exact active scope has hydrated", () => {
  let storageReads = 0;
  let storageWrites = 0;
  const storage = {
    getItem: async () => {
      storageReads += 1;
      return null;
    },
    setItem: async () => {
      storageWrites += 1;
    },
  };
  const accountA = createHomeWelcomePreference(storage, accountAScope);
  const accountB = createHomeWelcomePreference(storage, {
    ...accountAScope,
    ownerUserId: "user.b",
  });
  assert.ok(accountA);
  assert.ok(accountB);
  const unresolvedScopes = [
    null,
    { ...accountAScope, householdId: null },
    { ...accountAScope, ownerUserId: null },
    { ...accountAScope, activePetId: " " },
  ];
  for (const scope of unresolvedScopes) {
    assert.equal(createHomeWelcomePreference(storage, scope), null);
  }
  assert.equal(storageReads, 0);
  assert.equal(storageWrites, 0);
  const hydratedForA = { key: accountA.key, dismissed: true };

  assert.equal(selectHomeWelcomeDismissal(null, hydratedForA), null);
  assert.equal(selectHomeWelcomeDismissal(accountB, hydratedForA), null);
  assert.equal(selectHomeWelcomeDismissal(accountA, hydratedForA), true);
});
