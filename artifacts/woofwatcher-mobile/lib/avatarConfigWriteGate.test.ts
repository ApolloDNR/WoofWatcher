import assert from "node:assert/strict";
import test from "node:test";

async function loadAvatarConfigWriteGate() {
  const module = await import("./avatarConfigWriteGate.ts").catch(() => null);
  assert.ok(module, "the Avatar config write gate must exist");
  return module;
}

test("an unconditional reservation advances revision and reports pending synchronously", async () => {
  const { createAvatarConfigWriteGate } = await loadAvatarConfigWriteGate();
  const gate = createAvatarConfigWriteGate();

  assert.deepEqual(gate.snapshot(), { revision: 0, pending: false });
  const reservation = gate.begin();

  assert.equal(reservation.revision, 1);
  assert.deepEqual(gate.snapshot(), { revision: 1, pending: true });
});

test("finishing a reservation clears its pending state exactly once", async () => {
  const { createAvatarConfigWriteGate } = await loadAvatarConfigWriteGate();
  const gate = createAvatarConfigWriteGate();
  const reservation = gate.begin();

  assert.equal(typeof gate.finish, "function");
  assert.equal(gate.finish(reservation), true);
  assert.deepEqual(gate.snapshot(), { revision: 1, pending: false });
  assert.equal(gate.finish(reservation), false);
  assert.deepEqual(gate.snapshot(), { revision: 1, pending: false });
});

test("overlapping unconditional reservations remain pending until both finish", async () => {
  const { createAvatarConfigWriteGate } = await loadAvatarConfigWriteGate();
  const gate = createAvatarConfigWriteGate();
  const first = gate.begin();
  const second = gate.begin();

  assert.equal(first.revision, 1);
  assert.equal(second.revision, 2);
  assert.deepEqual(gate.snapshot(), { revision: 2, pending: true });
  assert.equal(gate.finish(first), true);
  assert.deepEqual(gate.snapshot(), { revision: 2, pending: true });
  assert.equal(gate.finish(second), true);
  assert.deepEqual(gate.snapshot(), { revision: 2, pending: false });
});

test("a conditional reservation rejects a stale expected revision without mutation", async () => {
  const { createAvatarConfigWriteGate } = await loadAvatarConfigWriteGate();
  const gate = createAvatarConfigWriteGate();
  const first = gate.begin();
  assert.equal(gate.finish(first), true);

  assert.equal(typeof gate.beginIfCurrent, "function");
  assert.equal(gate.beginIfCurrent(0), null);
  assert.deepEqual(gate.snapshot(), { revision: 1, pending: false });
});

test("a conditional reservation only starts from an exact idle snapshot", async () => {
  const { createAvatarConfigWriteGate } = await loadAvatarConfigWriteGate();
  const gate = createAvatarConfigWriteGate();
  const active = gate.begin();

  assert.equal(gate.beginIfCurrent(1), null);
  assert.deepEqual(gate.snapshot(), { revision: 1, pending: true });
  assert.equal(gate.finish(active), true);

  const conditional = gate.beginIfCurrent(1);
  assert.ok(conditional);
  assert.equal(conditional.revision, 2);
  assert.deepEqual(gate.snapshot(), { revision: 2, pending: true });
});

test("invalidation advances the fence without losing active write accounting", async () => {
  const { createAvatarConfigWriteGate } = await loadAvatarConfigWriteGate();
  const gate = createAvatarConfigWriteGate();
  const active = gate.begin();

  assert.equal(typeof gate.invalidate, "function");
  gate.invalidate();

  assert.deepEqual(gate.snapshot(), { revision: 2, pending: true });
  assert.equal(gate.beginIfCurrent(1), null);
  assert.equal(gate.finish(active), true);
  assert.deepEqual(gate.snapshot(), { revision: 2, pending: false });
});
