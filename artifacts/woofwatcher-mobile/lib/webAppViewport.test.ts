import assert from "node:assert/strict";
import test from "node:test";

import { resolveWebAppViewport } from "./webAppViewport.ts";

test("desktop previews expose the phone canvas dimensions to app routes", () => {
  assert.deepEqual(resolveWebAppViewport({ width: 1365, height: 700 }), {
    width: 390,
    height: 700,
    framed: true,
  });
});

test("phone-sized previews remain full bleed without changing their measured viewport", () => {
  assert.deepEqual(resolveWebAppViewport({ width: 390, height: 844 }), {
    width: 390,
    height: 844,
    framed: false,
  });
});

test("the compact-preview threshold and invalid-width fallback stay explicit", () => {
  assert.deepEqual(resolveWebAppViewport({ width: 520, height: 700 }), {
    width: 520,
    height: 700,
    framed: false,
  });
  assert.deepEqual(resolveWebAppViewport({ width: 521, height: 700 }), {
    width: 390,
    height: 700,
    framed: true,
  });
  assert.deepEqual(resolveWebAppViewport({ width: 0, height: 844 }), {
    width: 390,
    height: 844,
    framed: false,
  });
});
