/**
 * Pack supplies checklist: the pure model behind the Pack tab's "Essentials"
 * and "Travel bag" boards from Apollo's mockup Pack page.
 *
 * Honesty rule: every status here is USER-SET. WoofWatcher cannot see the
 * pantry, so the mockup's predicted countdowns ("2 days left") are replaced
 * by the owner's own word (Plenty / Low / Out, Packed / Unpacked) plus the
 * timestamp of when they last set it. Untouched items are `unconfirmed` and
 * `updatedAt` stays null until the user actually answers.
 */

export type SupplyGroup = "essentials" | "travel";

/** Pantry-style levels for the Essentials list. */
export type EssentialsSupplyStatus = "plenty" | "low" | "out";
/** Checklist state for the Travel bag list. */
export type TravelSupplyStatus = "packed" | "unpacked";
export type SupplyStatus =
  | "unconfirmed"
  | EssentialsSupplyStatus
  | TravelSupplyStatus;

export interface SupplyItem {
  id: string;
  name: string;
  group: SupplyGroup;
  /** User-set only - defaults stay unconfirmed until the owner's first tap. */
  status: SupplyStatus;
  /** ISO timestamp of the last user-set status, or null for untouched defaults. */
  updatedAt: string | null;
}

/**
 * Fixed confirmed-state tap cycles, one per group. `unconfirmed` is handled
 * separately so it is only an initial state: the first tap confirms Plenty
 * for essentials or Packed for checklist-style travel gear.
 */
const STATUS_CYCLE: Record<SupplyGroup, readonly SupplyStatus[]> = {
  essentials: ["plenty", "low", "out"],
  travel: ["packed", "unpacked"],
};

function defaultStatusFor(_group: SupplyGroup): SupplyStatus {
  return "unconfirmed";
}

/** Stable, readable id: "essentials-poop-bags", "travel-portable-bowl". */
function slugId(group: SupplyGroup, name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${group}-${slug || "item"}`;
}

/** Ids must stay unique across the whole list, so collisions get a -2, -3... */
function uniqueId(items: readonly SupplyItem[], group: SupplyGroup, name: string): string {
  const base = slugId(group, name);
  if (!items.some((item) => item.id === base)) return base;
  let suffix = 2;
  while (items.some((item) => item.id === `${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function starterItem(group: SupplyGroup, name: string): SupplyItem {
  return {
    id: slugId(group, name),
    name,
    group,
    status: defaultStatusFor(group),
    updatedAt: null,
  };
}

/**
 * The mockup Pack page's starter checklist. All `updatedAt: null`: nobody has
 * confirmed any of these yet, so the UI can present them as an untouched
 * starter list instead of pretending the owner already checked the shelf.
 */
export const DEFAULT_SUPPLIES: readonly SupplyItem[] = [
  starterItem("essentials", "Food"),
  starterItem("essentials", "Treats"),
  starterItem("essentials", "Medications"),
  starterItem("essentials", "Poop Bags"),
  starterItem("essentials", "Toys"),
  starterItem("travel", "Harness"),
  starterItem("travel", "Leash"),
  starterItem("travel", "Portable Bowl"),
];

/**
 * Next status when the owner taps a row: unconfirmed -> plenty -> low -> out
 * -> plenty for essentials, and unconfirmed -> packed -> unpacked -> packed
 * for travel gear. A status that somehow does not belong to the item's group
 * resets to unconfirmed instead of inventing an answer.
 */
export function cycleStatus(item: Pick<SupplyItem, "group" | "status">): SupplyStatus {
  const cycle = STATUS_CYCLE[item.group];
  if (item.status === "unconfirmed") return cycle[0];
  const index = cycle.indexOf(item.status);
  if (index === -1) return defaultStatusFor(item.group);
  return cycle[(index + 1) % cycle.length];
}

/**
 * A travel bag is ready only when it has at least one travel item and every
 * travel item is explicitly packed. A partial checklist or any unconfirmed
 * row must never unlock "out the door" copy.
 */
export function isTravelBagReady(items: readonly SupplyItem[]): boolean {
  const travelItems = items.filter((item) => item.group === "travel");
  return (
    travelItems.length > 0 &&
    travelItems.every((item) => item.status === "packed")
  );
}

/** Case-insensitive name collision inside one group (rename excludes itself). */
function hasDuplicateName(
  items: readonly SupplyItem[],
  group: SupplyGroup,
  name: string,
  excludeId?: string,
): boolean {
  const needle = name.trim().toLowerCase();
  return items.some(
    (item) =>
      item.group === group &&
      item.id !== excludeId &&
      item.name.trim().toLowerCase() === needle,
  );
}

/**
 * Appends a new user item to its group with an unconfirmed status and
 * `updatedAt: null` (adding a row is not a stock answer yet). Returns null
 * when the trimmed name is empty or already taken in that group, so the UI
 * can explain instead of silently dropping the input.
 */
export function addItem(
  items: readonly SupplyItem[],
  name: string,
  group: SupplyGroup,
): SupplyItem[] | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (hasDuplicateName(items, group, trimmed)) return null;
  return [
    ...items,
    {
      id: uniqueId(items, group, trimmed),
      name: trimmed,
      group,
      status: defaultStatusFor(group),
      updatedAt: null,
    },
  ];
}

/**
 * Renames an item in place (id, group, status untouched). `updatedAt` also
 * stays put: it stamps status answers, and a spelling fix is not one.
 * Returns null for an empty trimmed name, an unknown id, or a name already
 * used by another item in the same group (case-insensitive).
 */
export function renameItem(
  items: readonly SupplyItem[],
  id: string,
  name: string,
): SupplyItem[] | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const target = items.find((item) => item.id === id);
  if (!target) return null;
  if (hasDuplicateName(items, target.group, trimmed, id)) return null;
  return items.map((item) => (item.id === id ? { ...item, name: trimmed } : item));
}

/** Drops the item with the given id; always returns a new array. */
export function removeItem(items: readonly SupplyItem[], id: string): SupplyItem[] {
  return items.filter((item) => item.id !== id);
}

const LEGACY_STORAGE_VERSION = 1;
const STORAGE_VERSION = 2;

/** JSON payload for AsyncStorage; `parseSupplies` round-trips it exactly. */
export function serializeSupplies(items: readonly SupplyItem[]): string {
  return JSON.stringify({
    version: STORAGE_VERSION,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      group: item.group,
      status: item.status,
      updatedAt: item.updatedAt,
    })),
  });
}

function freshDefaults(): SupplyItem[] {
  return DEFAULT_SUPPLIES.map((item) => ({ ...item }));
}

function parseItem(
  raw: unknown,
  migrateUnstampedLegacyStatus: boolean,
): SupplyItem | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as { [key: string]: unknown };
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const group = value.group;
  if (!id || !name) return null;
  if (group !== "essentials" && group !== "travel") return null;
  const status = value.status;
  if (
    typeof status !== "string" ||
    (status !== "unconfirmed" &&
      !STATUS_CYCLE[group].includes(status as SupplyStatus))
  ) {
    return null;
  }
  const updatedAt = value.updatedAt;
  if (updatedAt !== null && (typeof updatedAt !== "string" || !Number.isFinite(Date.parse(updatedAt)))) {
    return null;
  }
  return {
    id,
    name,
    group,
    status:
      migrateUnstampedLegacyStatus && updatedAt === null
        ? "unconfirmed"
        : (status as SupplyStatus),
    updatedAt: updatedAt as string | null,
  };
}

function parseStoredSupplies(raw: string): SupplyItem[] | null {
  if (!raw.trim()) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const { version, items } = payload as { version?: unknown; items?: unknown };
  if (
    (version !== LEGACY_STORAGE_VERSION && version !== STORAGE_VERSION) ||
    !Array.isArray(items)
  ) {
    return null;
  }
  const migrateUnstampedLegacyStatus = version === LEGACY_STORAGE_VERSION;

  const parsed: SupplyItem[] = [];
  for (const entry of items) {
    const item = parseItem(entry, migrateUnstampedLegacyStatus);
    if (!item) return null;
    parsed.push(item);
  }
  // Enforce the same invariants addItem/renameItem maintain, so every list
  // the app holds obeys one contract regardless of where it came from.
  const seenIds = new Set<string>();
  for (const item of parsed) {
    if (seenIds.has(item.id)) return null;
    seenIds.add(item.id);
    if (hasDuplicateName(parsed, item.group, item.name, item.id)) return null;
  }
  return parsed;
}

export type SuppliesStorageInspection =
  | { status: "missing"; items: SupplyItem[] }
  | { status: "valid"; items: SupplyItem[] }
  | { status: "invalid"; items: null };

/**
 * Distinguishes a genuinely new checklist from an unreadable existing key.
 * The Pack screen must not replace corrupt or unsupported owner data with
 * defaults and then overwrite it on the next tap.
 */
export function inspectSuppliesStorage(
  raw: string | null | undefined,
): SuppliesStorageInspection {
  if (raw == null) {
    return { status: "missing", items: freshDefaults() };
  }
  const parsed = parseStoredSupplies(raw);
  return parsed
    ? { status: "valid", items: parsed }
    : { status: "invalid", items: null };
}

/**
 * Backwards-compatible model parser for non-storage callers. It never throws
 * and still returns fresh defaults for absent or malformed input. Storage
 * boundaries should use inspectSuppliesStorage so corruption remains visible.
 */
export function parseSupplies(raw: string | null | undefined): SupplyItem[] {
  const inspected = inspectSuppliesStorage(raw);
  return inspected.items ?? freshDefaults();
}

/**
 * True while the list is exactly the untouched starter checklist (same items
 * in the same order, every `updatedAt` still null). The UI uses this to say
 * "starter list - tap to set real statuses" instead of implying the owner
 * already confirmed anything.
 */
export function isDefaultUntouched(items: readonly SupplyItem[]): boolean {
  if (items.length !== DEFAULT_SUPPLIES.length) return false;
  return DEFAULT_SUPPLIES.every((expected, index) => {
    const actual = items[index];
    return (
      actual.id === expected.id &&
      actual.name === expected.name &&
      actual.group === expected.group &&
      actual.status === expected.status &&
      actual.updatedAt === null
    );
  });
}
