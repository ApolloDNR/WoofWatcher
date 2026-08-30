import assert from "node:assert/strict";
import { test } from "node:test";

import {
  APP_FILE_DESTINATION_DIRECTORY_NAMES,
  APP_OWNED_DIRECTORY_NAMES,
  isInsideOwnedAttachmentDirectory,
  isLegacyRootAvatarFileName,
  relocateAppOwnedDocumentUri,
} from "./appOwnedFileInventory.ts";

const currentDocuments =
  "file:///var/mobile/Containers/Data/Application/CURRENT/Documents/";

test("freezes the complete ownership inventory in deterministic order", () => {
  assert.deepEqual(APP_OWNED_DIRECTORY_NAMES, [
    "WoofWatcherReports",
    "WoofWatcherCredentials",
    "woofwatcher-attachments",
  ]);
  assert.equal(Object.isFrozen(APP_OWNED_DIRECTORY_NAMES), true);
  assert.deepEqual(APP_FILE_DESTINATION_DIRECTORY_NAMES, {
    reports: "WoofWatcherReports",
    credentials: "WoofWatcherCredentials",
    attachments: "woofwatcher-attachments",
  });
  assert.equal(Object.isFrozen(APP_FILE_DESTINATION_DIRECTORY_NAMES), true);
});

test("recognizes only exact historical root avatar basenames", () => {
  for (const fileName of [
    "phoenix-portrait-0.png",
    "phoenix-portrait-1722345678901.png",
    "avatar-happy-1.png",
    "avatar-excited-2.png",
    "avatar-calm-3.png",
    "avatar-anxious-4.png",
    "avatar-unwell-5.png",
  ]) {
    assert.equal(isLegacyRootAvatarFileName(fileName), true, fileName);
  }

  for (const fileName of [
    "Phoenix-portrait-1.png",
    "phoenix-portrait--1.png",
    "phoenix-portrait-1.PNG",
    "phoenix-portrait-1.png.bak",
    "avatar-sad-1.png",
    "avatar-happy-1.png/extra",
    "../avatar-happy-1.png",
    "avatar-happy%2f1.png",
    "avatar-happy-1%2epng",
    "avatar-happy-1.png?query",
    "avatar-happy-1.png#fragment",
    " avatar-happy-1.png",
  ]) {
    assert.equal(isLegacyRootAvatarFileName(fileName), false, fileName);
  }
});

test("rebases exact owned old iOS document descendants and legacy root avatars", () => {
  const oldRoot =
    "file:///var/mobile/Containers/Data/Application/OLD/Documents/";
  assert.equal(
    relocateAppOwnedDocumentUri(
      `${oldRoot}WoofWatcherReports/Phoenix-Care-Pass.html`,
      currentDocuments,
    ),
    `${currentDocuments}WoofWatcherReports/Phoenix-Care-Pass.html`,
  );
  assert.equal(
    relocateAppOwnedDocumentUri(
      `${oldRoot}WoofWatcherCredentials/Phoenix-Dog-ID.svg`,
      currentDocuments,
    ),
    `${currentDocuments}WoofWatcherCredentials/Phoenix-Dog-ID.svg`,
  );
  assert.equal(
    relocateAppOwnedDocumentUri(
      `${oldRoot}woofwatcher-attachments/proof.jpg`,
      currentDocuments,
    ),
    `${currentDocuments}woofwatcher-attachments/proof.jpg`,
  );
  assert.equal(
    relocateAppOwnedDocumentUri(
      `${oldRoot}avatar-happy-1700000000000.png`,
      currentDocuments,
    ),
    `${currentDocuments}avatar-happy-1700000000000.png`,
  );
});

test("keeps already-current owned URIs byte-identical", () => {
  const uri = `${currentDocuments}woofwatcher-attachments/already-current.jpg`;
  assert.equal(relocateAppOwnedDocumentUri(uri, currentDocuments), uri);
});

test("never rewrites non-owned, malformed, traversal-bearing, or non-file references", () => {
  const candidates = [
    "file:///var/mobile/Containers/Data/Application/OLD/Documents/unknown/file.jpg",
    "file:///var/mobile/Containers/Data/Application/OLD/Documents/WoofWatcherReportsSibling/file.html",
    "file:///var/mobile/Containers/Data/Application/OLD/Documents/WoofWatcherReports/../private.txt",
    "file:///var/mobile/Containers/Data/Application/OLD/Documents/WoofWatcherReports/%2e%2e/private.txt",
    "file:///var/mobile/Containers/Data/Application/OLD/Documents/WoofWatcherReports/%2E%2E/private.txt",
    "file:///var/mobile/Containers/Data/Application/OLD/Documents/WoofWatcherReports%2ffile.html",
    "file:///var/mobile/Containers/Data/Application/OLD/Documents/WoofWatcherReports%5Cfile.html",
    "file:///var/mobile/Containers/Data/Application/OLD/Documents/WoofWatcherReports\\file.html",
    "file:///tmp/Documents/WoofWatcherReports/report.html",
    "file://evil/var/mobile/Containers/Data/Application/OLD/Documents/WoofWatcherReports/report.html",
    "file:///tmp/Containers/Data/Application/OLD/Documents/WoofWatcherReports/report.html",
    "file:///var/mobile/Containers/Data/Application//Documents/WoofWatcherReports/report.html",
    "file:///data/user/0/app/files/WoofWatcherReports/report.html",
    "file:///var/mobile/Library/Caches/WoofWatcherReports/report.html",
    "ph://A-PHOTO",
    "content://media/external/images/42",
    "https://cdn.example.test/WoofWatcherReports/report.html",
    "asset:/WoofWatcherReports/report.html",
    "not a uri",
    "",
  ];

  for (const uri of candidates) {
    assert.equal(relocateAppOwnedDocumentUri(uri, currentDocuments), uri, uri);
  }
  const oldOwned =
    "file:///var/mobile/Containers/Data/Application/OLD/Documents/WoofWatcherReports/report.html";
  assert.equal(relocateAppOwnedDocumentUri(oldOwned, null), oldOwned);
  assert.equal(relocateAppOwnedDocumentUri(oldOwned, "not-a-file-root"), oldOwned);
  assert.equal(relocateAppOwnedDocumentUri(oldOwned, "file:///"), oldOwned);
  assert.equal(
    relocateAppOwnedDocumentUri(oldOwned, "file:///var//mobile/Documents/"),
    oldOwned,
  );
});

test("attachment containment accepts only descendants of the current exact directory", () => {
  assert.equal(
    isInsideOwnedAttachmentDirectory(
      `${currentDocuments}woofwatcher-attachments/existing.jpg`,
      currentDocuments,
    ),
    true,
  );
  for (const uri of [
    `${currentDocuments}woofwatcher-attachments`,
    `${currentDocuments}woofwatcher-attachmentsSibling/file.jpg`,
    `${currentDocuments}woofwatcher-attachments/../secret.jpg`,
    `${currentDocuments}woofwatcher-attachments/%2e%2e/secret.jpg`,
    `${currentDocuments}woofwatcher-attachments/%5Csecret.jpg`,
    `${currentDocuments}woofwatcher-attachments/file.jpg?download=1`,
    `${currentDocuments}woofwatcher-attachments/file.jpg#preview`,
    `${currentDocuments}other-document-child.jpg`,
    "file:///var/mobile/Containers/Data/Application/OLD/Documents/woofwatcher-attachments/file.jpg",
    "content://woofwatcher-attachments/file.jpg",
  ]) {
    assert.equal(
      isInsideOwnedAttachmentDirectory(uri, currentDocuments),
      false,
      uri,
    );
  }
  assert.equal(
    isInsideOwnedAttachmentDirectory(
      `${currentDocuments}woofwatcher-attachments/file.jpg`,
      null,
    ),
    false,
  );
  assert.equal(
    isInsideOwnedAttachmentDirectory(
      "file:///woofwatcher-attachments/file.jpg",
      "file:///",
    ),
    false,
  );
  assert.equal(
    isInsideOwnedAttachmentDirectory(
      "file:///var//mobile/Documents/woofwatcher-attachments/file.jpg",
      "file:///var//mobile/Documents/",
    ),
    false,
  );
});
