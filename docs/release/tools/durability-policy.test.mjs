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
  const actionLines = workflow
    .split("\n")
    .filter((line) => /^\s*uses:/.test(line));
  assert.match(workflow, /release\/\*\*/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /concurrency:/);
  assert.match(workflow, /validate-store-materials\.mjs/);
  assert.ok(actionLines.length > 0, "workflow must use at least one action");
  for (const line of actionLines) {
    assert.match(
      line,
      /^\s*uses:\s+\S+@[0-9a-f]{40}(?:[ \t]+#.*)?[ \t]*$/,
      `${line.trim()} must use a full commit SHA`,
    );
  }
});

test("GitHub verification uses the repaired pnpm bootstrap and proves the exact toolchain", () => {
  const workflow = read(".github/workflows/verify.yml");
  const plan = read(
    "docs/superpowers/plans/2026-08-13-woofwatcher-v1-release-recovery.md",
  );
  assert.match(
    workflow,
    /pnpm\/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86/,
  );
  assert.match(workflow, /name: Setup pnpm[\s\S]*?version: 10\.24\.0/);
  assert.match(workflow, /name: Setup Node[\s\S]*?node-version: 24/);
  assert.match(workflow, /test "\$\(pnpm --version\)" = "10\.24\.0"/);
  assert.match(workflow, /pnpm install --frozen-lockfile/);
  assert.match(plan, /pnpm setup to `0977fd99725f1db4007ccb2928dbb4e90d06cc86`/);
  assert.doesNotMatch(
    `${workflow}\n${plan}`,
    /ebd50bdde86241dd1b03a5b0a54a71aee9a1ca80/,
  );

  const nodeSetup = workflow.indexOf("node-version: 24");
  const toolchainProof = workflow.indexOf('test "$(pnpm --version)" = "10.24.0"');
  const frozenInstall = workflow.indexOf("pnpm install --frozen-lockfile");
  assert.ok(
    nodeSetup >= 0 && nodeSetup < toolchainProof && toolchainProof < frozenInstall,
    "Node setup and exact pnpm proof must precede the frozen install",
  );
});
