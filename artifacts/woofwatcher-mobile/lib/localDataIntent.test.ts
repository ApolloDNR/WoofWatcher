import assert from "node:assert/strict";
import { test } from "node:test";

import { createGenerationPermitAuthority } from "./generationPermit.ts";
import {
  createLocalDataIntentAuthority,
  runWithLocalDataIntent,
} from "./localDataIntent.ts";
import { createLocalDataResetRuntime } from "./localDataResetRuntime.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function emptyStorage() {
  return {
    async getItem() { return null; },
    async setItem() {},
    async removeItem() {},
  };
}

function attachAllRequiredNoOps(
  runtime: ReturnType<typeof createLocalDataResetRuntime>,
) {
  for (const id of [
    "auth-credentials",
    "avatar",
    "care",
    "device-preferences",
    "files",
    "query-cache",
    "walk-capture",
    "web-runtime",
  ] as const) {
    runtime.attachRequiredParticipant(id, {
      prepare: async () => {},
      commit: async () => {},
    });
  }
}

test("closed admission captures no intent and invokes no interaction", async () => {
  const authority = createLocalDataIntentAuthority({
    generationAuthority: createGenerationPermitAuthority(),
    isAdmissionOpen: () => false,
  });
  let interactions = 0;

  assert.equal(authority.capture(), null);
  assert.deepEqual(
    await runWithLocalDataIntent(authority, async () => {
      interactions += 1;
      return "picked";
    }),
    { status: "revoked" },
  );
  assert.equal(interactions, 0);
});

test("capture rejects an admission change that happens while the permit is issued", () => {
  const generation = createGenerationPermitAuthority();
  let admissionOpen = true;
  const authority = createLocalDataIntentAuthority({
    generationAuthority: {
      capture() {
        const permit = generation.capture();
        admissionOpen = false;
        return permit;
      },
      isValid: generation.isValid,
      invalidate: generation.invalidate,
    },
    isAdmissionOpen: () => admissionOpen,
  });

  assert.equal(authority.capture(), null);
});

test("an opaque intent cannot be forged from another object", () => {
  const authority = createLocalDataIntentAuthority({
    generationAuthority: createGenerationPermitAuthority(),
    isAdmissionOpen: () => true,
  });
  const intent = authority.capture();

  assert.ok(intent);
  assert.equal(authority.isCurrent(intent), true);
  assert.equal(authority.isCurrent({} as typeof intent), false);
});

test("a deferred interaction result is suppressed after successful reset invalidation", async () => {
  const runtime = createLocalDataResetRuntime(emptyStorage());
  attachAllRequiredNoOps(runtime);
  const authority = createLocalDataIntentAuthority({
    generationAuthority: runtime.generationAuthority,
    isAdmissionOpen: runtime.operations.isWriteAdmissionOpen,
  });
  const interaction = deferred<string>();
  const result = runWithLocalDataIntent(authority, () => interaction.promise);

  assert.equal((await runtime.operations.runReset()).status, "complete");
  interaction.resolve("post-reset picker value");

  assert.deepEqual(await result, { status: "revoked" });
});

test("an interaction stays revoked while reset admission is closed", async () => {
  const runtime = createLocalDataResetRuntime(emptyStorage());
  attachAllRequiredNoOps(runtime);
  const commit = deferred<void>();
  runtime.registerParticipant({
    id: "slow-commit",
    prepare: async () => {},
    commit: () => commit.promise,
  });
  const authority = createLocalDataIntentAuthority({
    generationAuthority: runtime.generationAuthority,
    isAdmissionOpen: runtime.operations.isWriteAdmissionOpen,
  });
  const interaction = deferred<string>();
  const result = runWithLocalDataIntent(authority, () => interaction.promise);
  const reset = runtime.operations.runReset();

  interaction.resolve("returned while deleting");
  assert.deepEqual(await result, { status: "revoked" });
  commit.resolve();
  await reset;
});

test("zero-commit preparation failure preserves a picker intent after reset settles", async () => {
  const runtime = createLocalDataResetRuntime(emptyStorage());
  const authority = createLocalDataIntentAuthority({
    generationAuthority: runtime.generationAuthority,
    isAdmissionOpen: runtime.operations.isWriteAdmissionOpen,
  });
  const interaction = deferred<string>();
  const result = runWithLocalDataIntent(authority, () => interaction.promise);

  const reset = await runtime.operations.runReset();
  assert.equal(reset.status, "partial-failure");
  assert.deepEqual(reset.committedParticipantIds, []);
  interaction.resolve("safe retry value");

  const settled = await result;
  assert.equal(settled.status, "complete");
  if (settled.status === "complete") {
    assert.equal(authority.isCurrent(settled.intent), true);
    assert.equal(settled.value, "safe retry value");
  }
});

test("interaction sync throws and async rejections remain rejections", async () => {
  const authority = createLocalDataIntentAuthority({
    generationAuthority: createGenerationPermitAuthority(),
    isAdmissionOpen: () => true,
  });

  await assert.rejects(
    runWithLocalDataIntent(authority, () => {
      throw new Error("picker crashed synchronously");
    }),
    /picker crashed synchronously/,
  );
  await assert.rejects(
    runWithLocalDataIntent(authority, async () => {
      throw new Error("picker rejected");
    }),
    /picker rejected/,
  );
});

test("a fresh interaction succeeds after an older intent was invalidated", async () => {
  const generation = createGenerationPermitAuthority();
  const authority = createLocalDataIntentAuthority({
    generationAuthority: generation,
    isAdmissionOpen: () => true,
  });
  const oldIntent = authority.capture();
  assert.ok(oldIntent);
  generation.invalidate();

  assert.equal(authority.isCurrent(oldIntent), false);
  const result = await runWithLocalDataIntent(authority, async () => "fresh");
  assert.equal(result.status, "complete");
  if (result.status === "complete") {
    assert.equal(authority.isCurrent(result.intent), true);
    assert.equal(result.value, "fresh");
  }
});
