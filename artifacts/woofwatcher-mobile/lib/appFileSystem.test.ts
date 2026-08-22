import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createAppFileSystem,
  type AppFileSystemAdapter,
} from "./appFileSystem.ts";
import { createLocalDataIntentAuthority } from "./localDataIntent.ts";
import type { LocalDataIntent } from "./localDataIntent.ts";
import { createLocalDataResetRuntime } from "./localDataResetRuntime.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createStorageAdapter() {
  return {
    async getItem() { return null; },
    async setItem() {},
    async removeItem() {},
  };
}

function attachAllRequiredNoOps(
  runtime: ReturnType<typeof createLocalDataResetRuntime>,
  overrides: Partial<Record<"avatar" | "care" | "device-preferences" | "files" | "query-cache" | "walk-capture" | "web-runtime", { prepare(): Promise<void>; commit(): Promise<void> }>> = {},
) {
  for (const id of [
    "avatar",
    "care",
    "device-preferences",
    "files",
    "query-cache",
    "walk-capture",
    "web-runtime",
  ] as const) {
    runtime.attachRequiredParticipant(id, overrides[id] ?? {
      prepare: async () => {},
      commit: async () => {},
    });
  }
}

function buildAdapter(
  overrides: Partial<AppFileSystemAdapter> = {},
): AppFileSystemAdapter {
  return {
    platform: "ios",
    documentDirectory: "file:///var/mobile/Documents/",
    async getInfoAsync() { return { exists: true }; },
    async makeDirectoryAsync() {},
    async copyAsync() {},
    async writeAsStringAsync() {},
    async getContentUriAsync(uri) { return `content://${uri}`; },
    async readDirectoryAsync() { return []; },
    async deleteAsync() {},
    ...overrides,
  };
}

test("owned-file reset drains accepted work, deletes the exact inventory, and reports failure", async () => {
  const copy = deferred<void>();
  const deleted: string[] = [];
  const { runtime, fileSystem } = buildHarness(
    buildAdapter({
      async copyAsync() {
        await copy.promise;
      },
      async readDirectoryAsync() {
        return [
          "phoenix-portrait-17.png",
          "avatar-anxious-22.png",
          "private.txt",
          "avatar-sad-23.png",
        ];
      },
      async deleteAsync(uri) {
        deleted.push(uri);
        if (uri.endsWith("WoofWatcherCredentials/")) {
          throw new Error("credentials directory is locked");
        }
      },
    }),
  );
  attachAllRequiredNoOps(runtime, {
    files: fileSystem.localDataResetParticipant,
  });

  const persistence = fileSystem.persistPickedMedia(requireIntent(fileSystem), {
    sourceUri: "file:///var/mobile/Library/Caches/picked.jpg",
  });
  await flush();
  let resetSettled = false;
  const reset = runtime.operations.runReset().then((result) => {
    resetSettled = true;
    return result;
  });
  await flush();
  assert.equal(resetSettled, false);

  copy.resolve();
  await persistence;
  assert.deepEqual(await reset, {
    status: "partial-failure",
    committedParticipantIds: [
      "avatar",
      "care",
      "device-preferences",
      "query-cache",
      "walk-capture",
      "web-runtime",
      "work-drain",
    ],
    failedParticipantIds: ["files"],
  });
  assert.deepEqual(deleted, [
    "file:///var/mobile/Documents/WoofWatcherReports/",
    "file:///var/mobile/Documents/WoofWatcherCredentials/",
    "file:///var/mobile/Documents/woofwatcher-attachments/",
    "file:///var/mobile/Documents/phoenix-portrait-17.png",
    "file:///var/mobile/Documents/avatar-anxious-22.png",
  ]);
});

test("a reconstructed reset runtime retries a partial owned-file deletion to convergence", async () => {
  const remaining = new Set([
    "file:///var/mobile/Documents/WoofWatcherReports/",
    "file:///var/mobile/Documents/WoofWatcherCredentials/",
    "file:///var/mobile/Documents/woofwatcher-attachments/",
    "file:///var/mobile/Documents/avatar-happy-9.png",
  ]);
  let failOnce = true;
  const adapter = buildAdapter({
    async readDirectoryAsync() {
      return remaining.has("file:///var/mobile/Documents/avatar-happy-9.png")
        ? ["avatar-happy-9.png"]
        : [];
    },
    async deleteAsync(uri) {
      if (uri.endsWith("WoofWatcherCredentials/") && failOnce) {
        failOnce = false;
        throw new Error("transient deletion failure");
      }
      remaining.delete(uri);
    },
  });

  const first = buildHarness(adapter);
  attachAllRequiredNoOps(first.runtime, {
    files: first.fileSystem.localDataResetParticipant,
  });
  assert.equal(
    (await first.runtime.operations.runReset()).status,
    "partial-failure",
  );
  assert.deepEqual(
    remaining,
    new Set(["file:///var/mobile/Documents/WoofWatcherCredentials/"]),
  );

  const reconstructed = buildHarness(adapter);
  attachAllRequiredNoOps(reconstructed.runtime, {
    files: reconstructed.fileSystem.localDataResetParticipant,
  });
  assert.equal(
    (await reconstructed.runtime.operations.runReset()).status,
    "complete",
  );
  assert.deepEqual(remaining, new Set());
});

function buildHarness(adapter: AppFileSystemAdapter = buildAdapter()) {
  const runtime = createLocalDataResetRuntime(createStorageAdapter());
  const intentAuthority = createLocalDataIntentAuthority({
    generationAuthority: runtime.generationAuthority,
    isAdmissionOpen: runtime.operations.isWriteAdmissionOpen,
  });
  const fileSystem = createAppFileSystem({
    adapter,
    intentAuthority,
    runTrackedLocalDataWork: runtime.trackedWork.run,
    drainTrackedLocalDataWork: runtime.trackedWork.drain,
  });
  return { runtime, intentAuthority, fileSystem };
}

function requireIntent(fileSystem: ReturnType<typeof buildHarness>["fileSystem"]) {
  const intent = fileSystem.captureIntent();
  assert.ok(intent);
  return intent;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitUntil(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  assert.fail("condition did not become true before the microtask limit");
}

test("inspection maps exists, missing, indeterminate, and failures to tri-state truth", async () => {
  const responses = new Map<string, { exists?: boolean } | Error>([
    ["exists", { exists: true }],
    ["missing", { exists: false }],
    ["indeterminate", {}],
    ["throws", new Error("permission denied")],
  ]);
  const { fileSystem } = buildHarness(buildAdapter({
    async getInfoAsync(uri) {
      const response = responses.get(uri);
      if (response instanceof Error) throw response;
      return response ?? {};
    },
  }));

  assert.equal(await fileSystem.inspect("exists"), "exists");
  assert.equal(await fileSystem.inspect("missing"), "missing");
  assert.equal(await fileSystem.inspect("indeterminate"), "unknown");
  assert.equal(await fileSystem.inspect("throws"), "unknown");
});

test("resolves owned old-container references and exposes only read-only document planning", () => {
  const { fileSystem } = buildHarness();
  assert.equal(
    fileSystem.getDocumentDirectoryForArtifactPlanning(),
    "file:///var/mobile/Documents/",
  );
  assert.equal(
    fileSystem.resolveOwnedDocumentUri(
      "file:///var/mobile/Containers/Data/Application/OLD/Documents/WoofWatcherReports/report.html",
    ),
    "file:///var/mobile/Documents/WoofWatcherReports/report.html",
  );
});

test("artifact planning reports no capability for unsafe document roots", () => {
  for (const documentDirectory of [
    null,
    "file:///",
    "file:////",
    "file:///var//mobile/Documents",
    "content://documents",
    "https://example.test/files",
  ]) {
    const { fileSystem } = buildHarness(buildAdapter({ documentDirectory }));
    assert.equal(
      fileSystem.getDocumentDirectoryForArtifactPlanning(),
      null,
      String(documentDirectory),
    );
  }
});

test("a deferred native copy holds reset work-drain and suppresses its post-reset URI", async () => {
  const copy = deferred<void>();
  const physical: string[] = [];
  const { runtime, fileSystem } = buildHarness(buildAdapter({
    async makeDirectoryAsync() { physical.push("mkdir"); },
    async copyAsync() {
      physical.push("copy:start");
      await copy.promise;
      physical.push("copy:end");
    },
  }));
  attachAllRequiredNoOps(runtime);
  const intent = requireIntent(fileSystem);
  const persistence = fileSystem.persistPickedMedia(intent, {
    sourceUri: "file:///var/mobile/Library/Caches/picked.jpg",
    now: () => 10,
    randomToken: () => "proof",
  });
  await flush();
  assert.deepEqual(physical, ["mkdir", "copy:start"]);

  let resetSettled = false;
  const reset = runtime.operations.runReset().then((result) => {
    resetSettled = true;
    return result;
  });
  await flush();
  assert.equal(resetSettled, false);

  copy.resolve();
  assert.deepEqual(await persistence, {
    ok: false,
    reason: "reset-in-progress",
  });
  assert.equal((await reset).status, "complete");
  assert.deepEqual(physical, ["mkdir", "copy:start", "copy:end"]);
});

test("a picked-media call after admission closes starts zero native work", async () => {
  const prepare = deferred<void>();
  const calls: string[] = [];
  const { runtime, fileSystem } = buildHarness(buildAdapter({
    async makeDirectoryAsync() { calls.push("mkdir"); },
    async copyAsync() { calls.push("copy"); },
  }));
  attachAllRequiredNoOps(runtime, {
    avatar: { prepare: () => prepare.promise, commit: async () => {} },
  });
  const intent = requireIntent(fileSystem);
  const reset = runtime.operations.runReset();

  assert.deepEqual(
    await fileSystem.persistPickedMedia(intent, {
      sourceUri: "file:///var/mobile/Library/Caches/late.jpg",
    }),
    { ok: false, reason: "reset-in-progress" },
  );
  assert.deepEqual(calls, []);
  prepare.resolve();
  await reset;
});

test("forged, foreign-authority, and stale intents start zero file work or callbacks", async () => {
  const calls: string[] = [];
  const first = buildHarness(buildAdapter({
    async makeDirectoryAsync() { calls.push("mkdir"); },
    async copyAsync() { calls.push("copy"); },
    async writeAsStringAsync() { calls.push("write"); },
  }));
  const foreign = buildHarness();
  const stale = requireIntent(first.fileSystem);
  first.runtime.generationAuthority.invalidate();
  const invalidIntents = [
    {} as LocalDataIntent,
    requireIntent(foreign.fileSystem),
    stale,
  ];

  for (const intent of invalidIntents) {
    assert.deepEqual(
      await first.fileSystem.persistPickedMedia(intent, {
        sourceUri: "file:///var/mobile/Library/Caches/picked.jpg",
      }),
      { ok: false, reason: "reset-in-progress" },
    );
    assert.deepEqual(
      await first.fileSystem.runProtectedShare(
        intent,
        {
          destination: "reports",
          fileName: "report.html",
          content: "report",
          encoding: "utf8",
        },
        async () => {
          calls.push("callback");
          return "shared";
        },
      ),
      { status: "revoked" },
    );
  }
  assert.deepEqual(calls, []);

  const retryIntent = requireIntent(first.fileSystem);
  const retry = await first.fileSystem.persistPickedMedia(retryIntent, {
    sourceUri: "file:///var/mobile/Library/Caches/picked.jpg",
    now: () => 55,
    randomToken: () => "fresh",
  });
  assert.equal(retry.ok, true);
  assert.deepEqual(calls, ["mkdir", "copy"]);
});

test("native persistence reports mkdir/copy failure without returning the source and allows a fresh retry", async () => {
  let attempt = 0;
  const { fileSystem } = buildHarness(buildAdapter({
    async makeDirectoryAsync() {
      attempt += 1;
      if (attempt === 1) throw new Error("mkdir denied");
    },
    async copyAsync() {
      if (attempt === 2) throw new Error("copy denied");
    },
  }));
  const sourceUri = "file:///var/mobile/Library/Caches/secret.jpg";

  const mkdirFailure = await fileSystem.persistPickedMedia(
    requireIntent(fileSystem),
    { sourceUri },
  );
  assert.deepEqual(mkdirFailure, { ok: false, reason: "durable-copy-failed" });
  assert.equal(JSON.stringify(mkdirFailure).includes(sourceUri), false);

  const copyFailure = await fileSystem.persistPickedMedia(
    requireIntent(fileSystem),
    { sourceUri },
  );
  assert.deepEqual(copyFailure, { ok: false, reason: "durable-copy-failed" });

  const retry = await fileSystem.persistPickedMedia(
    requireIntent(fileSystem),
    {
      sourceUri,
      now: () => 20,
      randomToken: () => "retry",
    },
  );
  assert.deepEqual(retry, {
    ok: true,
    uri: "file:///var/mobile/Documents/woofwatcher-attachments/attachment_20_retry.jpg",
    storage: "app-document",
  });
});

test("web picked media preserves its reference and starts zero native work", async () => {
  const calls: string[] = [];
  const { fileSystem } = buildHarness(buildAdapter({
    platform: "web",
    documentDirectory: null,
    async makeDirectoryAsync() { calls.push("mkdir"); },
    async copyAsync() { calls.push("copy"); },
  }));

  assert.deepEqual(
    await fileSystem.persistPickedMedia(requireIntent(fileSystem), {
      sourceUri: "blob:https://woofwatcher.test/picked-photo",
    }),
    {
      ok: true,
      uri: "blob:https://woofwatcher.test/picked-photo",
      storage: "web-reference",
    },
  );
  assert.deepEqual(calls, []);
});

test("native picked media reuses only current attachment descendants", async () => {
  const copies: Array<{ from: string; to: string }> = [];
  const { fileSystem } = buildHarness(buildAdapter({
    async copyAsync(options) { copies.push(options); },
  }));
  const currentOwned =
    "file:///var/mobile/Documents/woofwatcher-attachments/already.jpg";
  const otherDocumentChild =
    "file:///var/mobile/Documents/Records/imported.jpg";

  assert.deepEqual(
    await fileSystem.persistPickedMedia(requireIntent(fileSystem), {
      sourceUri: currentOwned,
    }),
    { ok: true, uri: currentOwned, storage: "app-document" },
  );
  const relocated = await fileSystem.persistPickedMedia(
    requireIntent(fileSystem),
    {
      sourceUri: otherDocumentChild,
      now: () => 30,
      randomToken: () => "move",
    },
  );
  assert.equal(relocated.ok, true);
  assert.deepEqual(copies, [{
    from: otherDocumentChild,
    to: "file:///var/mobile/Documents/woofwatcher-attachments/attachment_30_move.jpg",
  }]);
});

test("protected artifacts use exact semantic directories and encodings", async () => {
  const writes: Array<{ uri: string; content: string; encoding: string }> = [];
  const directories: string[] = [];
  const { fileSystem } = buildHarness(buildAdapter({
    async makeDirectoryAsync(uri) { directories.push(uri); },
    async writeAsStringAsync(uri, content, options) {
      writes.push({ uri, content, encoding: options.encoding });
    },
  }));

  const report = await fileSystem.runProtectedShare(
    requireIntent(fileSystem),
    {
      destination: "reports",
      fileName: "Phoenix-Care-Pass.html",
      content: "<html>report</html>",
      encoding: "utf8",
    },
    async (artifact) => artifact,
  );
  const credential = await fileSystem.runProtectedShare(
    requireIntent(fileSystem),
    {
      destination: "credentials",
      fileName: "Phoenix-Dog-ID.png",
      content: "aGVsbG8=",
      encoding: "base64",
    },
    async (artifact) => artifact,
  );

  assert.deepEqual(directories, [
    "file:///var/mobile/Documents/WoofWatcherReports/",
    "file:///var/mobile/Documents/WoofWatcherCredentials/",
  ]);
  assert.deepEqual(writes, [
    {
      uri: "file:///var/mobile/Documents/WoofWatcherReports/Phoenix-Care-Pass.html",
      content: "<html>report</html>",
      encoding: "utf8",
    },
    {
      uri: "file:///var/mobile/Documents/WoofWatcherCredentials/Phoenix-Dog-ID.png",
      content: "aGVsbG8=",
      encoding: "base64",
    },
  ]);
  assert.deepEqual(report, {
    status: "complete",
    value: {
      ok: true,
      fileUri: "file:///var/mobile/Documents/WoofWatcherReports/Phoenix-Care-Pass.html",
      shareUri: "file:///var/mobile/Documents/WoofWatcherReports/Phoenix-Care-Pass.html",
    },
  });
  assert.deepEqual(credential, {
    status: "complete",
    value: {
      ok: true,
      fileUri: "file:///var/mobile/Documents/WoofWatcherCredentials/Phoenix-Dog-ID.png",
      shareUri: "file:///var/mobile/Documents/WoofWatcherCredentials/Phoenix-Dog-ID.png",
    },
  });
});

test("invalid artifact names invoke fallback with zero physical work", async () => {
  const calls: string[] = [];
  const { fileSystem } = buildHarness(buildAdapter({
    async makeDirectoryAsync() { calls.push("mkdir"); },
    async writeAsStringAsync() { calls.push("write"); },
  }));

  for (const fileName of [
    "",
    "   ",
    ".",
    "..",
    "folder/file.html",
    "folder\\file.html",
    "/absolute.html",
    "file:///absolute.html",
    "https://example.test/file.html",
    "%2e%2e.html",
    "report%2fsecret.html",
    "report%2Fsecret.html",
    "report%5csecret.html",
    "report%5Csecret.html",
    "data:text/html,report",
    "foo:bar.html",
    "report.html?download=1",
    "report.html#preview",
    "report\u0000.html",
    "report%20copy.html",
  ]) {
    const callbacks: unknown[] = [];
    const result = await fileSystem.runProtectedShare(
      requireIntent(fileSystem),
      {
        destination: "reports",
        fileName,
        content: "fallback text",
        encoding: "utf8",
      },
      async (artifact) => {
        callbacks.push(artifact);
        return "fallback-copied";
      },
    );
    assert.deepEqual(result, { status: "complete", value: "fallback-copied" });
    assert.deepEqual(callbacks, [{ ok: false, reason: "invalid-target" }]);
  }
  assert.deepEqual(calls, []);
});

test("runtime-forged destinations invoke invalid-target fallback with zero physical work", async () => {
  const calls: string[] = [];
  const { fileSystem } = buildHarness(buildAdapter({
    async makeDirectoryAsync() { calls.push("mkdir"); },
    async writeAsStringAsync() { calls.push("write"); },
  }));
  for (const destination of ["attachments", "other"] as const) {
    const result = await fileSystem.runProtectedShare(
      requireIntent(fileSystem),
      {
        destination: destination as "reports",
        fileName: "report.html",
        content: "report",
        encoding: "utf8",
      },
      async (artifact) => artifact,
    );
    assert.deepEqual(result, {
      status: "complete",
      value: { ok: false, reason: "invalid-target" },
    });
  }
  assert.deepEqual(calls, []);
});

test("runtime-forged file names, content, and encodings invoke invalid-target fallback", async () => {
  const calls: string[] = [];
  const { fileSystem } = buildHarness(buildAdapter({
    async makeDirectoryAsync() { calls.push("mkdir"); },
    async writeAsStringAsync() { calls.push("write"); },
  }));
  const forged = [
    { fileName: 42, content: "report", encoding: "utf8" },
    { fileName: "report.html", content: null, encoding: "utf8" },
    { fileName: "report.html", content: "report", encoding: "binary" },
  ] as const;

  for (const fields of forged) {
    const result = await fileSystem.runProtectedShare(
      requireIntent(fileSystem),
      {
        destination: "reports",
        ...fields,
      } as unknown as {
        destination: "reports";
        fileName: string;
        content: string;
        encoding: "utf8";
      },
      async (artifact) => artifact,
    );
    assert.deepEqual(result, {
      status: "complete",
      value: { ok: false, reason: "invalid-target" },
    });
  }
  assert.deepEqual(calls, []);
});

test("unsupported platform and unavailable storage provide truthful fallback receipts", async () => {
  for (const [adapter, reason] of [
    [buildAdapter({ platform: "web" }), "unsupported-platform"],
    [buildAdapter({ platform: "windows" }), "unsupported-platform"],
    [buildAdapter({ documentDirectory: null }), "storage-unavailable"],
    [buildAdapter({ documentDirectory: "content://documents" }), "storage-unavailable"],
    [buildAdapter({ documentDirectory: "https://example.test/files" }), "storage-unavailable"],
    [buildAdapter({ documentDirectory: "file:///" }), "storage-unavailable"],
    [buildAdapter({ documentDirectory: "file:////" }), "storage-unavailable"],
    [buildAdapter({ documentDirectory: "file:///var//mobile/Documents" }), "storage-unavailable"],
    [buildAdapter({ documentDirectory: " file:///var/mobile/Documents" }), "storage-unavailable"],
    [buildAdapter({ documentDirectory: "file:///var/mobile/Documents/ " }), "storage-unavailable"],
  ] as const) {
    const { fileSystem } = buildHarness(adapter);
    const result = await fileSystem.runProtectedShare(
      requireIntent(fileSystem),
      {
        destination: "reports",
        fileName: "report.html",
        content: "fallback",
        encoding: "utf8",
      },
      async (artifact) => artifact,
    );
    assert.deepEqual(result, {
      status: "complete",
      value: { ok: false, reason },
    });
  }
});

test("Android content conversion failure falls back to the written file URI", async () => {
  const { fileSystem } = buildHarness(buildAdapter({
    platform: "android",
    async getContentUriAsync() { throw new Error("provider unavailable"); },
  }));

  const result = await fileSystem.runProtectedShare(
    requireIntent(fileSystem),
    {
      destination: "credentials",
      fileName: "dog-id.svg",
      content: "<svg />",
      encoding: "utf8",
    },
    async (artifact) => artifact,
  );
  assert.deepEqual(result, {
    status: "complete",
    value: {
      ok: true,
      fileUri: "file:///var/mobile/Documents/WoofWatcherCredentials/dog-id.svg",
      shareUri: "file:///var/mobile/Documents/WoofWatcherCredentials/dog-id.svg",
    },
  });
});

test("write failure invokes fallback with a write-failed receipt", async () => {
  const { fileSystem } = buildHarness(buildAdapter({
    async writeAsStringAsync() { throw new Error("disk full"); },
  }));
  const receipts: unknown[] = [];
  const result = await fileSystem.runProtectedShare(
    requireIntent(fileSystem),
    {
      destination: "reports",
      fileName: "report.html",
      content: "report",
      encoding: "utf8",
    },
    async (artifact) => {
      receipts.push(artifact);
      return "copied text instead";
    },
  );

  assert.deepEqual(receipts, [{ ok: false, reason: "write-failed" }]);
  assert.deepEqual(result, {
    status: "complete",
    value: "copied text instead",
  });
});

test("same-target shares serialize through the full callback while different targets run concurrently", async () => {
  const callbacks = new Map<string, ReturnType<typeof deferred<void>>>();
  const events: string[] = [];
  const { fileSystem } = buildHarness(buildAdapter({
    async writeAsStringAsync(uri) { events.push(`write:${uri}`); },
  }));
  const run = (fileName: string) => fileSystem.runProtectedShare(
    requireIntent(fileSystem),
    {
      destination: "reports",
      fileName,
      content: fileName,
      encoding: "utf8",
    },
    async () => {
      events.push(`callback:start:${fileName}`);
      const wait = deferred<void>();
      callbacks.set(fileName, wait);
      await wait.promise;
      events.push(`callback:end:${fileName}`);
      return fileName;
    },
  );

  const first = run("same.html");
  await flush();
  const second = run("same.html");
  const different = run("different.html");
  await waitUntil(() => events.includes("callback:start:different.html"));

  assert.equal(
    events.filter(
      (event) =>
        event.includes("write:") &&
        event.endsWith("/same.html"),
    ).length,
    1,
    JSON.stringify(events),
  );
  assert.equal(events.includes("callback:start:different.html"), true);
  callbacks.get("different.html")?.resolve();
  callbacks.get("same.html")?.resolve();
  await first;
  await different;
  await flush();

  assert.equal(
    events.filter(
      (event) =>
        event.includes("write:") &&
        event.endsWith("/same.html"),
    ).length,
    2,
    JSON.stringify(events),
  );
  callbacks.get("same.html")?.resolve();
  await second;
});

test("a failed same-target lane releases the next accepted share", async () => {
  let writes = 0;
  const { fileSystem } = buildHarness(buildAdapter({
    async writeAsStringAsync() {
      writes += 1;
      if (writes === 1) throw new Error("first write failed");
    },
  }));
  const input = {
    destination: "reports" as const,
    fileName: "same.html",
    content: "report",
    encoding: "utf8" as const,
  };

  const first = fileSystem.runProtectedShare(
    requireIntent(fileSystem),
    input,
    async () => { throw new Error("fallback failed too"); },
  );
  const second = fileSystem.runProtectedShare(
    requireIntent(fileSystem),
    input,
    async (artifact) => artifact,
  );

  await assert.rejects(first, /fallback failed too/);
  assert.deepEqual(await second, {
    status: "complete",
    value: {
      ok: true,
      fileUri: "file:///var/mobile/Documents/WoofWatcherReports/same.html",
      shareUri: "file:///var/mobile/Documents/WoofWatcherReports/same.html",
    },
  });
  assert.equal(writes, 2);
});

test("reset drains both active and queued accepted shares and suppresses queued work", async () => {
  const callback = deferred<void>();
  const events: string[] = [];
  const { runtime, fileSystem } = buildHarness(buildAdapter({
    async writeAsStringAsync() { events.push("write"); },
  }));
  attachAllRequiredNoOps(runtime);
  const input = {
    destination: "reports" as const,
    fileName: "same.html",
    content: "report",
    encoding: "utf8" as const,
  };
  const first = fileSystem.runProtectedShare(
    requireIntent(fileSystem),
    input,
    async () => {
      events.push("callback:start");
      await callback.promise;
      events.push("callback:end");
      return "first";
    },
  );
  await flush();
  const second = fileSystem.runProtectedShare(
    requireIntent(fileSystem),
    input,
    async () => {
      events.push("callback:second");
      return "second";
    },
  );
  await flush();
  let resetSettled = false;
  const reset = runtime.operations.runReset().then((value) => {
    resetSettled = true;
    return value;
  });
  await flush();
  assert.equal(resetSettled, false);

  callback.resolve();
  assert.deepEqual(await first, { status: "revoked" });
  assert.deepEqual(await second, { status: "revoked" });
  assert.equal((await reset).status, "complete");
  assert.deepEqual(events, ["write", "callback:start", "callback:end"]);
});

test("reset during awaited mkdir suppresses every later write and callback", async () => {
  const mkdir = deferred<void>();
  const events: string[] = [];
  const { runtime, fileSystem } = buildHarness(buildAdapter({
    async makeDirectoryAsync() {
      events.push("mkdir:start");
      await mkdir.promise;
      events.push("mkdir:end");
    },
    async writeAsStringAsync() { events.push("write"); },
  }));
  attachAllRequiredNoOps(runtime);
  const operation = fileSystem.runProtectedShare(
    requireIntent(fileSystem),
    {
      destination: "reports",
      fileName: "report.html",
      content: "report",
      encoding: "utf8",
    },
    async () => {
      events.push("callback");
      return "shared";
    },
  );
  await waitUntil(() => events.includes("mkdir:start"));
  const reset = runtime.operations.runReset();
  mkdir.resolve();

  assert.deepEqual(await operation, { status: "revoked" });
  await reset;
  assert.deepEqual(events, ["mkdir:start", "mkdir:end"]);
});

test("reset during awaited write suppresses Android conversion and callback", async () => {
  const write = deferred<void>();
  const events: string[] = [];
  const { runtime, fileSystem } = buildHarness(buildAdapter({
    platform: "android",
    async writeAsStringAsync() {
      events.push("write:start");
      await write.promise;
      events.push("write:end");
    },
    async getContentUriAsync() {
      events.push("content-uri");
      return "content://report";
    },
  }));
  attachAllRequiredNoOps(runtime);
  const operation = fileSystem.runProtectedShare(
    requireIntent(fileSystem),
    {
      destination: "reports",
      fileName: "report.html",
      content: "report",
      encoding: "utf8",
    },
    async () => {
      events.push("callback");
      return "shared";
    },
  );
  await waitUntil(() => events.includes("write:start"));
  const reset = runtime.operations.runReset();
  write.resolve();

  assert.deepEqual(await operation, { status: "revoked" });
  await reset;
  assert.deepEqual(events, ["write:start", "write:end"]);
});

test("reset during awaited Android content conversion suppresses the callback", async () => {
  const conversion = deferred<string>();
  const events: string[] = [];
  const { runtime, fileSystem } = buildHarness(buildAdapter({
    platform: "android",
    async writeAsStringAsync() { events.push("write"); },
    async getContentUriAsync() {
      events.push("content:start");
      const value = await conversion.promise;
      events.push("content:end");
      return value;
    },
  }));
  attachAllRequiredNoOps(runtime);
  const operation = fileSystem.runProtectedShare(
    requireIntent(fileSystem),
    {
      destination: "credentials",
      fileName: "dog-id.svg",
      content: "<svg />",
      encoding: "utf8",
    },
    async () => {
      events.push("callback");
      return "shared";
    },
  );
  await waitUntil(() => events.includes("content:start"));
  const reset = runtime.operations.runReset();
  conversion.resolve("content://dog-id");

  assert.deepEqual(await operation, { status: "revoked" });
  await reset;
  assert.deepEqual(events, ["write", "content:start", "content:end"]);
});
