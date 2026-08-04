import assert from "node:assert/strict";
import test from "node:test";

import { isHomeSceneReady } from "./homeSceneReady.ts";

test("Home waits for care data and the persisted welcome choice before measuring the fixed scene", () => {
  assert.equal(isHomeSceneReady(false, null), false);
  assert.equal(isHomeSceneReady(true, null), false);
  assert.equal(isHomeSceneReady(false, false), false);
  assert.equal(isHomeSceneReady(true, false), true);
  assert.equal(isHomeSceneReady(true, true), true);
});
