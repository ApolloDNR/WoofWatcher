import assert from "node:assert/strict";
import { test } from "node:test";

import { createGenerationPermitAuthority } from "./generationPermit.ts";

test("invalidation revokes every permit captured before a reset", () => {
  const authority = createGenerationPermitAuthority();
  const first = authority.capture();
  const second = authority.capture();

  assert.equal(authority.isValid(first), true);
  assert.equal(authority.isValid(second), true);

  authority.invalidate();

  assert.equal(authority.isValid(first), false);
  assert.equal(authority.isValid(second), false);
});

test("a permit captured after invalidation belongs to the fresh generation", () => {
  const authority = createGenerationPermitAuthority();
  const stale = authority.capture();

  authority.invalidate();
  const fresh = authority.capture();

  assert.equal(authority.isValid(stale), false);
  assert.equal(authority.isValid(fresh), true);
});

test("an authority rejects a permit issued by another authority", () => {
  const firstAuthority = createGenerationPermitAuthority();
  const secondAuthority = createGenerationPermitAuthority();
  const foreign = firstAuthority.capture();

  assert.equal(firstAuthority.isValid(foreign), true);
  assert.equal(secondAuthority.isValid(foreign), false);
});

test("a stale permit cannot be revived by mutating runtime fields", () => {
  const authority = createGenerationPermitAuthority();
  const stale = authority.capture();

  authority.invalidate();

  assert.equal(Object.isFrozen(stale), true);
  assert.throws(
    () => Object.assign(stale as object, { generation: 1 }),
    TypeError,
  );
  assert.equal(authority.isValid(stale), false);
});

test("a copied or forged token was never issued by the authority", () => {
  const authority = createGenerationPermitAuthority();
  const issued = authority.capture();
  const copied = { ...(issued as object) } as typeof issued;
  const forged = { generation: 0 } as unknown as typeof issued;

  assert.equal(authority.isValid(issued), true);
  assert.equal(authority.isValid(copied), false);
  assert.equal(authority.isValid(forged), false);
});
