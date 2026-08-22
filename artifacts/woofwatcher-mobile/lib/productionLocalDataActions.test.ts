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
  runMedicationProofPhotoPicker,
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
    async getInfoAsync() {
      return { exists: true };
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
] as const) {
  test(`${label} captures intent before the picker and applies nothing when reset wins`, async () => {
    const picker = deferred<typeof pickedAsset>();
    const events: string[] = [];
    const { runtime, appFileSystem } = harness(
      buildAdapter({
        async makeDirectoryAsync() {
          events.push("mkdir");
        },
        async copyAsync() {
          events.push("copy");
        },
      }),
    );

    const action = runPicker({
      appFileSystem,
      pick: () => picker.promise,
      apply: () => {
        events.push("apply");
      },
    });
    const reset = runtime.operations.runReset();
    picker.resolve(pickedAsset);

    assert.deepEqual(await action, { status: "revoked" });
    assert.equal((await reset).status, "complete");
    assert.deepEqual(events, []);
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
