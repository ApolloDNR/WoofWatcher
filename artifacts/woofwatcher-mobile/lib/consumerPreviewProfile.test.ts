import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test from "node:test";

const repositoryRoot = process.cwd();
const mobileRoot = join(repositoryRoot, "artifacts", "woofwatcher-mobile");
const smokeScriptSource = join(mobileRoot, "scripts", "smoke-web-export.js");

type Fixture = {
  root: string;
  mobileRoot: string;
  env: NodeJS.ProcessEnv;
};

function createFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "woofwatcher-consumer-preview-"));
  const fixtureMobileRoot = join(root, "artifacts", "woofwatcher-mobile");
  const fixtureScripts = join(fixtureMobileRoot, "scripts");
  const binRoot = join(root, "bin");
  const fakePnpmScript = join(binRoot, "fake-pnpm.js");

  mkdirSync(fixtureScripts, { recursive: true });
  mkdirSync(binRoot, { recursive: true });
  copyFileSync(smokeScriptSource, join(fixtureScripts, "smoke-web-export.js"));
  writeFileSync(
    fakePnpmScript,
    `const fs = require("fs");
const path = require("path");
const outputIndex = process.argv.indexOf("--output-dir");
const outputRoot = path.resolve(process.cwd(), process.argv[outputIndex + 1]);
const bundleRoot = path.join(outputRoot, "_expo", "static", "js", "web");
fs.mkdirSync(bundleRoot, { recursive: true });
fs.writeFileSync(path.join(outputRoot, "index.html"), '<html><head></head><body><script src="/_expo/static/js/web/entry-deadbeef1234.js"></script></body></html>');
fs.writeFileSync(path.join(bundleRoot, "entry-deadbeef1234.js"), JSON.stringify({
  buildProfile: process.env.EXPO_PUBLIC_BUILD_PROFILE || null,
  nodeEnv: process.env.NODE_ENV || null,
}));
`,
  );

  if (process.platform === "win32") {
    writeFileSync(
      join(binRoot, "pnpm.cmd"),
      `@echo off\r\n"${process.execPath}" "${fakePnpmScript}" %*\r\n`,
    );
  } else {
    const pnpmPath = join(binRoot, "pnpm");
    writeFileSync(
      pnpmPath,
      `#!/bin/sh\nexec "${process.execPath}" "${fakePnpmScript}" "$@"\n`,
    );
    chmodSync(pnpmPath, 0o755);
  }

  return {
    root,
    mobileRoot: fixtureMobileRoot,
    env: {
      ...process.env,
      PATH: `${binRoot}${delimiter}${process.env.PATH ?? ""}`,
    },
  };
}

function runSmoke(fixture: Fixture, args: string[], env = fixture.env) {
  return spawnSync(
    process.execPath,
    [join(fixture.mobileRoot, "scripts", "smoke-web-export.js"), ...args],
    {
      cwd: fixture.mobileRoot,
      env,
      encoding: "utf8",
    },
  );
}

test("consumer smoke rebuild forces the production channel and records its identity", () => {
  const fixture = createFixture();
  try {
    const result = runSmoke(fixture, ["--consumer"], {
      ...fixture.env,
      EXPO_PUBLIC_BUILD_PROFILE: "internal",
      NODE_ENV: "development",
    });

    assert.equal(result.status, 0, result.stderr);
    const bundle = JSON.parse(
      readFileSync(
        join(
          fixture.mobileRoot,
          ".expo-smoke",
          "_expo",
          "static",
          "js",
          "web",
          "entry-deadbeef1234.js",
        ),
        "utf8",
      ),
    );
    assert.deepEqual(bundle, {
      buildProfile: "production",
      nodeEnv: "production",
    });
    assert.deepEqual(
      JSON.parse(
        readFileSync(
          join(
            fixture.mobileRoot,
            ".expo-smoke",
            "consumer-preview-identity.json",
          ),
          "utf8",
        ),
      ),
      {
        kind: "woofwatcher-consumer-preview",
        buildProfile: "production",
        ownerOpsVisible: false,
      },
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("ordinary smoke keeps its existing profile behavior", () => {
  const fixture = createFixture();
  try {
    const result = runSmoke(fixture, [], {
      ...fixture.env,
      EXPO_PUBLIC_BUILD_PROFILE: "internal",
      NODE_ENV: "development",
    });

    assert.equal(result.status, 0, result.stderr);
    const bundle = JSON.parse(
      readFileSync(
        join(
          fixture.mobileRoot,
          ".expo-smoke",
          "_expo",
          "static",
          "js",
          "web",
          "entry-deadbeef1234.js",
        ),
        "utf8",
      ),
    );
    assert.deepEqual(bundle, {
      buildProfile: "internal",
      nodeEnv: "development",
    });
    assert.equal(
      existsSync(
        join(
          fixture.mobileRoot,
          ".expo-smoke",
          "consumer-preview-identity.json",
        ),
      ),
      false,
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("package commands expose one-step consumer preview without replacing internal smoke", () => {
  const rootPackage = JSON.parse(
    readFileSync(join(repositoryRoot, "package.json"), "utf8"),
  );
  const mobilePackage = JSON.parse(
    readFileSync(join(mobileRoot, "package.json"), "utf8"),
  );

  assert.equal(
    rootPackage.scripts["preview:consumer"],
    "pnpm --filter @workspace/woofwatcher-mobile run preview:consumer",
  );
  assert.equal(
    mobilePackage.scripts["smoke:web"],
    "node scripts/smoke-web-export.js",
  );
  assert.equal(
    mobilePackage.scripts["smoke:web:consumer"],
    "node scripts/smoke-web-export.js --consumer",
  );
  assert.equal(
    mobilePackage.scripts["preview:consumer"],
    "node scripts/consumer-preview.js",
  );
});
