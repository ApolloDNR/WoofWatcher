import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { deriveWebDialogLayout } from "./webDialogLayout.ts";

const host = readFileSync(
  new URL("../components/WebDialogHost.tsx", import.meta.url),
  "utf8",
);

test("web dialogs stay usable at large text and narrow mobile-web viewports", () => {
  assert.match(host, /useWindowDimensions\(\)/);
  assert.match(host, /deriveWebDialogLayout\(\{/);
  assert.match(host, /<ScrollView[\s\S]*contentContainerStyle=\{s\.cardContent\}/);
  assert.match(host, /maxHeight:\s*dialogLayout\.maxCardHeight/);
  assert.match(
    host,
    /dialogLayout\.stackActions\s*&&\s*s\.buttonRowStacked/,
  );
  assert.match(
    host,
    /dialogLayout\.stackActions\s*&&\s*s\.buttonStacked/,
  );
});

test("web dialog layout stacks mobile or large-text actions and bounds its card", () => {
  assert.deepEqual(
    deriveWebDialogLayout({ width: 390, height: 844, fontScale: 1 }),
    { maxCardHeight: 796, stackActions: true },
  );
  assert.deepEqual(
    deriveWebDialogLayout({ width: 1024, height: 600, fontScale: 1.2 }),
    { maxCardHeight: 552, stackActions: true },
  );
  assert.deepEqual(
    deriveWebDialogLayout({ width: 1024, height: 600, fontScale: 1 }),
    { maxCardHeight: 552, stackActions: false },
  );
});
