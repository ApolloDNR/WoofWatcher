import { isFutureCareDocDataVersion } from "./careDocMigration.ts";

export const CARE_IDENTITY_VAULT_FORMAT = "woofwatcher.care.identity-v1";

export interface CareIdentityVault {
  format: typeof CARE_IDENTITY_VAULT_FORMAT;
  slots: Record<string, unknown>;
  quarantine: Array<{
    reason: string;
    snapshot: unknown;
  }>;
}

export interface CareIdentityVaultParseResult {
  vault: CareIdentityVault;
  migrated: boolean;
  corruptRaw: string | null;
}

interface PreservedJsonValue {
  raw: string;
  runtimeShape: CapturedRuntimeShape;
}

interface PreservedSlotJson extends PreservedJsonValue {
  memberRaw: string;
}

interface CareIdentityVaultRawState {
  slots: Map<string, PreservedSlotJson>;
  quarantine: WeakMap<object, PreservedJsonValue>;
  opaqueTopLevelMembers: string[];
}

interface JsonObjectMember {
  key: string;
  keyRaw: string;
  memberRaw: string;
  valueRaw: string;
}

type CapturedRuntimeValue =
  | { kind: "primitive"; value: unknown }
  | { kind: "object"; value: object };

interface CapturedRuntimeNode {
  value: object;
  arrayLength: number | null;
  keys: string[];
  children: CapturedRuntimeValue[];
}

interface CapturedRuntimeShape {
  root: CapturedRuntimeValue;
  nodes: WeakMap<object, CapturedRuntimeNode>;
}

// Future clients may add JSON values that this runtime cannot represent
// losslessly (for example, an integer outside Number.MAX_SAFE_INTEGER). Keep
// those source fragments beside the parsed view rather than storing them in
// the public vault shape, where an ordinary JSON.stringify would normalize or
// round them. The WeakMap also keeps this implementation detail out of the
// persisted schema.
const rawStateByVault = new WeakMap<
  CareIdentityVault,
  CareIdentityVaultRawState
>();

const CLEANUP_PREFIX = "identity-v1:";
const HOUSEHOLD_SCOPE_PREFIX = "care-v2:";

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isLegacyCareSnapshot(value: unknown): boolean {
  return (
    isObject(value) &&
    isObject(value.doc) &&
    Array.isArray(value.entries) &&
    typeof value.serverVersion === "number"
  );
}

function isRecognizableFutureCareSnapshot(value: unknown): boolean {
  return isObject(value) && isFutureCareDocDataVersion(value.doc);
}

function isAttributedCareDataScope(value: string): boolean {
  if (value === "local") return true;
  if (!value.startsWith(HOUSEHOLD_SCOPE_PREFIX)) return false;
  try {
    const tuple = JSON.parse(value.slice(HOUSEHOLD_SCOPE_PREFIX.length));
    return (
      Array.isArray(tuple) &&
      tuple.length === 2 &&
      tuple.every((part) => typeof part === "string" && part.length > 0)
    );
  } catch {
    return false;
  }
}

function createRawState(): CareIdentityVaultRawState {
  return {
    slots: new Map(),
    quarantine: new WeakMap(),
    opaqueTopLevelMembers: [],
  };
}

function rawStateFor(vault: CareIdentityVault): CareIdentityVaultRawState {
  let state = rawStateByVault.get(vault);
  if (!state) {
    state = createRawState();
    rawStateByVault.set(vault, state);
  }
  return state;
}

function skipJsonWhitespace(raw: string, from: number): number {
  let cursor = from;
  while (
    cursor < raw.length &&
    (raw[cursor] === " " ||
      raw[cursor] === "\n" ||
      raw[cursor] === "\r" ||
      raw[cursor] === "\t")
  ) {
    cursor += 1;
  }
  return cursor;
}

function scanJsonStringEnd(raw: string, from: number): number | null {
  if (raw[from] !== '"') return null;
  for (let cursor = from + 1; cursor < raw.length; cursor += 1) {
    if (raw[cursor] === "\\") {
      cursor += 1;
      continue;
    }
    if (raw[cursor] === '"') return cursor + 1;
  }
  return null;
}

function scanJsonValueEnd(raw: string, from: number): number | null {
  const start = skipJsonWhitespace(raw, from);
  const first = raw[start];
  if (first === '"') return scanJsonStringEnd(raw, start);
  if (first === "{" || first === "[") {
    const expectedClosers: string[] = [first === "{" ? "}" : "]"];
    let inString = false;
    for (let cursor = start + 1; cursor < raw.length; cursor += 1) {
      const char = raw[cursor];
      if (inString) {
        if (char === "\\") {
          cursor += 1;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }
      if (char === '"') {
        inString = true;
      } else if (char === "{") {
        expectedClosers.push("}");
      } else if (char === "[") {
        expectedClosers.push("]");
      } else if (char === "}" || char === "]") {
        if (expectedClosers.pop() !== char) return null;
        if (expectedClosers.length === 0) return cursor + 1;
      }
    }
    return null;
  }

  let cursor = start;
  while (cursor < raw.length) {
    const char = raw[cursor];
    if (
      char === "," ||
      char === "}" ||
      char === "]" ||
      char === " " ||
      char === "\n" ||
      char === "\r" ||
      char === "\t"
    ) {
      break;
    }
    cursor += 1;
  }
  return cursor > start ? cursor : null;
}

function scanJsonObjectMembers(raw: string): JsonObjectMember[] | null {
  let cursor = skipJsonWhitespace(raw, 0);
  if (raw[cursor] !== "{") return null;
  cursor += 1;
  const members: JsonObjectMember[] = [];
  while (cursor < raw.length) {
    cursor = skipJsonWhitespace(raw, cursor);
    if (raw[cursor] === "}") return members;
    const keyStart = cursor;
    const keyEnd = scanJsonStringEnd(raw, keyStart);
    if (keyEnd === null) return null;
    const keyRaw = raw.slice(keyStart, keyEnd);
    let key: unknown;
    try {
      key = JSON.parse(keyRaw);
    } catch {
      return null;
    }
    if (typeof key !== "string") return null;
    cursor = skipJsonWhitespace(raw, keyEnd);
    if (raw[cursor] !== ":") return null;
    const valueStart = skipJsonWhitespace(raw, cursor + 1);
    const valueEnd = scanJsonValueEnd(raw, valueStart);
    if (valueEnd === null) return null;
    members.push({
      key,
      keyRaw,
      memberRaw: raw.slice(keyStart, valueEnd),
      valueRaw: raw.slice(valueStart, valueEnd),
    });
    cursor = skipJsonWhitespace(raw, valueEnd);
    if (raw[cursor] === ",") {
      cursor += 1;
      continue;
    }
    if (raw[cursor] === "}") return members;
    return null;
  }
  return null;
}

function scanJsonArrayValues(raw: string): string[] | null {
  let cursor = skipJsonWhitespace(raw, 0);
  if (raw[cursor] !== "[") return null;
  cursor += 1;
  const values: string[] = [];
  while (cursor < raw.length) {
    cursor = skipJsonWhitespace(raw, cursor);
    if (raw[cursor] === "]") return values;
    const valueEnd = scanJsonValueEnd(raw, cursor);
    if (valueEnd === null) return null;
    values.push(raw.slice(cursor, valueEnd));
    cursor = skipJsonWhitespace(raw, valueEnd);
    if (raw[cursor] === ",") {
      cursor += 1;
      continue;
    }
    if (raw[cursor] === "]") return values;
    return null;
  }
  return null;
}

type JsonDuplicateScanContext =
  | {
      kind: "object";
      phase: "key-or-end" | "colon" | "value" | "comma-or-end";
      keys: Set<string>;
    }
  | {
      kind: "array";
      phase: "value-or-end" | "comma-or-end";
    };

function jsonContainsDuplicateDecodedObjectKey(
  raw: string,
): boolean | null {
  let cursor = 0;
  const stack: JsonDuplicateScanContext[] = [];

  const consumeValue = (): boolean => {
    cursor = skipJsonWhitespace(raw, cursor);
    const first = raw[cursor];
    if (first === "{") {
      cursor += 1;
      stack.push({ kind: "object", phase: "key-or-end", keys: new Set() });
      return true;
    }
    if (first === "[") {
      cursor += 1;
      stack.push({ kind: "array", phase: "value-or-end" });
      return true;
    }
    const valueEnd = scanJsonValueEnd(raw, cursor);
    if (valueEnd === null) return false;
    cursor = valueEnd;
    return true;
  };

  if (!consumeValue()) return null;
  while (stack.length > 0) {
    const context = stack.at(-1)!;
    cursor = skipJsonWhitespace(raw, cursor);
    if (context.kind === "object") {
      if (context.phase === "key-or-end") {
        if (raw[cursor] === "}") {
          cursor += 1;
          stack.pop();
          continue;
        }
        const keyEnd = scanJsonStringEnd(raw, cursor);
        if (keyEnd === null) return null;
        const keyRaw = raw.slice(cursor, keyEnd);
        let key: unknown;
        try {
          key = JSON.parse(keyRaw);
        } catch {
          return null;
        }
        if (typeof key !== "string") return null;
        if (context.keys.has(key)) return true;
        context.keys.add(key);
        cursor = keyEnd;
        context.phase = "colon";
        continue;
      }
      if (context.phase === "colon") {
        if (raw[cursor] !== ":") return null;
        cursor += 1;
        context.phase = "value";
        continue;
      }
      if (context.phase === "value") {
        context.phase = "comma-or-end";
        if (!consumeValue()) return null;
        continue;
      }
      if (raw[cursor] === ",") {
        cursor += 1;
        context.phase = "key-or-end";
        continue;
      }
      if (raw[cursor] === "}") {
        cursor += 1;
        stack.pop();
        continue;
      }
      return null;
    }

    if (context.phase === "value-or-end") {
      if (raw[cursor] === "]") {
        cursor += 1;
        stack.pop();
        continue;
      }
      context.phase = "comma-or-end";
      if (!consumeValue()) return null;
      continue;
    }
    if (raw[cursor] === ",") {
      cursor += 1;
      context.phase = "value-or-end";
      continue;
    }
    if (raw[cursor] === "]") {
      cursor += 1;
      stack.pop();
      continue;
    }
    return null;
  }

  return skipJsonWhitespace(raw, cursor) === raw.length ? false : null;
}

function createOpaqueFutureCareSnapshot(): unknown {
  return {
    doc: {
      dataVersion: Number.POSITIVE_INFINITY,
      recoveryState: "duplicate-json-keys",
    },
    entries: [],
    serverVersion: 0,
  };
}

function captureRuntimeValue(value: unknown): CapturedRuntimeValue {
  return value !== null && typeof value === "object"
    ? { kind: "object", value }
    : { kind: "primitive", value };
}

function captureRuntimeShape(value: unknown): CapturedRuntimeShape | null {
  const root = captureRuntimeValue(value);
  const nodes = new WeakMap<object, CapturedRuntimeNode>();
  if (root.kind === "primitive") return { root, nodes };

  const pending: object[] = [root.value];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (nodes.has(current)) continue;
    try {
      const keys = Object.keys(current);
      const children = keys.map((key) =>
        captureRuntimeValue((current as Record<string, unknown>)[key]),
      );
      nodes.set(current, {
        value: current,
        arrayLength: Array.isArray(current) ? current.length : null,
        keys,
        children,
      });
      for (const child of children) {
        if (child.kind === "object") pending.push(child.value);
      }
    } catch {
      return null;
    }
  }
  return { root, nodes };
}

function runtimeShapeMatches(
  value: unknown,
  captured: CapturedRuntimeShape,
): boolean {
  const matchesCapturedValue = (
    current: unknown,
    expected: CapturedRuntimeValue,
  ): boolean =>
    expected.kind === "object"
      ? current === expected.value
      : Object.is(current, expected.value);

  if (!matchesCapturedValue(value, captured.root)) return false;
  if (captured.root.kind === "primitive") return true;

  const pending: object[] = [captured.root.value];
  const visited = new WeakSet<object>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const expected = captured.nodes.get(current);
    if (!expected) return false;
    try {
      if (
        (Array.isArray(current) ? current.length : null) !==
        expected.arrayLength
      ) {
        return false;
      }
      const keys = Object.keys(current);
      if (
        keys.length !== expected.keys.length ||
        keys.some((key, index) => key !== expected.keys[index])
      ) {
        return false;
      }
      for (let index = 0; index < keys.length; index += 1) {
        const child = (current as Record<string, unknown>)[keys[index]!];
        const expectedChild = expected.children[index]!;
        if (!matchesCapturedValue(child, expectedChild)) return false;
        if (expectedChild.kind === "object") {
          pending.push(expectedChild.value);
        }
      }
    } catch {
      return false;
    }
  }
  return true;
}

type JsonSerializationFrame =
  | { kind: "token"; value: string }
  | { kind: "value"; value: unknown; arrayElement: boolean }
  | { kind: "exit"; value: object; token: "]" | "}" };

function stringifyJsonWithoutRecursion(value: unknown): string | null {
  const output: string[] = [];
  const ancestors = new Set<object>();
  const pending: JsonSerializationFrame[] = [
    { kind: "value", value, arrayElement: false },
  ];
  let operations = 0;
  const maxOperations = 1_000_000;

  while (pending.length > 0) {
    operations += 1;
    if (operations > maxOperations) return null;
    const frame = pending.pop()!;
    if (frame.kind === "token") {
      output.push(frame.value);
      continue;
    }
    if (frame.kind === "exit") {
      ancestors.delete(frame.value);
      output.push(frame.token);
      continue;
    }

    const current = frame.value;
    if (current === null) {
      output.push("null");
      continue;
    }
    const valueType = typeof current;
    if (valueType === "string") {
      output.push(JSON.stringify(current));
      continue;
    }
    if (valueType === "boolean") {
      output.push(current ? "true" : "false");
      continue;
    }
    if (valueType === "number") {
      output.push(Number.isFinite(current) ? String(current) : "null");
      continue;
    }
    if (
      valueType === "undefined" ||
      valueType === "function" ||
      valueType === "symbol"
    ) {
      if (!frame.arrayElement) return null;
      output.push("null");
      continue;
    }
    if (valueType === "bigint" || valueType !== "object") return null;

    const objectValue = current as object;
    if (ancestors.has(objectValue)) return null;
    ancestors.add(objectValue);
    if (Array.isArray(objectValue)) {
      output.push("[");
      pending.push({ kind: "exit", value: objectValue, token: "]" });
      let values: unknown[];
      try {
        values = Array.from(
          { length: objectValue.length },
          (_, index) => objectValue[index],
        );
      } catch {
        return null;
      }
      for (let index = values.length - 1; index >= 0; index -= 1) {
        if (index < values.length - 1) {
          pending.push({ kind: "token", value: "," });
        }
        pending.push({
          kind: "value",
          value: values[index],
          arrayElement: true,
        });
      }
      continue;
    }

    let entries: Array<[string, unknown]>;
    try {
      entries = Object.keys(objectValue).flatMap((key) => {
        const child = (objectValue as Record<string, unknown>)[key];
        const childType = typeof child;
        return childType === "undefined" ||
          childType === "function" ||
          childType === "symbol"
          ? []
          : [[key, child] as [string, unknown]];
      });
    } catch {
      return null;
    }
    output.push("{");
    pending.push({ kind: "exit", value: objectValue, token: "}" });
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (index < entries.length - 1) {
        pending.push({ kind: "token", value: "," });
      }
      const [key, child] = entries[index]!;
      pending.push({ kind: "value", value: child, arrayElement: false });
      pending.push({ kind: "token", value: `${JSON.stringify(key)}:` });
    }
  }

  return output.join("");
}

function normalizedJson(value: unknown): string | null {
  try {
    const normalized = JSON.stringify(value);
    return typeof normalized === "string" ? normalized : null;
  } catch {
    return stringifyJsonWithoutRecursion(value);
  }
}

function preserveQuarantineRaw(
  vault: CareIdentityVault,
  item: CareIdentityVault["quarantine"][number],
  raw: string,
): void {
  const runtimeShape = captureRuntimeShape(item);
  if (!runtimeShape) return;
  rawStateFor(vault).quarantine.set(item, { raw, runtimeShape });
}

function preserveDuplicateMemberAsQuarantine(
  vault: CareIdentityVault,
  member: JsonObjectMember,
  reason: string,
): void {
  let duplicateMember: unknown;
  try {
    duplicateMember = JSON.parse(`{${member.memberRaw}}`);
  } catch {
    duplicateMember = { raw: member.memberRaw };
  }
  const quarantineItem = {
    reason,
    snapshot: { duplicateMember },
  };
  vault.quarantine.push(quarantineItem);
  preserveQuarantineRaw(
    vault,
    quarantineItem,
    `{"reason":${JSON.stringify(reason)},"snapshot":{"duplicateMember":{${member.memberRaw}}}}`,
  );
}

export function createCareIdentityVault(): CareIdentityVault {
  const vault: CareIdentityVault = {
    format: CARE_IDENTITY_VAULT_FORMAT,
    slots: {},
    quarantine: [],
  };
  rawStateByVault.set(vault, createRawState());
  return vault;
}

export function parseCareIdentityVault(
  raw: string | null,
  currentDataScope: string,
): CareIdentityVaultParseResult {
  if (!raw) {
    return {
      vault: createCareIdentityVault(),
      migrated: false,
      corruptRaw: null,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      vault: createCareIdentityVault(),
      migrated: false,
      corruptRaw: raw,
    };
  }

  if (
    isObject(parsed) &&
    parsed.format === CARE_IDENTITY_VAULT_FORMAT &&
    isObject(parsed.slots) &&
    Array.isArray(parsed.quarantine)
  ) {
    const vault = createCareIdentityVault();
    const topLevelMembers = scanJsonObjectMembers(raw) ?? [];
    const knownTopLevelKeys = new Set(["format", "slots", "quarantine"]);
    const topLevelMembersByKey = new Map<string, JsonObjectMember[]>();
    for (const member of topLevelMembers) {
      topLevelMembersByKey.set(member.key, [
        ...(topLevelMembersByKey.get(member.key) ?? []),
        member,
      ]);
      if (!knownTopLevelKeys.has(member.key)) {
        rawStateFor(vault).opaqueTopLevelMembers.push(member.memberRaw);
      }
    }
    for (const [key, members] of topLevelMembersByKey) {
      if (!knownTopLevelKeys.has(key)) continue;
      for (const duplicate of members.slice(0, -1)) {
        preserveDuplicateMemberAsQuarantine(
          vault,
          duplicate,
          `Duplicate top-level ${key} member preserved without selecting ambiguous earlier data.`,
        );
      }
    }
    const rawSlotsValue = topLevelMembersByKey.get("slots")?.at(-1)?.valueRaw;
    const rawQuarantineValue = topLevelMembersByKey
      .get("quarantine")
      ?.at(-1)?.valueRaw;
    const rawSlotMembers = rawSlotsValue
      ? scanJsonObjectMembers(rawSlotsValue)
      : null;
    const rawSlotsByScope = new Map<string, JsonObjectMember[]>();
    for (const member of rawSlotMembers ?? []) {
      rawSlotsByScope.set(member.key, [
        ...(rawSlotsByScope.get(member.key) ?? []),
        member,
      ]);
    }
    for (const [scope, snapshot] of Object.entries(parsed.slots)) {
      const preserved = rawSlotsByScope.get(scope)?.at(-1);
      const hasUnresolvedDuplicateKeys = preserved
        ? jsonContainsDuplicateDecodedObjectKey(preserved.valueRaw) !== false
        : true;
      if (isAttributedCareDataScope(scope) && hasUnresolvedDuplicateKeys) {
        const opaqueSnapshot = createOpaqueFutureCareSnapshot();
        vault.slots[scope] = opaqueSnapshot;
        const runtimeShape = captureRuntimeShape(opaqueSnapshot);
        if (preserved && runtimeShape) {
          rawStateFor(vault).slots.set(scope, {
            memberRaw: preserved.memberRaw,
            raw: preserved.valueRaw,
            runtimeShape,
          });
        }
        continue;
      }
      const supportedSnapshot = isLegacyCareSnapshot(snapshot);
      const recognizableFutureSnapshot =
        isRecognizableFutureCareSnapshot(snapshot);
      if (
        isAttributedCareDataScope(scope) &&
        (supportedSnapshot || recognizableFutureSnapshot)
      ) {
        vault.slots[scope] = snapshot;
        const runtimeShape = captureRuntimeShape(snapshot);
        if (preserved && runtimeShape) {
          rawStateFor(vault).slots.set(scope, {
            memberRaw: preserved.memberRaw,
            raw: preserved.valueRaw,
            runtimeShape,
          });
        }
      } else {
        const reason = supportedSnapshot || recognizableFutureSnapshot
          ? "Legacy user-only identity slot preserved without guessing a household."
          : "Malformed identity slot preserved during Care vault recovery.";
        const quarantineItem = {
          reason,
          snapshot: { dataScope: scope, snapshot },
        };
        vault.quarantine.push(quarantineItem);
        if (preserved) {
          preserveQuarantineRaw(
            vault,
            quarantineItem,
            `{"reason":${JSON.stringify(reason)},"snapshot":{"dataScope":${preserved.keyRaw},"snapshot":${preserved.valueRaw}}}`,
          );
        }
      }
    }
    for (const members of rawSlotsByScope.values()) {
      for (const duplicate of members.slice(0, -1)) {
        preserveDuplicateMemberAsQuarantine(
          vault,
          duplicate,
          "Duplicate identity slot member preserved without selecting ambiguous earlier data.",
        );
      }
    }
    const rawQuarantineItems = rawQuarantineValue
      ? scanJsonArrayValues(rawQuarantineValue)
      : null;
    parsed.quarantine.forEach((candidate, index) => {
      const quarantineItem =
        isObject(candidate) && typeof candidate.reason === "string"
          ? {
              reason: candidate.reason,
              snapshot: candidate.snapshot,
            }
          : {
              reason:
                "Unsupported quarantine evidence preserved without interpretation.",
              snapshot: candidate,
            };
      vault.quarantine.push(quarantineItem);
      const preserved = rawQuarantineItems?.[index];
      if (preserved) {
        preserveQuarantineRaw(vault, quarantineItem, preserved);
      }
    });
    return { vault, migrated: false, corruptRaw: null };
  }

  if (
    isLegacyCareSnapshot(parsed) ||
    isRecognizableFutureCareSnapshot(parsed)
  ) {
    const vault = createCareIdentityVault();
    if (currentDataScope === "local") {
      const selectedSnapshot =
        jsonContainsDuplicateDecodedObjectKey(raw) === false
          ? parsed
          : createOpaqueFutureCareSnapshot();
      vault.slots.local = selectedSnapshot;
      const runtimeShape = captureRuntimeShape(selectedSnapshot);
      if (runtimeShape) {
        rawStateFor(vault).slots.set("local", {
          memberRaw: `"local":${raw}`,
          raw,
          runtimeShape,
        });
      }
    } else {
      const reason =
        "Unattributed pre-identity Care snapshot preserved during signed-in migration.";
      const quarantineItem = {
        reason,
        snapshot: parsed,
      };
      vault.quarantine.push(quarantineItem);
      preserveQuarantineRaw(
        vault,
        quarantineItem,
        `{"reason":${JSON.stringify(reason)},"snapshot":${raw}}`,
      );
    }
    return { vault, migrated: true, corruptRaw: null };
  }

  return {
    vault: createCareIdentityVault(),
    migrated: false,
    corruptRaw: raw,
  };
}

export function readCareIdentitySlot<T>(
  vault: CareIdentityVault,
  dataScope: string,
): T | null {
  const snapshot = vault.slots[dataScope];
  return snapshot === undefined ? null : (snapshot as T);
}

/**
 * Returns the selected slot's original JSON value when it is still untouched.
 * Future-schema protection uses this instead of JSON.stringify so even values
 * the current JavaScript runtime cannot represent retain their exact bytes.
 */
export function readCareIdentitySlotRaw(
  vault: CareIdentityVault,
  dataScope: string,
): string | null {
  const snapshot = vault.slots[dataScope];
  if (snapshot === undefined) return null;
  const preserved = rawStateFor(vault).slots.get(dataScope);
  if (preserved && runtimeShapeMatches(snapshot, preserved.runtimeShape)) {
    return preserved.raw;
  }
  return normalizedJson(snapshot);
}

export function writeCareIdentitySlot<T>(
  vault: CareIdentityVault,
  dataScope: string,
  snapshot: T,
): void {
  if (!dataScope.trim()) {
    throw new Error("A Care data scope is required.");
  }
  rawStateFor(vault).slots.delete(dataScope);
  vault.slots[dataScope] = snapshot;
}

export function serializeCareIdentityVault(vault: CareIdentityVault): string {
  const rawState = rawStateFor(vault);
  const slots = Object.entries(vault.slots).map(([scope, snapshot]) => {
    const preserved = rawState.slots.get(scope);
    if (preserved && runtimeShapeMatches(snapshot, preserved.runtimeShape)) {
      return preserved.memberRaw;
    }
    const normalized = normalizedJson(snapshot) ?? "null";
    return `${JSON.stringify(scope)}:${normalized}`;
  });
  const quarantine = vault.quarantine.map((item) => {
    const preserved = rawState.quarantine.get(item);
    if (preserved && runtimeShapeMatches(item, preserved.runtimeShape)) {
      return preserved.raw;
    }
    return normalizedJson(item) ?? "null";
  });
  return `{${[
    `"format":${JSON.stringify(vault.format)}`,
    `"slots":{${slots.join(",")}}`,
    `"quarantine":[${quarantine.join(",")}]`,
    ...rawState.opaqueTopLevelMembers,
  ].join(",")}}`;
}

function encodeCleanupRecord(dataScope: string, entryId: string): string {
  return `${CLEANUP_PREFIX}${encodeURIComponent(dataScope)}:${encodeURIComponent(entryId)}`;
}

function decodeCleanupRecord(
  value: string,
): { dataScope: string; entryId: string } | null {
  if (!value.startsWith(CLEANUP_PREFIX)) return null;
  const encoded = value.slice(CLEANUP_PREFIX.length);
  const separator = encoded.indexOf(":");
  if (separator <= 0 || separator === encoded.length - 1) return null;
  try {
    const dataScope = decodeURIComponent(encoded.slice(0, separator));
    const entryId = decodeURIComponent(encoded.slice(separator + 1));
    return dataScope && entryId ? { dataScope, entryId } : null;
  } catch {
    return null;
  }
}

export function encodeCareCleanupLedger(
  records: readonly { dataScope: string; entryId: string }[],
): string {
  return JSON.stringify([
    ...new Set(
      records
        .filter(
          ({ dataScope, entryId }) =>
            dataScope.trim().length > 0 && entryId.trim().length > 0,
        )
        .map(({ dataScope, entryId }) =>
          encodeCleanupRecord(dataScope, entryId),
        ),
    ),
  ]);
}

export function decodeCareCleanupLedger(
  raw: string | null,
  currentDataScope: string,
): { entryIds: string[]; quarantined: string[] } {
  if (!raw) return { entryIds: [], quarantined: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { entryIds: [], quarantined: [raw] };
  }
  if (!Array.isArray(parsed)) {
    return { entryIds: [], quarantined: [raw] };
  }
  const entryIds: string[] = [];
  const quarantined: string[] = [];
  for (const candidate of parsed) {
    if (typeof candidate !== "string") continue;
    const decoded = decodeCleanupRecord(candidate);
    if (!decoded) {
      quarantined.push(candidate);
    } else if (decoded.dataScope === currentDataScope) {
      entryIds.push(decoded.entryId);
    }
  }
  return {
    entryIds: [...new Set(entryIds)],
    quarantined: [...new Set(quarantined)],
  };
}

export function replaceCareCleanupLedgerScope(
  existingRaw: string | null,
  dataScope: string,
  entryIds: readonly string[],
): string {
  let existing: string[] = [];
  try {
    const parsed = existingRaw ? JSON.parse(existingRaw) : [];
    if (Array.isArray(parsed)) {
      existing = parsed.filter(
        (candidate): candidate is string => typeof candidate === "string",
      );
    }
  } catch {
    existing = existingRaw ? [existingRaw] : [];
  }
  const retained = existing.filter((candidate) => {
    const decoded = decodeCleanupRecord(candidate);
    return !decoded || decoded.dataScope !== dataScope;
  });
  return JSON.stringify([
    ...new Set([
      ...retained,
      ...entryIds.map((entryId) => encodeCleanupRecord(dataScope, entryId)),
    ]),
  ]);
}

export function scopeCareCleanupEntryIds(
  dataScope: string,
  entryIds: readonly string[],
): string[] {
  return [...new Set(entryIds)].map((entryId) =>
    encodeCleanupRecord(dataScope, entryId),
  );
}
