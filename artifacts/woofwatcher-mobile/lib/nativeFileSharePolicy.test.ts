import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  classifyNativeFileShareResult,
  decideNativeFileShare,
} from "./nativeFileSharePolicy.ts";

const filePayload = {
  title: "Phoenix Care Pass",
  message: "Saved locally.",
  url: "content://woofwatcher/care-pass.pdf",
};

test("iOS keeps the native URL attachment path", () => {
  assert.deepEqual(decideNativeFileShare("ios", filePayload), {
    supported: true,
  });
});

test("Android fails closed because React Native Share does not attach URL files there", () => {
  assert.deepEqual(decideNativeFileShare("android", filePayload), {
    supported: false,
    reason: "android-url-attachment-unsupported",
  });
});

test("non-file text payloads stay shareable on Android", () => {
  assert.deepEqual(
    decideNativeFileShare("android", {
      title: "Phoenix Care Pass",
      message: "Care summary text.",
    }),
    { supported: true },
  );
});

test("iOS native share dismissal remains a cancellation, never a shared result", () => {
  assert.equal(
    classifyNativeFileShareResult(
      "ios",
      { action: "dismissedAction" },
      "dismissedAction",
    ),
    "dismissed",
  );
  assert.equal(
    classifyNativeFileShareResult(
      "ios",
      { action: "sharedAction" },
      "dismissedAction",
    ),
    "shared",
  );
});

test("both native Share wrappers propagate the dismissal classifier", () => {
  const root = dirname(fileURLToPath(import.meta.url));
  for (const fileName of ["nativeFileShare.ts", "shareText.ts"]) {
    const source = readFileSync(join(root, fileName), "utf8");
    assert.match(source, /classifyNativeFileShareResult/);
    assert.match(source, /Share\.dismissedAction/);
    assert.doesNotMatch(
      source,
      /await Share\.share\([^;]+;\s*return "shared"/s,
      `${fileName} must not collapse dismissedAction into shared`,
    );
  }
});
