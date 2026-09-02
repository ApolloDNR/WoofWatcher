type CareDocument = Record<string, unknown>;

export interface MergeCareDocThreeWayInput<TDocument extends object> {
  base: Readonly<TDocument>;
  local: Readonly<TDocument>;
  remote: Readonly<TDocument>;
  /** Caller-supplied clock value keeps this helper pure and tests deterministic. */
  updatedAt: string;
}

export type CareDocThreeWayMergeResult<TDocument extends object> =
  | {
      status: "merged";
      doc: TDocument;
      conflictPaths: [];
    }
  | {
      status: "conflict";
      /** RFC 6901 JSON Pointers for every independently conflicting value. */
      conflictPaths: string[];
    };

const ABSENT = Symbol("care-document-property-absent");
type MergeValue = unknown | typeof ABSENT;

function isPlainObject(value: unknown): value is CareDocument {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(value: CareDocument, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function valuesEqual(left: MergeValue, right: MergeValue): boolean {
  if (left === ABSENT || right === ABSENT) return left === right;
  if (Object.is(left, right)) return true;

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    return left.every((value, index) => valuesEqual(value, right[index]));
  }

  if (!isPlainObject(left) || !isPlainObject(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(
    (key, index) =>
      key === rightKeys[index] && valuesEqual(left[key], right[key]),
  );
}

function escapeJsonPointerToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}

function appendJsonPointer(path: string, key: string): string {
  return `${path}/${escapeJsonPointerToken(key)}`;
}

function defineValue(target: CareDocument, key: string, value: unknown): void {
  // Define an own data property so an untrusted `__proto__` key cannot alter
  // the result object's prototype during a merge.
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function mergeObjectValues(
  base: CareDocument,
  local: CareDocument,
  remote: CareDocument,
  path: string,
  conflicts: string[],
  ignoreRootUpdatedAt: boolean,
): CareDocument {
  const keys = [
    ...new Set([
      ...Object.keys(base),
      ...Object.keys(local),
      ...Object.keys(remote),
    ]),
  ].sort();
  const merged: CareDocument = {};

  for (const key of keys) {
    if (ignoreRootUpdatedAt && key === "updatedAt") continue;
    const baseValue: MergeValue = hasOwn(base, key) ? base[key] : ABSENT;
    const localValue: MergeValue = hasOwn(local, key) ? local[key] : ABSENT;
    const remoteValue: MergeValue = hasOwn(remote, key) ? remote[key] : ABSENT;
    const value = mergeValue(
      baseValue,
      localValue,
      remoteValue,
      appendJsonPointer(path, key),
      conflicts,
    );
    if (value !== ABSENT) defineValue(merged, key, value);
  }

  return merged;
}

function mergeValue(
  base: MergeValue,
  local: MergeValue,
  remote: MergeValue,
  path: string,
  conflicts: string[],
): MergeValue {
  if (valuesEqual(local, base)) return remote;
  if (valuesEqual(remote, base)) return local;
  if (valuesEqual(local, remote)) return local;

  if (isPlainObject(base) && isPlainObject(local) && isPlainObject(remote)) {
    return mergeObjectValues(base, local, remote, path, conflicts, false);
  }

  conflicts.push(path);
  // The result is discarded whenever any conflict exists. Returning the local
  // value here lets traversal continue so callers receive every conflict path.
  return local;
}

/**
 * Three-way merges JSON-like care documents against their last confirmed
 * server base. Plain objects merge recursively; arrays and scalar values are
 * atomic. The root `updatedAt` never participates in conflict detection and
 * is replaced with the caller-provided value.
 *
 * A conflict result intentionally has no document, preventing callers from
 * accidentally uploading a locally-biased partial merge.
 */
export function mergeCareDocThreeWay<TDocument extends object>({
  base,
  local,
  remote,
  updatedAt,
}: MergeCareDocThreeWayInput<TDocument>): CareDocThreeWayMergeResult<TDocument> {
  if (!isPlainObject(base) || !isPlainObject(local) || !isPlainObject(remote)) {
    throw new TypeError("Care documents must be plain objects.");
  }

  const conflicts: string[] = [];
  const doc = mergeObjectValues(base, local, remote, "", conflicts, true);
  defineValue(doc, "updatedAt", updatedAt);

  return conflicts.length > 0
    ? { status: "conflict", conflictPaths: conflicts }
    : {
        status: "merged",
        doc: doc as TDocument,
        conflictPaths: [],
      };
}
