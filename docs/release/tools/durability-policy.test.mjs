import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("release status records an immutable remote checkpoint and native boundary", () => {
  const status = read("docs/release/STATUS.md");
  assert.match(status, /release\/woofwatcher-v1/);
  assert.match(status, /0f1107b170b0a9c89548a51f5cdeb664ba98246f/);
  assert.match(status, /PENDING NATIVE|BLOCKED.*NATIVE/s);
  assert.match(status, /1,037\/1,037/);
});

test("durable workflow forbids local-only completion and history rewrites", () => {
  const workflow = read("docs/operations/DURABLE_DEVELOPMENT_WORKFLOW.md");
  assert.match(workflow, /not complete until.*push.*remote SHA/is);
  assert.match(workflow, /No force-push/i);
  assert.match(workflow, /workspace.*pruned.*clone/is);
});

test("GitHub verification runs on release pushes with least privilege and store validation", () => {
  const workflow = read(".github/workflows/verify.yml");
  assert.match(workflow, /release\/\*\*/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /concurrency:/);
  assert.match(workflow, /validate-store-materials\.mjs/);
  assert.doesNotMatch(workflow, /uses:\s+[^\n]+@v\d+\s*$/m);
});
