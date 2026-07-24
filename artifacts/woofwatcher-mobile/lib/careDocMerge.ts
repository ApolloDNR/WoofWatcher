import type { CareDoc } from "../context/CareContext";

export interface CareDocConflict {
  path: string;
  base: CareDocConflictOperand;
  server: CareDocConflictOperand;
  local: CareDocConflictOperand;
  resolution: "local";
  reason?:
    | "invalid-stable-ids"
    | "missing-acknowledged-base"
    | "mismatched-acknowledged-base";
}

export type CareDocConflictOperand =
  | { present: false }
  | { present: true; value: unknown };

const STABLE_ID_ARRAYS = new Set<keyof CareDoc>([
  "routines",
  "records",
  "calendarEvents",
  "reportArtifacts",
  "accessPasses",
  "adventureMemories",
  "pets",
  // Goals carry durable ids too, so they use the same merge policy instead
  // of becoming an atomic array that drops another caregiver's additions.
  "goals",
]);

const MISSING = Symbol("care-doc-missing");
type Missing = typeof MISSING;
type MergeValue = unknown | Missing;

function isObject(value: MergeValue): value is Record<string, unknown> {
  return (
    value !== MISSING &&
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function hasStableId(value: unknown): value is { id: string } {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === "string" &&
    !!(value as { id: string }).id.trim()
  );
}

function hasUniqueStableIds(values: unknown[]): values is Array<{ id: string }> {
  if (!values.every(hasStableId)) return false;
  return new Set(values.map((value) => value.id)).size === values.length;
}

function objectValue(
  object: Record<string, unknown>,
  key: string,
): MergeValue {
  if (!Object.prototype.hasOwnProperty.call(object, key)) return MISSING;
  const value = object[key];
  return value === undefined ? MISSING : value;
}

function valuesEqual(left: MergeValue, right: MergeValue): boolean {
  if (left === MISSING || right === MISSING) return left === right;
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => valuesEqual(value, right[index]))
    );
  }
  if (isObject(left) && isObject(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      const leftValue = objectValue(left, key);
      const rightValue = objectValue(right, key);
      if (!valuesEqual(leftValue, rightValue)) return false;
    }
    return true;
  }
  return false;
}

export function careDocContentEqual(
  left: CareDoc,
  right: CareDoc,
): boolean {
  const { updatedAt: _leftUpdatedAt, ...leftContent } = left;
  const { updatedAt: _rightUpdatedAt, ...rightContent } = right;
  return valuesEqual(leftContent, rightContent);
}

function conflictValue(value: MergeValue): CareDocConflictOperand {
  return value === MISSING
    ? { present: false }
    : { present: true, value };
}

function joinPath(parent: string, key: string): string {
  return parent ? `${parent}.${key}` : key;
}

function mergeAtomic(
  base: MergeValue,
  server: MergeValue,
  local: MergeValue,
  path: string,
  conflicts: CareDocConflict[],
): MergeValue {
  if (valuesEqual(server, base)) return local;
  if (valuesEqual(local, base)) return server;
  if (valuesEqual(server, local)) return local;
  conflicts.push({
    path,
    base: conflictValue(base),
    server: conflictValue(server),
    local: conflictValue(local),
    resolution: "local",
  });
  return local;
}

function mergeStableArray(
  base: unknown[],
  server: unknown[],
  local: unknown[],
  path: string,
  conflicts: CareDocConflict[],
): unknown[] {
  if (
    !hasUniqueStableIds(base) ||
    !hasUniqueStableIds(server) ||
    !hasUniqueStableIds(local)
  ) {
    conflicts.push({
      path,
      base: conflictValue(base),
      server: conflictValue(server),
      local: conflictValue(local),
      resolution: "local",
      reason: "invalid-stable-ids",
    });
    return local;
  }

  const baseById = new Map(base.map((row) => [row.id, row]));
  const serverById = new Map(server.map((row) => [row.id, row]));
  const localById = new Map(local.map((row) => [row.id, row]));
  const orderedIds = [
    ...local.map((row) => row.id),
    ...server
      .map((row) => row.id)
      .filter((id) => !localById.has(id)),
  ];
  const merged: unknown[] = [];

  for (const id of orderedIds) {
    const rowPath = `${path}[id=${JSON.stringify(id)}]`;
    const row = mergeValue(
      baseById.get(id) ?? MISSING,
      serverById.get(id) ?? MISSING,
      localById.get(id) ?? MISSING,
      rowPath,
      conflicts,
    );
    if (row !== MISSING) merged.push(row);
  }

  return merged;
}

function mergeObject(
  base: Record<string, unknown>,
  server: Record<string, unknown>,
  local: Record<string, unknown>,
  path: string,
  conflicts: CareDocConflict[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const keys = [
    ...Object.keys(local),
    ...Object.keys(server).filter((key) => !(key in local)),
    ...Object.keys(base).filter(
      (key) => !(key in local) && !(key in server),
    ),
  ];

  for (const key of keys) {
    const nextPath = joinPath(path, key);
    const baseValue = objectValue(base, key);
    const serverValue = objectValue(server, key);
    const localValue = objectValue(local, key);
    let value: MergeValue;

    if (!path && key === "updatedAt") {
      value = localValue !== MISSING ? localValue : serverValue;
    } else if (!path && key === "createdAt") {
      if (baseValue !== MISSING) {
        value = baseValue;
      } else {
        const present = [serverValue, localValue].filter(
          (candidate): candidate is Exclude<MergeValue, Missing> =>
            candidate !== MISSING,
        );
        value =
          present
            .filter((candidate): candidate is string => typeof candidate === "string")
            .sort((left, right) => {
              const leftTime = Date.parse(left);
              const rightTime = Date.parse(right);
              if (Number.isNaN(leftTime)) return 1;
              if (Number.isNaN(rightTime)) return -1;
              return leftTime - rightTime;
            })[0] ??
          present[0] ??
          MISSING;
      }
    } else if (
      !path &&
      STABLE_ID_ARRAYS.has(key as keyof CareDoc) &&
      (baseValue === MISSING || Array.isArray(baseValue)) &&
      Array.isArray(serverValue) &&
      Array.isArray(localValue)
    ) {
      value = mergeStableArray(
        baseValue === MISSING ? [] : baseValue,
        serverValue,
        localValue,
        nextPath,
        conflicts,
      );
    } else {
      value = mergeValue(
        baseValue,
        serverValue,
        localValue,
        nextPath,
        conflicts,
      );
    }

    if (value !== MISSING) result[key] = value;
  }

  return result;
}

function mergeValue(
  base: MergeValue,
  server: MergeValue,
  local: MergeValue,
  path: string,
  conflicts: CareDocConflict[],
): MergeValue {
  if (valuesEqual(server, base)) return local;
  if (valuesEqual(local, base)) return server;
  if (valuesEqual(server, local)) return local;
  if (base === MISSING && isObject(server) && isObject(local)) {
    return mergeObject({}, server, local, path, conflicts);
  }
  if (isObject(base) && isObject(server) && isObject(local)) {
    return mergeObject(base, server, local, path, conflicts);
  }
  return mergeAtomic(base, server, local, path, conflicts);
}

export function mergeCareDocWithoutBase<T extends CareDoc>(input: {
  server: T;
  local: T;
}): { doc: T; conflicts: CareDocConflict[] } {
  const conflicts: CareDocConflict[] = [];
  const doc = mergeObject(
    {},
    input.server as unknown as Record<string, unknown>,
    input.local as unknown as Record<string, unknown>,
    "",
    conflicts,
  ) as unknown as T;
  return { doc, conflicts };
}

export function mergeCareDocThreeWay<T extends CareDoc>(input: {
  base: T;
  server: T;
  local: T;
}): { doc: T; conflicts: CareDocConflict[] } {
  const conflicts: CareDocConflict[] = [];
  const doc = mergeObject(
    input.base as unknown as Record<string, unknown>,
    input.server as unknown as Record<string, unknown>,
    input.local as unknown as Record<string, unknown>,
    "",
    conflicts,
  ) as unknown as T;
  return { doc, conflicts };
}
