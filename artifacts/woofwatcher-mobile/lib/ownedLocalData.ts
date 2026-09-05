import { selectWoofWatcherKeysForOwnerWipe } from "./careSync.ts";
import type { LocalDataEraseResult } from "./privacy-erase-outcome.ts";

export const WOOFWATCHER_REPORTS_DIRECTORY_NAME = "WoofWatcherReports";
export const WOOFWATCHER_CREDENTIALS_DIRECTORY_NAME = "WoofWatcherCredentials";
export const WOOFWATCHER_ATTACHMENTS_DIRECTORY_NAME = "woofwatcher-attachments";

/**
 * Every app-owned directory below Expo's documentDirectory that may contain
 * owner data. Privacy erase consumes this list directly so a new export path
 * cannot silently outlive an owner wipe.
 */
export const WOOFWATCHER_OWNED_DOCUMENT_DIRECTORIES = [
  WOOFWATCHER_REPORTS_DIRECTORY_NAME,
  WOOFWATCHER_CREDENTIALS_DIRECTORY_NAME,
  WOOFWATCHER_ATTACHMENTS_DIRECTORY_NAME,
] as const;

export interface OwnerKeyValueWipeStorage {
  getAllKeys(): Promise<readonly string[]>;
  multiRemove(keys: readonly string[]): Promise<void>;
}

export interface OwnerDataWipeStorage extends OwnerKeyValueWipeStorage {
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface OwnerWipeTerminalTombstone {
  key: string;
  value: string;
}

export interface OwnerDocumentWipeFileSystem {
  deleteAsync(uri: string, options: { idempotent: boolean }): Promise<void>;
}

export async function wipeWoofWatcherKeysIfCurrent({
  storage,
  deletionLedgerKeyPrefix,
  preservedExactKeys = [],
  isCurrent,
}: {
  storage: OwnerKeyValueWipeStorage;
  deletionLedgerKeyPrefix: string;
  preservedExactKeys?: readonly string[];
  isCurrent: () => boolean;
}): Promise<LocalDataEraseResult> {
  if (!isCurrent()) return "superseded";
  const keys = await storage.getAllKeys();
  if (!isCurrent()) return "superseded";
  const owned = selectWoofWatcherKeysForOwnerWipe(
    keys,
    deletionLedgerKeyPrefix,
    preservedExactKeys,
  );
  if (owned.length > 0) {
    if (!isCurrent()) return "superseded";
    await storage.multiRemove(owned);
  }
  return isCurrent() ? "erased" : "superseded";
}

export async function wipeOwnedDocumentDirectoriesIfCurrent({
  documentDirectory,
  fileSystem,
  isCurrent,
}: {
  documentDirectory: string;
  fileSystem: OwnerDocumentWipeFileSystem;
  isCurrent: () => boolean;
}): Promise<LocalDataEraseResult> {
  const root = documentDirectory.endsWith("/")
    ? documentDirectory
    : `${documentDirectory}/`;
  for (const directory of WOOFWATCHER_OWNED_DOCUMENT_DIRECTORIES) {
    if (!isCurrent()) return "superseded";
    await fileSystem.deleteAsync(`${root}${directory}/`, { idempotent: true });
    if (!isCurrent()) return "superseded";
  }
  return "erased";
}

export async function wipeWoofWatcherOwnedDataIfCurrent({
  storage,
  deletionLedgerKeyPrefix,
  preservedExactKeys = [],
  terminalTombstones = [],
  documentDirectory,
  fileSystem,
  isCurrent,
}: {
  storage: OwnerDataWipeStorage;
  deletionLedgerKeyPrefix: string;
  preservedExactKeys?: readonly string[];
  terminalTombstones?: readonly OwnerWipeTerminalTombstone[];
  documentDirectory: string | null;
  fileSystem: OwnerDocumentWipeFileSystem;
  isCurrent: () => boolean;
}): Promise<LocalDataEraseResult> {
  for (const tombstone of terminalTombstones) {
    if (!isCurrent()) return "superseded";
    await storage.setItem(tombstone.key, tombstone.value);
    if (!isCurrent()) return "superseded";
  }

  const keyWipeResult = await wipeWoofWatcherKeysIfCurrent({
    storage,
    deletionLedgerKeyPrefix,
    preservedExactKeys: [
      ...preservedExactKeys,
      ...terminalTombstones.map((tombstone) => tombstone.key),
    ],
    isCurrent,
  });
  if (keyWipeResult === "superseded") return "superseded";
  if (documentDirectory) {
    const directoryWipeResult = await wipeOwnedDocumentDirectoriesIfCurrent({
      documentDirectory,
      fileSystem,
      isCurrent,
    });
    if (directoryWipeResult === "superseded") return "superseded";
  }

  for (const tombstone of terminalTombstones) {
    if (!isCurrent()) return "superseded";
    await storage.removeItem(tombstone.key);
    if (!isCurrent()) return "superseded";
  }
  return "erased";
}
