import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  resolvePreviewBuildCommand,
  resolvePreviewRuntime,
  resolvePreviewServerCommand,
  startPreviewServer,
} from "../../../scripts/preview-runtime.mjs";

test("uses the managed preview host and port flags", () => {
  assert.deepEqual(
    resolvePreviewRuntime(
      ["--host", "0.0.0.0", "--port", "4173", "--strictPort"],
      {},
    ),
    { host: "0.0.0.0", port: 4173 },
  );
});

test("explicit managed preview flags override inherited host and port values", () => {
  assert.deepEqual(
    resolvePreviewRuntime(["--host", "0.0.0.0", "--port", "4173"], {
      HOST: "127.0.0.1",
      PORT: "4194",
    }),
    { host: "0.0.0.0", port: 4173 },
  );
});

test("the managed dev entry always rebuilds the current source", () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
  );

  assert.equal(
    packageJson.scripts.dev,
    "node scripts/replit-preview.mjs --rebuild",
  );
});

test("rebuilds through Corepack without an interactive package-manager shim", () => {
  assert.deepEqual(resolvePreviewBuildCommand({ platform: "linux" }), {
    command: "corepack",
    args: [
      "pnpm",
      "--filter",
      "@workspace/woofwatcher-mobile",
      "run",
      "smoke:web",
    ],
  });
});

test("serves the prepared export without invoking a package manager", () => {
  assert.deepEqual(
    resolvePreviewServerCommand({
      repoRoot: "/repo",
      execPath: "/node",
      runtime: { host: "0.0.0.0", port: 4173 },
      env: { CI: "1" },
    }),
    {
      command: "/node",
      args: [
        join(
          "/repo",
          "artifacts",
          "woofwatcher-mobile",
          "scripts",
          "serve-smoke-preview.js",
        ),
      ],
      env: { CI: "1", HOST: "0.0.0.0", PORT: "4173" },
    },
  );
});

test("the preview wrapper forwards termination and removes its listeners", async () => {
  const processRef = new EventEmitter();
  const child = new EventEmitter();
  const forwardedSignals = [];
  child.kill = (signal) => {
    forwardedSignals.push(signal);
    return true;
  };

  const completion = startPreviewServer({
    command: "/node",
    args: ["server.js"],
    cwd: "/repo",
    env: { PORT: "4173" },
    processRef,
    spawnImpl: (command, args, options) => {
      assert.equal(command, "/node");
      assert.deepEqual(args, ["server.js"]);
      assert.deepEqual(options, {
        cwd: "/repo",
        env: { PORT: "4173" },
        stdio: "inherit",
      });
      return child;
    },
  });

  processRef.emit("SIGTERM");
  assert.deepEqual(forwardedSignals, ["SIGTERM"]);
  child.emit("exit", null, "SIGTERM");

  assert.deepEqual(await completion, { code: null, signal: "SIGTERM" });
  assert.equal(processRef.listenerCount("SIGINT"), 0);
  assert.equal(processRef.listenerCount("SIGTERM"), 0);
});
