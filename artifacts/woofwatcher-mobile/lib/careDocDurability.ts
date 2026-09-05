export interface DurableCareSnapshot<
  TDoc extends object,
  TEntries extends readonly unknown[],
  TLastServerCareState = unknown,
> {
  storageKey: string;
  ownerUserId: string | null;
  householdId: string | null;
  doc: TDoc;
  entries: TEntries;
  serverVersion: number;
  lastServerCareState: TLastServerCareState | null;
}

export interface DurableCareStorageSetMutation {
  kind: "set";
  key: string;
  value: string;
}

export type DurableCareWriteOutcome =
  | { status: "applied" }
  | { status: "stale" }
  | { status: "storage-failed"; error: unknown };

export interface CareDocDurabilityCoordinator {
  persist<
    TDoc extends object,
    TEntries extends readonly unknown[],
    TLastServer,
  >(
    snapshot: DurableCareSnapshot<TDoc, TEntries, TLastServer>,
    isCurrent: () => boolean,
  ): Promise<DurableCareWriteOutcome>;
  consumeAutomaticPersistence<
    TDoc extends object,
    TEntries extends readonly unknown[],
    TLastServer,
  >(
    snapshot: DurableCareSnapshot<TDoc, TEntries, TLastServer>,
  ): boolean;
}

interface DirectSnapshotMarker {
  storageKey: string;
  ownerUserId: string | null;
  householdId: string | null;
  entries: readonly unknown[];
  serverVersion: number;
  lastServerCareState: unknown;
}

interface CreateCareDocDurabilityCoordinatorOptions {
  currentEpoch: () => number;
  enqueue: (
    mutation: DurableCareStorageSetMutation,
    expectedEpoch: number,
  ) => Promise<"applied" | "superseded">;
}

function sortJsonObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonObjectKeys);
  if (!value || typeof value !== "object") return value;

  const sorted = Object.create(null) as Record<string, unknown>;
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[key] = sortJsonObjectKeys((value as Record<string, unknown>)[key]);
  }
  return sorted;
}

function serializeCanonicalJson(value: unknown): string {
  // Normalize through JSON first so Date/toJSON/undefined semantics match the
  // exact payload written to storage and returned by a JSON/JSONB provider.
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error("Care document could not be serialized.");
  }
  return JSON.stringify(sortJsonObjectKeys(JSON.parse(serialized)));
}

/**
 * Captures the exact accepted document value so an asynchronous durability
 * acknowledgement cannot report success after provider recovery or conflict
 * handling has replaced the live document in the same household. JSON object
 * key order is canonicalized because JSONB/providers may reorder an otherwise
 * identical acknowledgement.
 */
export function createAcceptedCareDocFence<TDoc extends object>(
  acceptedDoc: TDoc,
): (currentDoc: TDoc) => boolean {
  const acceptedSerialized = serializeCanonicalJson(acceptedDoc);
  return (currentDoc) => {
    try {
      return serializeCanonicalJson(currentDoc) === acceptedSerialized;
    } catch {
      return false;
    }
  };
}

function markerMatchesSnapshot(
  marker: DirectSnapshotMarker,
  snapshot: DurableCareSnapshot<object, readonly unknown[], unknown>,
): boolean {
  return (
    marker.storageKey === snapshot.storageKey &&
    marker.ownerUserId === snapshot.ownerUserId &&
    marker.householdId === snapshot.householdId &&
    marker.entries === snapshot.entries &&
    marker.serverVersion === snapshot.serverVersion &&
    marker.lastServerCareState === snapshot.lastServerCareState
  );
}

/**
 * Gives an owner-facing save an awaitable local durability boundary without
 * racing CareContext's normal snapshot effect. The direct snapshot is queued
 * on the shared writer, while the one identical effect write is consumed.
 * A later snapshot with newer document or entry state is never suppressed.
 */
export function createCareDocDurabilityCoordinator({
  currentEpoch,
  enqueue,
}: CreateCareDocDurabilityCoordinatorOptions): CareDocDurabilityCoordinator {
  const directSnapshots = new WeakMap<object, DirectSnapshotMarker>();

  return {
    async persist(snapshot, isCurrent) {
      if (!isCurrent()) return { status: "stale" };

      directSnapshots.set(snapshot.doc, {
        storageKey: snapshot.storageKey,
        ownerUserId: snapshot.ownerUserId,
        householdId: snapshot.householdId,
        entries: snapshot.entries,
        serverVersion: snapshot.serverVersion,
        lastServerCareState: snapshot.lastServerCareState,
      });

      try {
        const value = JSON.stringify({
          ownerUserId: snapshot.ownerUserId,
          householdId: snapshot.householdId,
          doc: snapshot.doc,
          entries: snapshot.entries,
          serverVersion: snapshot.serverVersion,
          lastServerCareState: snapshot.lastServerCareState,
        });
        if (value === undefined) {
          throw new Error("Care snapshot could not be serialized.");
        }
        const expectedEpoch = currentEpoch();
        const result = await enqueue(
          {
            kind: "set",
            key: snapshot.storageKey,
            value,
          },
          expectedEpoch,
        );
        if (result !== "applied" || !isCurrent()) {
          return { status: "stale" };
        }
        return { status: "applied" };
      } catch (error) {
        return { status: "storage-failed", error };
      }
    },

    consumeAutomaticPersistence(snapshot) {
      const marker = directSnapshots.get(snapshot.doc);
      if (!marker) return false;
      directSnapshots.delete(snapshot.doc);
      return markerMatchesSnapshot(
        marker,
        snapshot as DurableCareSnapshot<object, readonly unknown[], unknown>,
      );
    },
  };
}
