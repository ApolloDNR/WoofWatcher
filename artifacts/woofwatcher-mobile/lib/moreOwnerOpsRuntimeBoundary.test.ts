import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const MOBILE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(MOBILE_ROOT, "app", "(tabs)", "more.tsx"), "utf8");

test("consumer More does not hydrate or recompute owner QA state", () => {
  assert.match(
    source,
    /if \(ownerOps && qaProofHydrationRetryRef\.current === null\)/,
  );
  assert.match(
    source,
    /if \(!ownerOps \|\| !hydrationRetry\) return undefined;[\s\S]*hydrateQaProof\(\)/,
  );
  assert.match(
    source,
    /ownerLaunchProviderProfile[\s\S]*EMPTY_MORE_PROVIDER_SETUP_PLAN/,
  );
  assert.match(
    source,
    /if \(!ownerOps\) return EMPTY_MORE_ATTACHMENT_MANIFEST/,
  );
  assert.match(
    source,
    /ownerLaunchSupportProfile[\s\S]*EMPTY_MORE_SUPPORT_PLAN/,
  );
});
