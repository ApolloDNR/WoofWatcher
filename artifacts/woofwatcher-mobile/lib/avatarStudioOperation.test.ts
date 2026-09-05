import assert from "node:assert/strict";
import test from "node:test";

async function loadOperationGate() {
  const module = await import("./avatarStudioOperation.ts").catch(() => null);
  assert.ok(module, "the Avatar Studio operation gate must exist");
  return module;
}

test("the Avatar Studio operation gate locks duplicate same-frame mutations", async () => {
  const { createAvatarStudioOperationGate } = await loadOperationGate();
  const gate = createAvatarStudioOperationGate<
    "picking-camera" | "saving" | "resetting"
  >();

  const save = gate.begin("saving");
  assert.ok(save);
  assert.equal(gate.isBusy(), true);
  assert.equal(gate.begin("resetting"), null);
  assert.equal(gate.isCurrent(save), true);
  assert.equal(gate.finish(save), true);
  assert.equal(gate.isBusy(), false);
});

test("a stale completion cannot unlock a newer Avatar Studio operation", async () => {
  const { createAvatarStudioOperationGate } = await loadOperationGate();
  const gate = createAvatarStudioOperationGate<"saving" | "resetting">();
  const staleSave = gate.begin("saving");
  assert.ok(staleSave);

  gate.invalidate();
  const currentReset = gate.begin("resetting");
  assert.ok(currentReset);
  assert.equal(gate.isCurrent(staleSave), false);
  assert.equal(gate.finish(staleSave), false);
  assert.equal(gate.isCurrent(currentReset), true);
  assert.equal(gate.finish(currentReset), true);
  assert.equal(gate.isBusy(), false);
});

test("a same-frame Avatar Studio edit is synchronously captured by save", async () => {
  const { createAvatarStudioDraftAuthority } = await loadOperationGate();
  assert.equal(
    typeof createAvatarStudioDraftAuthority,
    "function",
    "the Avatar Studio draft authority must exist",
  );
  const authority = createAvatarStudioDraftAuthority({
    coat: "black",
    marking: "none",
  });
  const initial = authority.capture();

  const edited = authority.edit((current) => ({
    ...current,
    marking: "blaze",
  }));
  const capturedForSave = authority.capture();

  assert.deepEqual(capturedForSave.draft, {
    coat: "black",
    marking: "blaze",
  });
  assert.ok(edited.version > initial.version);
  assert.equal(capturedForSave.version, edited.version);
});

test("a stale save completion cannot replace or clean a newer Avatar Studio edit", async () => {
  const { createAvatarStudioDraftAuthority } = await loadOperationGate();
  assert.equal(
    typeof createAvatarStudioDraftAuthority,
    "function",
    "the Avatar Studio draft authority must exist",
  );
  const authority = createAvatarStudioDraftAuthority({
    coat: "black",
    marking: "none",
  });
  const capturedForSave = authority.capture();

  const newerEdit = authority.edit((current) => ({
    ...current,
    coat: "gold",
  }));
  assert.equal(authority.isCurrent(capturedForSave), false);
  assert.equal(authority.isCurrent(newerEdit), true);
  const accepted = authority.replaceIfCurrent(capturedForSave, {
    ...capturedForSave.draft,
    savedAt: "old-completion",
  });

  assert.equal(accepted, null);
  assert.deepEqual(authority.capture(), newerEdit);
  assert.deepEqual(authority.capture().draft, {
    coat: "gold",
    marking: "none",
  });
});
