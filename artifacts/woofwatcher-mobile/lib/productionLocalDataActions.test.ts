import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createAppFileSystem,
  type AppFileSystemAdapter,
} from "./appFileSystem.ts";
import { createLocalDataIntentAuthority } from "./localDataIntent.ts";
import {
  createLocalDataResetRuntime,
  REQUIRED_LOCAL_DATA_PARTICIPANT_IDS,
  type LocalDataResetRuntime,
} from "./localDataResetRuntime.ts";
import {
  PickedMediaLocalDataActionError,
  runMedicationProofPhotoPicker,
  runQaScreenshotPicker,
  runRecordAttachmentPicker,
} from "./pickedMediaLocalDataActions.ts";
import {
  runGeneratedRecordsFileShare,
  runPrintableRecordsFileShare,
} from "./recordsFileShareActions.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function storageAdapter() {
  return {
    async getItem() {
      return null;
    },
    async setItem() {},
    async removeItem() {},
  };
}

function buildAdapter(
  overrides: Partial<AppFileSystemAdapter> = {},
): AppFileSystemAdapter {
  return {
    platform: "android",
    documentDirectory: "file:///documents/",
    cacheDirectory: "file:///cache/",
    async getInfoAsync(uri) {
      return { exists: true, isDirectory: uri.endsWith("/") };
    },
    async makeDirectoryAsync() {},
    async copyAsync() {},
    async writeAsStringAsync() {},
    async getContentUriAsync(uri) {
      return `content://${uri}`;
    },
    async readDirectoryAsync() {
      return [];
    },
    async deleteAsync() {},
    async clearImageMemoryCache() {
      return true;
    },
    async clearImageDiskCache() {
      return true;
    },
    ...overrides,
  };
}

function attachOwners(
  runtime: LocalDataResetRuntime,
  files: ReturnType<typeof createAppFileSystem>,
) {
  for (const id of REQUIRED_LOCAL_DATA_PARTICIPANT_IDS) {
    runtime.attachRequiredParticipant(
      id,
      id === "files"
        ? files.localDataResetParticipant
        : { prepare: async () => {}, commit: async () => {} },
    );
  }
}

function harness(adapter: AppFileSystemAdapter) {
  const runtime = createLocalDataResetRuntime(storageAdapter());
  const appFileSystem = createAppFileSystem({
    adapter,
    intentAuthority: createLocalDataIntentAuthority({
      generationAuthority: runtime.generationAuthority,
      isAdmissionOpen: runtime.operations.isWriteAdmissionOpen,
    }),
    runTrackedLocalDataWork: runtime.trackedWork.run,
    drainTrackedLocalDataWork: runtime.trackedWork.drain,
  });
  attachOwners(runtime, appFileSystem);
  return { runtime, appFileSystem };
}

async function waitUntil(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  assert.fail("condition did not become true before the microtask limit");
}

async function flushMicrotasks(count = 100) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

const pickedAsset = {
  canceled: false as const,
  assets: [
    {
      uri: "file:///picker/cache/proof.jpg",
      fileName: "proof.jpg",
      mimeType: "image/jpeg",
    },
  ],
};

for (const [label, runPicker] of [
  ["Records attachment", runRecordAttachmentPicker],
  ["Log medication proof", runMedicationProofPhotoPicker],
  ["QA screenshot", runQaScreenshotPicker],
] as const) {
  test(`${label} drains the native picker and deletes cache it creates after reset starts`, async () => {
    const picker = deferred<void>();
    const pickerCacheUri = "file:///cache/ImagePicker/proof.jpg";
    const files = new Set<string>();
    const events: string[] = [];
    const { runtime, appFileSystem } = harness(
      buildAdapter({
        async makeDirectoryAsync() {
          events.push("mkdir");
        },
        async copyAsync() {
          events.push("copy");
        },
        async deleteAsync(uri) {
          events.push(`delete:${uri}`);
          for (const file of [...files]) {
            if (file.startsWith(uri)) files.delete(file);
          }
        },
      }),
    );

    const action = runPicker({
      appFileSystem,
      pick: async () => {
        events.push("picker:start");
        await picker.promise;
        files.add(pickerCacheUri);
        events.push("picker:end");
        return {
          ...pickedAsset,
          assets: [{ ...pickedAsset.assets[0], uri: pickerCacheUri }],
        };
      },
      apply: () => {
        events.push("apply");
      },
    });
    await waitUntil(() => events.includes("picker:start"));
    let resetSettled = false;
    const reset = runtime.operations.runReset().then((result) => {
      resetSettled = true;
      return result;
    });
    await flushMicrotasks();
    assert.equal(resetSettled, false);
    assert.equal(
      events.includes("delete:file:///cache/ImagePicker/"),
      false,
      "file-owner commit must wait until the native picker has settled",
    );

    picker.resolve();

    assert.deepEqual(await action, { status: "revoked" });
    assert.equal((await reset).status, "complete");
    assert.equal(files.size, 0);
    assert.equal(events.includes("copy"), false);
    assert.equal(events.includes("apply"), false);
    assert.ok(
      events.indexOf("picker:end") <
        events.indexOf("delete:file:///cache/ImagePicker/"),
    );
  });

  test(`${label} drains an accepted real copy, deletes it, and suppresses stale UI/care apply`, async () => {
    const copy = deferred<void>();
    const files = new Set<string>();
    const events: string[] = [];
    const { runtime, appFileSystem } = harness(
      buildAdapter({
        async copyAsync({ to }) {
          events.push("copy:start");
          await copy.promise;
          files.add(to);
          events.push("copy:end");
        },
        async deleteAsync(uri) {
          for (const file of [...files]) {
            if (file.startsWith(uri)) files.delete(file);
          }
        },
      }),
    );

    const action = runPicker({
      appFileSystem,
      pick: async () => pickedAsset,
      apply: () => {
        events.push("apply");
      },
    });
    await waitUntil(() => events.includes("copy:start"));
    let resetSettled = false;
    const reset = runtime.operations.runReset().then((result) => {
      resetSettled = true;
      return result;
    });
    await Promise.resolve();
    assert.equal(resetSettled, false);

    copy.resolve();
    assert.deepEqual(await action, { status: "revoked" });
    assert.equal((await reset).status, "complete");
    assert.deepEqual(events, ["copy:start", "copy:end"]);
    assert.deepEqual(files, new Set());
  });
}

test("Avatar permission prompt is drained and cannot launch a picker after reset begins", async () => {
  const permission = deferred<void>();
  const events: string[] = [];
  const { runtime, appFileSystem } = harness(buildAdapter());
  const intent = appFileSystem.captureIntent();
  assert.ok(intent);

  const interaction = appFileSystem.runProtectedPicker(intent, async () => {
    events.push("permission:start");
    await permission.promise;
    events.push("permission:end");
    if (!appFileSystem.isIntentCurrent(intent)) return null;
    events.push("picker:launch");
    return pickedAsset;
  });
  await waitUntil(() => events.includes("permission:start"));
  let resetSettled = false;
  const reset = runtime.operations.runReset().then((result) => {
    resetSettled = true;
    return result;
  });
  await flushMicrotasks();
  assert.equal(resetSettled, false);

  permission.resolve();

  assert.deepEqual(await interaction, { status: "revoked" });
  assert.equal((await reset).status, "complete");
  assert.deepEqual(events, ["permission:start", "permission:end"]);
});

test("Avatar picker cache created after reset starts is drained and deleted before completion", async () => {
  const picker = deferred<void>();
  const pickerCacheUri = "file:///cache/ImagePicker/avatar.jpg";
  const files = new Set<string>();
  const events: string[] = [];
  const { runtime, appFileSystem } = harness(
    buildAdapter({
      async deleteAsync(uri) {
        events.push(`delete:${uri}`);
        for (const file of [...files]) {
          if (file.startsWith(uri)) files.delete(file);
        }
      },
    }),
  );
  const intent = appFileSystem.captureIntent();
  assert.ok(intent);
  const interaction = appFileSystem.runProtectedPicker(intent, async () => {
    events.push("picker:start");
    await picker.promise;
    files.add(pickerCacheUri);
    events.push("picker:end");
    return pickedAsset;
  });
  await waitUntil(() => events.includes("picker:start"));
  let resetSettled = false;
  const reset = runtime.operations.runReset().then((result) => {
    resetSettled = true;
    return result;
  });
  await flushMicrotasks();
  assert.equal(resetSettled, false);
  assert.equal(
    events.includes("delete:file:///cache/ImagePicker/"),
    false,
  );

  picker.resolve();

  assert.deepEqual(await interaction, { status: "revoked" });
  assert.equal((await reset).status, "complete");
  assert.equal(files.size, 0);
  assert.ok(
    events.indexOf("picker:end") <
      events.indexOf("delete:file:///cache/ImagePicker/"),
  );
});

test("a rejected picker apply deletes the new durable copy and picker cache while preserving the committed original", async () => {
  const copied: string[] = [];
  const deleted: string[] = [];
  const previousUri =
    "file:///documents/woofwatcher-attachments/committed.jpg";
  const pickerSourceUri = "file:///cache/ImagePicker/rejected-proof.jpg";
  const { appFileSystem } = harness(
    buildAdapter({
      async copyAsync({ to }) {
        copied.push(to);
      },
      async deleteAsync(uri) {
        deleted.push(uri);
      },
    }),
  );

  const action = await runMedicationProofPhotoPicker({
    appFileSystem,
    pick: async () => ({
      ...pickedAsset,
      assets: [{ ...pickedAsset.assets[0], uri: pickerSourceUri }],
    }),
    preserveUris: [previousUri],
    apply: () => false,
  });

  assert.equal(copied.length, 1);
  assert.deepEqual(action, { status: "rejected", cleanupFailed: false });
  assert.deepEqual(deleted, [copied[0], pickerSourceUri]);
  assert.equal(deleted.includes(previousUri), false);
});

test("a throwing picker apply releases both the durable copy and picker cache before surfacing the error", async () => {
  const copied: string[] = [];
  const deleted: string[] = [];
  const pickerSourceUri = "file:///cache/ImagePicker/throwing-proof.jpg";
  const { appFileSystem } = harness(
    buildAdapter({
      async copyAsync({ to }) {
        copied.push(to);
      },
      async deleteAsync(uri) {
        deleted.push(uri);
      },
    }),
  );

  await assert.rejects(
    runRecordAttachmentPicker({
      appFileSystem,
      pick: async () => ({
        ...pickedAsset,
        assets: [{ ...pickedAsset.assets[0], uri: pickerSourceUri }],
      }),
      apply: () => {
        throw new Error("metadata persistence denied");
      },
    }),
    /metadata persistence denied/,
  );

  assert.equal(copied.length, 1);
  assert.deepEqual(deleted, [copied[0], pickerSourceUri]);
});

test("a picker copies an already-owned shared source before rejection so cleanup cannot delete the original", async () => {
  const sharedUri =
    "file:///documents/woofwatcher-attachments/shared-original.jpg";
  const copied: Array<{ from: string; to: string }> = [];
  const deleted: string[] = [];
  const { appFileSystem } = harness(
    buildAdapter({
      async copyAsync(input) {
        copied.push(input);
      },
      async deleteAsync(uri) {
        deleted.push(uri);
      },
    }),
  );

  const action = await runMedicationProofPhotoPicker({
    appFileSystem,
    pick: async () => ({
      canceled: false,
      assets: [{ ...pickedAsset.assets[0], uri: sharedUri }],
    }),
    preserveUris: [sharedUri],
    apply: () => false,
  });

  assert.deepEqual(action, { status: "rejected", cleanupFailed: false });
  assert.equal(copied.length, 1);
  assert.equal(copied[0]?.from, sharedUri);
  assert.notEqual(copied[0]?.to, sharedUri);
  assert.deepEqual(deleted, [copied[0]?.to]);
  assert.equal(deleted.includes(sharedUri), false);
});

test("replacement protection is failure-only so rejection keeps the old proof but acceptance releases it", async () => {
  const previousUri =
    "file:///documents/woofwatcher-attachments/previous-proof.jpg";

  for (const accepted of [false, true]) {
    const copied: string[] = [];
    const deleted: string[] = [];
    const { appFileSystem } = harness(
      buildAdapter({
        async copyAsync({ to }) {
          copied.push(to);
        },
        async deleteAsync(uri) {
          deleted.push(uri);
        },
      }),
    );

    const action = await runMedicationProofPhotoPicker({
      appFileSystem,
      pick: async () => ({
        canceled: false,
        assets: [{ ...pickedAsset.assets[0], uri: previousUri }],
      }),
      failureProtectedUris: [previousUri],
      cleanupAfterApplyUris: [previousUri],
      apply: () => accepted,
    });

    assert.equal(copied.length, 1);
    assert.equal(deleted.includes(copied[0]!), !accepted);
    assert.equal(
      deleted.includes(previousUri),
      accepted,
      accepted
        ? "accepted replacement must release the no-longer-referenced proof"
        : "rejected replacement must retain the still-referenced proof",
    );
    assert.equal(action.status, accepted ? "applied" : "rejected");
  }
});

test("a failed forced copy of an owned shared source leaves the original untouched", async () => {
  const sharedUri =
    "file:///documents/woofwatcher-attachments/shared-original.jpg";
  const deleted: string[] = [];
  let applyCalls = 0;
  const { appFileSystem } = harness(
    buildAdapter({
      async copyAsync() {
        throw new Error("copy denied");
      },
      async deleteAsync(uri) {
        deleted.push(uri);
      },
    }),
  );

  const action = await runRecordAttachmentPicker({
    appFileSystem,
    pick: async () => ({
      canceled: false,
      assets: [{ ...pickedAsset.assets[0], uri: sharedUri }],
    }),
    preserveUris: [sharedUri],
    apply: () => {
      applyCalls += 1;
      return true;
    },
  });

  assert.deepEqual(action, {
    status: "not-saved",
    reason: "durable-copy-failed",
    cleanupFailed: false,
  });
  assert.equal(applyCalls, 0);
  assert.deepEqual(deleted, []);
});

test("a failed durable copy releases an orphaned picker cache source", async () => {
  const sourceUri = "file:///cache/ImagePicker/orphan-after-copy-failure.jpg";
  const deleted: string[] = [];
  const { appFileSystem } = harness(
    buildAdapter({
      async copyAsync() {
        throw new Error("copy denied");
      },
      async deleteAsync(uri) {
        deleted.push(uri);
      },
    }),
  );

  const action = await runRecordAttachmentPicker({
    appFileSystem,
    pick: async () => ({
      canceled: false,
      assets: [{ ...pickedAsset.assets[0], uri: sourceUri }],
    }),
    apply: () => true,
  });

  assert.deepEqual(action, {
    status: "not-saved",
    reason: "durable-copy-failed",
    cleanupFailed: false,
  });
  assert.deepEqual(deleted, [sourceUri]);
});

test("a failed durable copy reports when its orphaned picker cache cannot be removed", async () => {
  const sourceUri = "file:///cache/ImagePicker/locked-copy-failure.jpg";
  const { appFileSystem } = harness(
    buildAdapter({
      async copyAsync() {
        throw new Error("copy denied");
      },
      async deleteAsync(uri) {
        if (uri === sourceUri) throw new Error("picker cache locked");
      },
    }),
  );

  const action = await runRecordAttachmentPicker({
    appFileSystem,
    pick: async () => ({
      canceled: false,
      assets: [{ ...pickedAsset.assets[0], uri: sourceUri }],
    }),
    apply: () => true,
  });

  assert.deepEqual(action, {
    status: "not-saved",
    reason: "durable-copy-failed",
    cleanupFailed: true,
  });
});

test("a throwing picker apply carries truthful partial-cleanup state to the caller", async () => {
  const sourceUri = "file:///cache/ImagePicker/locked-apply-failure.jpg";
  const { appFileSystem } = harness(
    buildAdapter({
      async deleteAsync(uri) {
        if (uri === sourceUri) throw new Error("picker cache locked");
      },
    }),
  );

  await assert.rejects(
    runRecordAttachmentPicker({
      appFileSystem,
      pick: async () => ({
        canceled: false,
        assets: [{ ...pickedAsset.assets[0], uri: sourceUri }],
      }),
      apply: () => {
        throw new Error("metadata persistence denied");
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof PickedMediaLocalDataActionError);
      assert.equal(error.message, "metadata persistence denied");
      assert.equal(error.cleanupFailed, true);
      return true;
    },
  );
});

test("an accepted replacement releases the old durable file only after the mutation accepts", async () => {
  const events: string[] = [];
  const previousUri =
    "file:///documents/woofwatcher-attachments/committed.jpg";
  const { appFileSystem } = harness(
    buildAdapter({
      async copyAsync() {
        events.push("copy");
      },
      async deleteAsync(uri) {
        events.push(`delete:${uri}`);
      },
    }),
  );

  const action = await runMedicationProofPhotoPicker({
    appFileSystem,
    pick: async () => pickedAsset,
    cleanupAfterApplyUris: [previousUri],
    apply: () => {
      events.push("apply:accepted");
      return true;
    },
  });

  assert.deepEqual(action, { status: "applied", cleanupFailed: false });
  assert.deepEqual(events.slice(0, 2), ["copy", "apply:accepted"]);
  assert.equal(events[2], `delete:${previousUri}`);
});

test("an accepted picker copy releases its sensitive ImagePicker source while retaining the durable copy", async () => {
  const sourceUri = "file:///cache/ImagePicker/sensitive-original.jpg";
  const copied: Array<{ from: string; to: string }> = [];
  const deleted: string[] = [];
  const { appFileSystem } = harness(
    buildAdapter({
      async copyAsync(input) {
        copied.push(input);
      },
      async deleteAsync(uri) {
        deleted.push(uri);
      },
    }),
  );

  const action = await runRecordAttachmentPicker({
    appFileSystem,
    pick: async () => ({
      canceled: false,
      assets: [{ ...pickedAsset.assets[0], uri: sourceUri }],
    }),
    apply: () => true,
  });

  assert.deepEqual(action, { status: "applied", cleanupFailed: false });
  assert.equal(copied.length, 1);
  assert.equal(copied[0]?.from, sourceUri);
  assert.notEqual(copied[0]?.to, sourceUri);
  assert.deepEqual(deleted, [sourceUri]);
  assert.equal(deleted.includes(copied[0]?.to ?? ""), false);
});

test("an accepted replacement reports orphan cleanup failure without pretending the mutation failed", async () => {
  const previousUri =
    "file:///documents/woofwatcher-attachments/locked.jpg";
  const { appFileSystem } = harness(
    buildAdapter({
      async deleteAsync(uri) {
        if (uri === previousUri) throw new Error("file locked");
      },
    }),
  );

  const action = await runMedicationProofPhotoPicker({
    appFileSystem,
    pick: async () => pickedAsset,
    cleanupAfterApplyUris: [previousUri],
    apply: () => true,
  });

  assert.deepEqual(action, { status: "applied", cleanupFailed: true });
});

test("Records generated writers preserve reports/credentials destinations and utf8/base64 encodings", async () => {
  const writes: Array<{ uri: string; content: string; encoding: string }> = [];
  const nativeShares: Array<{ title: string; message: string; url?: string }> =
    [];
  const { appFileSystem } = harness(
    buildAdapter({
      async writeAsStringAsync(uri, content, { encoding }) {
        writes.push({ uri, content, encoding });
      },
    }),
  );
  const shareNative = async (payload: {
    title: string;
    message: string;
    url?: string;
  }) => {
    nativeShares.push(payload);
    return "shared" as const;
  };
  const shareText = async () => "shared" as const;

  await runPrintableRecordsFileShare({
    appFileSystem,
    destination: "reports",
    printable: { fileName: "care-pass.html", html: "<care-pass />" },
    printableLabel: "Care Pass report source",
    title: "Phoenix Care Pass",
    shareNative,
    shareText,
  });
  await runPrintableRecordsFileShare({
    appFileSystem,
    destination: "credentials",
    printable: {
      fileName: "dog-id.svg",
      html: "<svg />",
      mimeType: "image/svg+xml",
    },
    printableLabel: "Dog ID SVG image source",
    title: "Phoenix Dog ID",
    shareNative,
    shareText,
  });
  await runGeneratedRecordsFileShare({
    appFileSystem,
    destination: "reports",
    source: {
      fileName: "care-pass.pdf",
      mimeType: "application/pdf",
      formatLabel: "Generated PDF",
      encoding: "base64",
      contentBase64: "cGRm",
      byteSize: 3,
      boundary: "Local generated PDF.",
    },
    title: "Phoenix Care Pass",
    shareNative,
    shareText,
  });
  await runGeneratedRecordsFileShare({
    appFileSystem,
    destination: "credentials",
    source: {
      fileName: "dog-id.png",
      mimeType: "image/png",
      formatLabel: "Generated PNG",
      encoding: "base64",
      contentBase64: "cG5n",
      byteSize: 3,
      boundary: "Local generated PNG.",
    },
    title: "Phoenix Dog ID",
    shareNative,
    shareText,
  });

  assert.deepEqual(
    writes.map(({ uri, encoding }) => ({ uri, encoding })),
    [
      {
        uri: "file:///documents/WoofWatcherReports/care-pass.html",
        encoding: "utf8",
      },
      {
        uri: "file:///documents/WoofWatcherCredentials/dog-id.svg",
        encoding: "utf8",
      },
      {
        uri: "file:///documents/WoofWatcherReports/care-pass.pdf",
        encoding: "base64",
      },
      {
        uri: "file:///documents/WoofWatcherCredentials/dog-id.png",
        encoding: "base64",
      },
    ],
  );
  assert.equal(nativeShares.length, 4);
  assert.ok(
    nativeShares.every((payload) => payload.url?.startsWith("content://")),
  );
});

for (const writer of ["printable", "generated"] as const) {
  for (const boundary of ["mkdir", "write", "content-uri", "share"] as const) {
    test(`Records ${writer} protected file share closes the ${boundary} reset race without recreation`, async () => {
      const gate = deferred<void>();
      const events: string[] = [];
      const files = new Set<string>();
      const { runtime, appFileSystem } = harness(
        buildAdapter({
          async makeDirectoryAsync() {
            events.push("mkdir:start");
            if (boundary === "mkdir") await gate.promise;
            events.push("mkdir:end");
          },
          async writeAsStringAsync(uri) {
            events.push("write:start");
            if (boundary === "write") await gate.promise;
            files.add(uri);
            events.push("write:end");
          },
          async getContentUriAsync(uri) {
            events.push("content-uri:start");
            if (boundary === "content-uri") await gate.promise;
            events.push("content-uri:end");
            return `content://${uri}`;
          },
          async deleteAsync(uri) {
            events.push(`delete:${uri}`);
            for (const file of [...files]) {
              if (file.startsWith(uri)) files.delete(file);
            }
          },
        }),
      );
      const shareNative = async () => {
        events.push("share:start");
        if (boundary === "share") await gate.promise;
        events.push("share:end");
        return "shared" as const;
      };
      const shareText = async () => {
        events.push("fallback");
        return "shared" as const;
      };
      const action =
        writer === "printable"
          ? runPrintableRecordsFileShare({
              appFileSystem,
              destination: "reports",
              printable: {
                fileName: "care-pass.html",
                html: "<care-pass />",
              },
              printableLabel: "Care Pass report source",
              title: "Phoenix Care Pass",
              shareNative,
              shareText,
            })
          : runGeneratedRecordsFileShare({
              appFileSystem,
              destination: "credentials",
              source: {
                fileName: "dog-id.png",
                mimeType: "image/png",
                formatLabel: "Generated PNG",
                encoding: "base64",
                contentBase64: "cG5n",
                byteSize: 3,
                boundary: "Local generated PNG.",
              },
              title: "Phoenix Dog ID",
              shareNative,
              shareText,
            });
      await waitUntil(() => events.includes(`${boundary}:start`));
      let resetSettled = false;
      const reset = runtime.operations.runReset().then((result) => {
        resetSettled = true;
        return result;
      });
      await Promise.resolve();
      assert.equal(resetSettled, false);

      gate.resolve();
      assert.deepEqual(await action, { status: "revoked" });
      assert.equal((await reset).status, "complete");
      assert.deepEqual(files, new Set());
      if (boundary !== "share") {
        assert.equal(events.includes("share:start"), false);
        assert.equal(events.includes("fallback"), false);
      }
      assert.equal(
        events.filter((event) => event === "write:start").length <= 1,
        true,
      );
    });
  }
}

test("Records suppresses a native-share failure fallback after reset revokes the protected action", async () => {
  const nativeShare = deferred<void>();
  let nativeShareStarted = false;
  let fallbackCalls = 0;
  const { runtime, appFileSystem } = harness(buildAdapter());
  const action = runPrintableRecordsFileShare({
    appFileSystem,
    destination: "reports",
    printable: { fileName: "care-pass.html", html: "<care-pass />" },
    title: "Phoenix Care Pass",
    shareNative: async () => {
      nativeShareStarted = true;
      await nativeShare.promise;
      throw new Error("native share failed");
    },
    shareText: async () => {
      fallbackCalls += 1;
      return "shared";
    },
  });
  await waitUntil(() => nativeShareStarted);
  const reset = runtime.operations.runReset();
  nativeShare.resolve();

  assert.deepEqual(await action, { status: "revoked" });
  assert.equal((await reset).status, "complete");
  assert.equal(fallbackCalls, 0);
});
