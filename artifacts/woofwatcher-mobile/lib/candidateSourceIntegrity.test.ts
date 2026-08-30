import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const repositoryRoot = process.cwd();
const smokeScriptSource = join(
  repositoryRoot,
  "artifacts",
  "woofwatcher-mobile",
  "scripts",
  "smoke-web-export.js",
);

type CandidateFixture = {
  root: string;
  mobileRoot: string;
  env: NodeJS.ProcessEnv;
};

function run(
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv },
) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
  });
}

function createCandidateFixture(
  emittedJavaScript = '"Search More destinations";\n',
): CandidateFixture {
  const fixtureRoot = mkdtempSync(
    join(tmpdir(), "woofwatcher-candidate-integrity-"),
  );
  const root = join(fixtureRoot, "repository");
  const mobileRoot = join(root, "artifacts", "woofwatcher-mobile");
  const scriptPath = join(mobileRoot, "scripts", "smoke-web-export.js");
  const binRoot = join(fixtureRoot, "bin");
  const pnpmPath = join(binRoot, "pnpm");

  mkdirSync(dirname(scriptPath), { recursive: true });
  mkdirSync(binRoot, { recursive: true });
  copyFileSync(smokeScriptSource, scriptPath);
  writeFileSync(join(mobileRoot, ".gitignore"), ".expo-smoke/\n");
  writeFileSync(
    join(mobileRoot, "tracked-source.ts"),
    "export const value = 1;\n",
  );
  writeFileSync(
    pnpmPath,
    `#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const outputIndex = process.argv.indexOf("--output-dir");
const outputRoot = path.resolve(process.cwd(), process.argv[outputIndex + 1]);
fs.mkdirSync(path.join(outputRoot, "_expo", "static", "js", "web"), { recursive: true });
fs.writeFileSync(path.join(outputRoot, "index.html"), '<html><head></head><body><script src="/_expo/static/js/web/entry-deadbeef1234.js"></script></body></html>');
fs.writeFileSync(path.join(outputRoot, "_expo", "static", "js", "web", "entry-deadbeef1234.js"), ${JSON.stringify(emittedJavaScript)});
`,
  );
  chmodSync(pnpmPath, 0o755);

  assert.equal(run("git", ["init", "--quiet"], { cwd: root }).status, 0);
  assert.equal(run("git", ["add", "."], { cwd: root }).status, 0);
  const commit = run(
    "git",
    [
      "-c",
      "user.name=WoofWatcher Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    ],
    { cwd: root },
  );
  assert.equal(commit.status, 0, commit.stderr);

  const head = run("git", ["rev-parse", "HEAD"], { cwd: root });
  assert.equal(head.status, 0, head.stderr);

  return {
    root: fixtureRoot,
    mobileRoot,
    env: {
      ...process.env,
      PATH: `${binRoot}${delimiter}${process.env.PATH ?? ""}`,
      WOOFWATCHER_SOURCE_SHA: head.stdout.trim(),
    },
  };
}

function runCandidate(fixture: CandidateFixture) {
  return run(process.execPath, ["scripts/smoke-web-export.js", "--candidate"], {
    cwd: fixture.mobileRoot,
    env: fixture.env,
  });
}

test("candidate source integrity reports the exact tracked path that blocks packaging", () => {
  const fixture = createCandidateFixture();
  try {
    writeFileSync(
      join(fixture.mobileRoot, "tracked-source.ts"),
      "export const value = 2;\n",
    );

    const result = runCandidate(fixture);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Candidate source worktree is dirty/);
    assert.match(result.stderr, /tracked-source\.ts/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("candidate source integrity reports unrelated untracked source", () => {
  const fixture = createCandidateFixture();
  try {
    writeFileSync(join(fixture.mobileRoot, "untracked-source.ts"), "uncommitted\n");

    const result = runCandidate(fixture);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Candidate source worktree is dirty/);
    assert.match(result.stderr, /untracked-source\.ts/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("candidate source integrity permits and replaces stale ignored smoke output", () => {
  const fixture = createCandidateFixture();
  try {
    const stalePath = join(fixture.mobileRoot, ".expo-smoke", "stale.txt");
    mkdirSync(dirname(stalePath), { recursive: true });
    writeFileSync(stalePath, "stale\n");

    const result = runCandidate(fixture);

    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stderr, /Candidate source worktree is dirty/);
    assert.equal(existsSync(stalePath), false);
    assert.equal(
      existsSync(join(fixture.mobileRoot, ".expo-smoke", "candidate-identity.json")),
      true,
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

for (const ownerOnlyMarker of [
  "deriveLaunchProviderSetup",
  "deriveSupportRunbookPlan",
  "Open sprite QA cockpit",
  "avatar-sprite-production-review",
]) {
  test(`candidate consumer boundary rejects bundled owner marker: ${ownerOnlyMarker}`, () => {
    const fixture = createCandidateFixture(
      `"Search More destinations";${JSON.stringify(ownerOnlyMarker)};\n`,
    );
    try {
      const result = runCandidate(fixture);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /owner-only QA implementation marker/);
      assert.match(result.stderr, new RegExp(ownerOnlyMarker));
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
}
