import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { EventEmitter } from "node:events";

const source = readFileSync(
  join(
    process.cwd(),
    "artifacts",
    "woofwatcher-mobile",
    "scripts",
    "e2e-web-workflows.mjs",
  ),
  "utf8",
);
const runner = readFileSync(
  join(
    process.cwd(),
    "artifacts",
    "woofwatcher-mobile",
    "scripts",
    "run-e2e-web-workflows.mjs",
  ),
  "utf8",
);
const lifecycleSource = readFileSync(
  join(
    process.cwd(),
    "artifacts",
    "woofwatcher-mobile",
    "scripts",
    "e2e-process-lifecycle.mjs",
  ),
  "utf8",
);
const mobilePackage = JSON.parse(
  readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "package.json",
    ),
    "utf8",
  ),
);
const workspaceLock = readFileSync(
  join(process.cwd(), "pnpm-lock.yaml"),
  "utf8",
);
const workflow = readFileSync(
  join(process.cwd(), ".github", "workflows", "verify.yml"),
  "utf8",
);

test("drives the served URL and current five-destination shell", () => {
  assert.match(
    source,
    /process\.env\.BASE_URL\s*\?\?\s*"http:\/\/127\.0\.0\.1:4194"/,
  );
  assert.match(
    source,
    /\["Today", "Plan", "Quick Log", "Health", "More"\]/,
  );
  assert.match(
    source,
    /getByLabel\(label,\s*\{\s*exact:\s*true\s*\}\)/,
  );
  assert.match(source, /await go\("\/fastlog"\)/);
});

test("proves Quick Log mutations against persisted care row identities", () => {
  assert.match(source, /persistedCareEntrySnapshot/);
  assert.match(source, /hasExactlyOneNewEntry/);
  assert.match(source, /sameEntrySnapshot/);
  assert.match(source, /persists exactly one new care row/);
  assert.match(source, /rapid meal duplicate creates no additional persisted care row/);
  assert.match(source, /Undo removes the persisted meal before recreation/);
  assert.match(source, /meal recreation persists one new row after Undo/);
  assert.match(source, /aria-label="Undo Meal"/);
  assert.doesNotMatch(source, /Undo Meal quick log/);
});

test("proves active-walk reuse and medication detail-first routing", () => {
  assert.match(source, /active walk reuses the existing active-walk flow/);
  assert.match(source, /active walk reuse creates no additional persisted care row/);
  assert.match(source, /\/\\\/log\\\?entry=\//);
  assert.doesNotMatch(source, /walk=finish/);
  assert.match(source, /medication opens details before saving/);
  assert.match(source, /medication detail-first route creates no care row before save/);
  assert.match(source, /clickLabel\("Add Meds details"\)/);
  assert.match(source, /\/\\\/log\\\?type=medication&detail=1&intent=\//);
});

test("pins Playwright and wires a deterministic fail-closed CI gate", () => {
  assert.equal(mobilePackage.devDependencies.playwright, "1.55.0");
  assert.equal(
    mobilePackage.scripts["e2e:web"],
    "node scripts/run-e2e-web-workflows.mjs",
  );
  assert.match(workspaceLock, /playwright:\n\s+specifier: 1\.55\.0\n\s+version: 1\.55\.0/);
  assert.match(workflow, /pnpm exec playwright install --with-deps chromium/);
  assert.match(
    workflow,
    /pnpm --filter @workspace\/woofwatcher-mobile run e2e:web/,
  );
  assert.match(runner, /serve-smoke-preview\.js/);
  assert.match(runner, /e2e-web-workflows\.mjs/);
  assert.match(runner, /finally/);
  assert.match(runner, /terminateChild\(workflow,\s*\{\s*processGroup:\s*true\s*\}\)/);
  assert.match(runner, /terminateChild\(server\)/);
  assert.match(runner, /waitForChildOrInterrupt/);
  assert.match(runner, /detached:/);
  assert.match(runner, /processGroup:\s*true/);
  assert.match(lifecycleSource, /SIGTERM/);
  assert.match(lifecycleSource, /SIGKILL/);
});

test("fails the workflow on browser errors and error-boundary-like route content", () => {
  assert.match(source, /console error \[/i);
  assert.match(source, /page error \[/i);
  assert.match(source, /errorsByStep/);
  assert.match(source, /error boundary|something went wrong|unexpected error/i);
  assert.match(source, /exitCode = failed\.length \? 1 : 0/);
  assert.match(source, /process\.exit\(exitCode\)/);
});

test("uses route-specific markers and proves persisted rows are wiped", () => {
  assert.match(source, /ROUTE_EXPECTATIONS/);
  assert.match(source, /PRIMARY_NAVIGATION_MARKERS/);
  assert.match(source, /assertPrimaryDestination/);
  assert.match(source, /WELCOME TO WOOFWATCHER/);
  assert.match(source, /MISSION SCHEDULE/);
  assert.match(source, /What would you like/);
  assert.match(source, /Owner notes\. No diagnosis\./);
  assert.match(source, /Command Directory/);
  assert.doesNotMatch(source, /text\.trim\(\)\.length\s*>\s*40/);
  assert.match(source, /persisted rows exist before delete-all/i);
  assert.match(source, /delete-all clears every persisted care row/i);
  assert.match(source, /Array\.isArray\(afterDeleteSnapshot\)/);
  assert.match(source, /afterDeleteSnapshot\.length\s*===\s*0/);
});

test("runner termination waits for graceful exit and escalates when needed", async () => {
  const { terminateChild, waitForChildOrInterrupt } = await import(
    "../scripts/e2e-process-lifecycle.mjs"
  );

  class FakeChild extends EventEmitter {
    exitCode: number | null = null;
    signalCode: NodeJS.Signals | null = null;
    signals: NodeJS.Signals[] = [];
    exitOnTerm = true;

    kill(signal: NodeJS.Signals) {
      this.signals.push(signal);
      if (signal === "SIGKILL" || this.exitOnTerm) {
        queueMicrotask(() => {
          this.signalCode = signal;
          this.emit("exit", null, signal);
        });
      }
      return true;
    }
  }

  const graceful = new FakeChild();
  await terminateChild(graceful, { timeoutMs: 10 });
  assert.deepEqual(graceful.signals, ["SIGTERM"]);

  const stubborn = new FakeChild();
  stubborn.exitOnTerm = false;
  await terminateChild(stubborn, { timeoutMs: 1 });
  assert.deepEqual(stubborn.signals, ["SIGTERM", "SIGKILL"]);

  const neverExits = new FakeChild();
  neverExits.exitOnTerm = false;
  const raced = await waitForChildOrInterrupt(
    neverExits,
    Promise.resolve("SIGINT"),
  );
  assert.deepEqual(raced, { interrupted: true, signal: "SIGINT" });
  await terminateChild(neverExits, { timeoutMs: 1 });
  assert.deepEqual(neverExits.signals, ["SIGTERM", "SIGKILL"]);
});

test("process-group termination escalates when the leader exits but descendants remain", async () => {
  const { terminateChild } = await import(
    "../scripts/e2e-process-lifecycle.mjs"
  );
  const leader = new EventEmitter() as EventEmitter & {
    exitCode: number | null;
    signalCode: NodeJS.Signals | null;
    pid: number;
    kill: (signal: NodeJS.Signals) => boolean;
  };
  leader.exitCode = null;
  leader.signalCode = null;
  leader.pid = 4242;
  leader.kill = () => {
    throw new Error("process-group cleanup must not signal only the leader");
  };

  let groupAlive = true;
  const groupSignals: Array<NodeJS.Signals | 0> = [];
  const killProcess = (pid: number, signal: NodeJS.Signals | 0) => {
    assert.equal(pid, -leader.pid);
    groupSignals.push(signal);
    if (signal === 0) {
      if (!groupAlive) {
        const error = new Error("group gone") as NodeJS.ErrnoException;
        error.code = "ESRCH";
        throw error;
      }
      return true;
    }
    if (signal === "SIGTERM") {
      queueMicrotask(() => {
        leader.signalCode = signal;
        leader.emit("exit", null, signal);
      });
    }
    if (signal === "SIGKILL") groupAlive = false;
    return true;
  };

  await terminateChild(leader, {
    processGroup: true,
    timeoutMs: 1,
    killProcess,
  });

  assert.deepEqual(
    groupSignals.filter((signal) => signal !== 0),
    ["SIGTERM", "SIGKILL"],
  );
  assert.equal(groupAlive, false);
});

test("process-group termination probes an already-gone group without signaling it", async () => {
  const { terminateChild } = await import(
    "../scripts/e2e-process-lifecycle.mjs"
  );
  const leader = {
    exitCode: 0,
    signalCode: null,
    pid: 4343,
    kill() {
      throw new Error("an already-gone group must remain a no-op");
    },
  };
  const groupSignals: Array<NodeJS.Signals | 0> = [];
  const killProcess = (pid: number, signal: NodeJS.Signals | 0) => {
    assert.equal(pid, -leader.pid);
    groupSignals.push(signal);
    const error = new Error("group gone") as NodeJS.ErrnoException;
    error.code = "ESRCH";
    throw error;
  };

  await terminateChild(leader, {
    processGroup: true,
    timeoutMs: 1,
    killProcess,
  });

  assert.deepEqual(groupSignals, [0]);
});
