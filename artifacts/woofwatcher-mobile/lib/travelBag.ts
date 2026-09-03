/**
 * Travel bag session: the lifecycle that turns the Pack tab's travel-gear
 * checklist into an activatable "package" the owner sets up, activates, and
 * redoes for the next trip.
 *
 * Honesty rule (same as packSupplies): nothing here fabricates progress. The
 * packed/unpacked truth stays in the SupplyItem checklist (packSupplies.ts);
 * this module only holds the trip PHASE the owner drives by hand. A bag is
 * "active" ONLY after the owner taps Activate - an already-packed checklist is
 * never auto-promoted, because a trip nobody started would be a lie. Activate
 * is refused when nothing is packed. Redo returns the gear to unpacked so a
 * fresh trip looks honestly untouched (no checkmark nobody earned).
 */

import type { SupplyItem } from "./packSupplies";

export type TravelBagPhase = "packing" | "active" | "complete";

export interface TravelBagSession {
  /** Owner-set trip name, e.g. "Weekend trip", "Vet visit". */
  label: string;
  phase: TravelBagPhase;
  /** ISO timestamp the owner tapped Activate, or null before that. */
  activatedAt: string | null;
  /** ISO timestamp the owner marked the trip complete, or null. */
  completedAt: string | null;
}

const PHASES: readonly TravelBagPhase[] = ["packing", "active", "complete"];
const DEFAULT_LABEL = "Travel bag";

/** A brand-new, never-activated bag: packing, unnamed timestamps. */
export function defaultTravelBag(): TravelBagSession {
  return { label: DEFAULT_LABEL, phase: "packing", activatedAt: null, completedAt: null };
}

/**
 * Activate the bag for a trip. Refuses (returns null) when nothing is packed -
 * you cannot activate an empty bag, and a "ready" state nobody earned would be
 * dishonest. On success the phase becomes "active" and stamps activatedAt.
 */
export function activateTravelBag(
  session: TravelBagSession,
  packedCount: number,
  now: string,
): TravelBagSession | null {
  if (packedCount <= 0) return null;
  return { ...session, phase: "active", activatedAt: now, completedAt: null };
}

/** Mark the active trip complete; stamps completedAt, keeps the packed gear. */
export function completeTravelBag(session: TravelBagSession, now: string): TravelBagSession {
  return { ...session, phase: "complete", completedAt: now };
}

/**
 * Reopen an active bag back to packing (owner wasn't out the door yet).
 * Clears the activation stamp; leaves the checklist alone.
 */
export function reopenTravelBag(session: TravelBagSession): TravelBagSession {
  return { ...session, phase: "packing", activatedAt: null, completedAt: null };
}

/**
 * Redo the bag for the NEXT trip: back to packing with the timestamps cleared,
 * keeping the owner's label. Pair with resetTravelItems so the gear returns to
 * unpacked and the fresh trip looks honestly untouched.
 */
export function redoTravelBag(session: TravelBagSession): TravelBagSession {
  return { label: session.label, phase: "packing", activatedAt: null, completedAt: null };
}

/**
 * Rename the bag ("Weekend trip", "Vet visit"). An empty/whitespace name is a
 * no-op (keeps the current label) rather than blanking it.
 */
export function renameTravelBag(session: TravelBagSession, label: string): TravelBagSession {
  const trimmed = label.trim();
  if (!trimmed) return session;
  return { ...session, label: trimmed };
}

/**
 * Return every travel-group item to unpacked with a null timestamp, leaving
 * essentials untouched. Used by a Redo so a new trip does not inherit last
 * trip's checkmarks (which nobody earned for this trip).
 */
export function resetTravelItems(items: readonly SupplyItem[]): SupplyItem[] {
  return items.map((item) =>
    item.group === "travel" ? { ...item, status: "unpacked", updatedAt: null } : { ...item },
  );
}

const STORAGE_VERSION = 1;

/** JSON payload for AsyncStorage; parseTravelBag round-trips it exactly. */
export function serializeTravelBag(session: TravelBagSession): string {
  return JSON.stringify({
    version: STORAGE_VERSION,
    label: session.label,
    phase: session.phase,
    activatedAt: session.activatedAt,
    completedAt: session.completedAt,
  });
}

function parseStamp(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) return value;
  return undefined; // signals malformed
}

/**
 * Strict parse of a stored payload. Anything malformed - unparseable JSON,
 * wrong version, an unknown phase, a bad timestamp - silently falls back to a
 * fresh default bag. It never throws, so a corrupted key can never crash the
 * Pack tab. An existing user with no key parses to the default (packing): an
 * already-packed checklist is NEVER auto-activated, only the owner's tap does
 * that.
 */
export function tryParseStoredTravelBag(
  raw: string | null | undefined,
): TravelBagSession | null {
  if (typeof raw !== "string" || !raw.trim()) return defaultTravelBag();
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const value = payload as { [key: string]: unknown };
  if (value.version !== STORAGE_VERSION) return null;

  const phase = value.phase;
  if (typeof phase !== "string" || !PHASES.includes(phase as TravelBagPhase)) {
    return null;
  }
  const label = typeof value.label === "string" && value.label.trim() ? value.label.trim() : DEFAULT_LABEL;
  const activatedAt = parseStamp(value.activatedAt);
  const completedAt = parseStamp(value.completedAt);
  if (activatedAt === undefined || completedAt === undefined) return null;

  return { label, phase: phase as TravelBagPhase, activatedAt, completedAt };
}

export function parseTravelBag(raw: string | null | undefined): TravelBagSession {
  return tryParseStoredTravelBag(raw) ?? defaultTravelBag();
}
