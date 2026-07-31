import assert from "node:assert/strict";
import test from "node:test";

import {
  DURABLE_ATTACHMENT_DIRECTORY_NAME,
  persistPickedMedia,
  type DurablePickedMediaFileSystem,
} from "./durablePickedMedia.ts";

function buildFileSystem(
  overrides: Partial<DurablePickedMediaFileSystem> = {},
): DurablePickedMediaFileSystem {
  return {
    documentDirectory: "file:///var/mobile/Documents/",
    async makeDirectoryAsync() {},
    async copyAsync() {},
    ...overrides,
  };
}

test("preserves the picked URI on web without touching the native file system", async () => {
  const calls: string[] = [];
  const result = await persistPickedMedia({
    platform: "web",
    sourceUri: "blob:https://woofwatcher.test/picked-photo",
    fileSystem: buildFileSystem({
      documentDirectory: null,
      async makeDirectoryAsync() {
        calls.push("mkdir");
      },
      async copyAsync() {
        calls.push("copy");
      },
    }),
  });

  assert.deepEqual(result, {
    ok: true,
    uri: "blob:https://woofwatcher.test/picked-photo",
    storage: "web-reference",
  });
  assert.deepEqual(calls, []);
});

test("copies native picked media into the durable attachment directory before returning its URI", async () => {
  const calls: Array<
    | { kind: "mkdir"; uri: string; intermediates: boolean | undefined }
    | { kind: "copy"; from: string; to: string }
  > = [];
  const result = await persistPickedMedia({
    platform: "ios",
    sourceUri: "file:///var/mobile/Library/Caches/ImagePicker/photo.tmp",
    fileName: "Medication proof.HEIC",
    filePrefix: "medication proof",
    now: () => 1_722_345_678_901,
    randomToken: () => "proof-token",
    fileSystem: buildFileSystem({
      async makeDirectoryAsync(uri, options) {
        calls.push({
          kind: "mkdir",
          uri,
          intermediates: options?.intermediates,
        });
      },
      async copyAsync({ from, to }) {
        calls.push({ kind: "copy", from, to });
      },
    }),
  });

  const expectedDirectory =
    `file:///var/mobile/Documents/${DURABLE_ATTACHMENT_DIRECTORY_NAME}/`;
  const expectedUri =
    `${expectedDirectory}medication-proof_1722345678901_proof-token.heic`;
  assert.deepEqual(result, {
    ok: true,
    uri: expectedUri,
    storage: "app-document",
  });
  assert.deepEqual(calls, [
    {
      kind: "mkdir",
      uri: expectedDirectory,
      intermediates: true,
    },
    {
      kind: "copy",
      from: "file:///var/mobile/Library/Caches/ImagePicker/photo.tmp",
      to: expectedUri,
    },
  ]);
});

test("uses MIME type for the durable extension when the picked URI has none", async () => {
  let copiedTo = "";
  const result = await persistPickedMedia({
    platform: "android",
    sourceUri: "file:///data/user/0/app/cache/ImagePicker/42",
    mimeType: "image/png",
    now: () => 42,
    randomToken: () => "png",
    fileSystem: buildFileSystem({
      documentDirectory: "file:///data/user/0/app/files",
      async copyAsync({ to }) {
        copiedTo = to;
      },
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(
    copiedTo,
    "file:///data/user/0/app/files/woofwatcher-attachments/attachment_42_png.png",
  );
});

test("prefers the image MIME type over a generic cache-file suffix", async () => {
  let copiedTo = "";
  const result = await persistPickedMedia({
    platform: "ios",
    sourceUri: "file:///var/mobile/Library/Caches/ImagePicker/photo.tmp",
    mimeType: "image/jpeg",
    now: () => 43,
    randomToken: () => "jpeg",
    fileSystem: buildFileSystem({
      async copyAsync({ to }) {
        copiedTo = to;
      },
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(
    copiedTo,
    "file:///var/mobile/Documents/woofwatcher-attachments/attachment_43_jpeg.jpg",
  );
});

test("reuses an already durable native URI without copying it again", async () => {
  const calls: string[] = [];
  const durableUri =
    "file:///var/mobile/Documents/woofwatcher-attachments/existing.jpg";
  const result = await persistPickedMedia({
    platform: "ios",
    sourceUri: durableUri,
    fileSystem: buildFileSystem({
      async makeDirectoryAsync() {
        calls.push("mkdir");
      },
      async copyAsync() {
        calls.push("copy");
      },
    }),
  });

  assert.deepEqual(result, {
    ok: true,
    uri: durableUri,
    storage: "app-document",
  });
  assert.deepEqual(calls, []);
});

test("returns no URI when native durable storage is unavailable", async () => {
  const result = await persistPickedMedia({
    platform: "ios",
    sourceUri: "file:///var/mobile/Library/Caches/ImagePicker/photo.jpg",
    fileSystem: buildFileSystem({ documentDirectory: null }),
  });

  assert.deepEqual(result, {
    ok: false,
    reason: "durable-storage-unavailable",
  });
  assert.equal("uri" in result, false);
});

test("returns no cache URI when the native copy fails", async () => {
  const cacheUri =
    "file:///var/mobile/Library/Caches/ImagePicker/ephemeral.jpg";
  const result = await persistPickedMedia({
    platform: "ios",
    sourceUri: cacheUri,
    fileSystem: buildFileSystem({
      async copyAsync() {
        throw new Error("disk full");
      },
    }),
  });

  assert.deepEqual(result, {
    ok: false,
    reason: "durable-copy-failed",
  });
  assert.equal("uri" in result, false);
  assert.equal(JSON.stringify(result).includes(cacheUri), false);
});

test("does not attempt a copy when durable directory creation fails", async () => {
  let copied = false;
  const result = await persistPickedMedia({
    platform: "android",
    sourceUri: "file:///data/user/0/app/cache/ImagePicker/photo.jpg",
    fileSystem: buildFileSystem({
      async makeDirectoryAsync() {
        throw new Error("permission denied");
      },
      async copyAsync() {
        copied = true;
      },
    }),
  });

  assert.deepEqual(result, {
    ok: false,
    reason: "durable-copy-failed",
  });
  assert.equal(copied, false);
});

test("rejects an empty picked URI before any persistence attempt", async () => {
  const result = await persistPickedMedia({
    platform: "ios",
    sourceUri: "   ",
    fileSystem: buildFileSystem(),
  });

  assert.deepEqual(result, {
    ok: false,
    reason: "missing-source-uri",
  });
});
