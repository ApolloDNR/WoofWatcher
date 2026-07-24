#!/usr/bin/env node
import http from "node:http";
import { spawn } from "node:child_process";
import {
  terminateChild,
  waitForChildOrInterrupt,
} from "./e2e-process-lifecycle.mjs";

const port = Number(process.env.E2E_PORT ?? 4194);
const baseUrl = `http://127.0.0.1:${port}`;
const children = new Set();
let interruptedSignal = null;
let resolveInterrupt;
const interruptPromise = new Promise((resolve) => {
  resolveInterrupt = resolve;
});
const useProcessGroup = process.platform !== "win32";

function requestReady() {
  return new Promise((resolve) => {
    const request = http.get(baseUrl, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.setTimeout(1_000, () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

async function waitForReady(server) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error(
        `Smoke preview exited before readiness (code ${server.exitCode ?? "none"}, signal ${server.signalCode ?? "none"}).`,
      );
    }
    if (await requestReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Smoke preview was not ready at ${baseUrl} within 30 seconds.`);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    if (interruptedSignal) return;
    interruptedSignal = signal;
    resolveInterrupt(signal);
  });
}

let server;
let workflow;
let exitCode = 1;
try {
  server = spawn(
    process.execPath,
    ["scripts/serve-smoke-preview.js", String(port)],
    {
      cwd: new URL("..", import.meta.url),
      env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
      stdio: ["ignore", "inherit", "inherit"],
    },
  );
  children.add(server);
  const readiness = await Promise.race([
    waitForReady(server).then(() => null),
    interruptPromise,
  ]);
  if (readiness) throw new Error(`Interrupted by ${readiness}`);

  workflow = spawn(process.execPath, ["scripts/e2e-web-workflows.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, BASE_URL: baseUrl },
    stdio: "inherit",
    detached: useProcessGroup,
  });
  children.add(workflow);
  const result = await waitForChildOrInterrupt(workflow, interruptPromise);
  exitCode =
    result.interrupted && result.signal === "SIGINT"
      ? 130
      : result.interrupted && result.signal === "SIGTERM"
        ? 143
        : (result.code ?? 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  exitCode =
    interruptedSignal === "SIGINT"
      ? 130
      : interruptedSignal === "SIGTERM"
        ? 143
        : 1;
} finally {
  await terminateChild(workflow, { processGroup: true });
  await terminateChild(server);
}

process.exit(exitCode);
