import {
  inspectSuppliesStorage,
  serializeSupplies,
  type SupplyItem,
} from "./packSupplies.ts";
import {
  inspectTravelBagStorage,
  serializeTravelBag,
  type TravelBagSession,
} from "./travelBag.ts";
import {
  getCareStorageKey,
  type CareStorageScope,
} from "./careStorageScope.ts";

export interface PackStoredState {
  supplies: SupplyItem[];
  travelBag: TravelBagSession;
}

export type PackStateStorageInspection =
  | { status: "missing"; state: null }
  | { status: "valid"; state: PackStoredState }
  | { status: "invalid"; state: null };

export interface PackWriteCoordinator {
  enqueue(
    update: (current: PackStoredState) => PackStoredState,
    persist: (next: PackStoredState) => Promise<void>,
  ): Promise<PackStoredState>;
  snapshot(): PackStoredState;
}

const PACK_STATE_STORAGE_VERSION = 1;

export function getPackStorageKey(scope: CareStorageScope): string {
  return `${getCareStorageKey(scope)}.pack.v1`;
}

/**
 * Serializes every mutation of the one-value Pack envelope. A supplies write
 * and a travel-bag write may begin in either order, but each updater observes
 * the last confirmed state and no successful half can be overwritten by a
 * stale concurrent snapshot.
 */
export function createPackWriteCoordinator(
  initialState: PackStoredState,
): PackWriteCoordinator {
  let confirmedState = initialState;
  let tail: Promise<void> = Promise.resolve();

  return {
    enqueue(update, persist) {
      const result = tail.then(async () => {
        const next = update(confirmedState);
        await persist(next);
        confirmedState = next;
        return next;
      });
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    snapshot() {
      return confirmedState;
    },
  };
}

/**
 * One storage value is the commit boundary for checklist and trip phase.
 * Nested versioned payloads retain their own migration/validation contracts.
 */
export function serializePackState(state: PackStoredState): string {
  return JSON.stringify({
    version: PACK_STATE_STORAGE_VERSION,
    suppliesPayload: serializeSupplies(state.supplies),
    travelBagPayload: serializeTravelBag(state.travelBag),
  });
}

export function inspectPackStateStorage(
  raw: string | null | undefined,
): PackStateStorageInspection {
  if (raw == null) return { status: "missing", state: null };
  if (!raw.trim()) return { status: "invalid", state: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "invalid", state: null };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { status: "invalid", state: null };
  }

  const envelope = parsed as Record<string, unknown>;
  if (
    envelope.version !== PACK_STATE_STORAGE_VERSION ||
    typeof envelope.suppliesPayload !== "string" ||
    typeof envelope.travelBagPayload !== "string"
  ) {
    return { status: "invalid", state: null };
  }

  const supplies = inspectSuppliesStorage(envelope.suppliesPayload);
  const travelBag = inspectTravelBagStorage(envelope.travelBagPayload);
  if (
    supplies.status !== "valid" ||
    travelBag.status !== "valid"
  ) {
    return { status: "invalid", state: null };
  }

  return {
    status: "valid",
    state: {
      supplies: supplies.items,
      travelBag: travelBag.session,
    },
  };
}
