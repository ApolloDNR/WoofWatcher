import assert from "node:assert/strict";
import { test } from "node:test";

import { derivePrivacyConfirmationLayout } from "./privacyConfirmationLayout.ts";

test("compact confirmation sheets stay inside the safe viewport", () => {
  assert.deepEqual(
    derivePrivacyConfirmationLayout({
      viewportHeight: 320,
      topInset: 24,
      fontScale: 1,
    }),
    {
      maxHeight: 288,
      stackActions: false,
    },
  );
});

test("large text gets more vertical room and reachable stacked actions", () => {
  assert.deepEqual(
    derivePrivacyConfirmationLayout({
      viewportHeight: 320,
      topInset: 24,
      fontScale: 1.6,
    }),
    {
      maxHeight: 296,
      stackActions: true,
    },
  );
});

test("invalid dimensions fail closed to a small bounded sheet", () => {
  assert.deepEqual(
    derivePrivacyConfirmationLayout({
      viewportHeight: Number.NaN,
      topInset: -10,
      fontScale: Number.NaN,
    }),
    {
      maxHeight: 280,
      stackActions: false,
    },
  );
});
