import assert from "node:assert/strict";
import test from "node:test";

import {
  createCareIdentityVault,
  decodeCareCleanupLedger,
  encodeCareCleanupLedger,
  parseCareIdentityVault,
  readCareIdentitySlot,
  readCareIdentitySlotRaw,
  serializeCareIdentityVault,
  writeCareIdentitySlot,
} from "./careIdentityStorage.ts";

const SCOPE_A = `care-v2:${JSON.stringify(["user-a", "house-a"])}`;
const SCOPE_B = `care-v2:${JSON.stringify(["user-a", "house-b"])}`;

test("identity-scoped care snapshots isolate two households for the same user", () => {
  const vault = createCareIdentityVault();
  writeCareIdentitySlot(vault, SCOPE_A, {
    doc: { owner: "house-a" },
    entries: ["a-entry"],
    serverVersion: 1,
  });
  writeCareIdentitySlot(vault, SCOPE_B, {
    doc: { owner: "house-b" },
    entries: ["b-entry"],
    serverVersion: 2,
  });

  const reparsed = parseCareIdentityVault(
    serializeCareIdentityVault(vault),
    SCOPE_B,
  );
  assert.deepEqual(readCareIdentitySlot(reparsed.vault, SCOPE_B), {
    doc: { owner: "house-b" },
    entries: ["b-entry"],
    serverVersion: 2,
  });
  assert.deepEqual(readCareIdentitySlot(reparsed.vault, SCOPE_A), {
    doc: { owner: "house-a" },
    entries: ["a-entry"],
    serverVersion: 1,
  });
});

test("an unattributed legacy snapshot is quarantined for a signed-in user instead of displayed or discarded", () => {
  const legacy = JSON.stringify({
    doc: { owner: "unknown-old-user" },
    entries: ["private-entry"],
    serverVersion: 7,
  });
  const parsed = parseCareIdentityVault(legacy, SCOPE_B);

  assert.equal(readCareIdentitySlot(parsed.vault, SCOPE_B), null);
  assert.equal(parsed.vault.quarantine.length, 1);
  assert.deepEqual(parsed.vault.quarantine[0]?.snapshot, JSON.parse(legacy));
  assert.match(parsed.vault.quarantine[0]?.reason ?? "", /unattributed/i);
});

test("a legacy user-only vault slot is quarantined instead of guessed into a household", () => {
  const snapshot = {
    doc: { owner: "old-user-scope" },
    entries: ["private-entry"],
    serverVersion: 7,
  };
  const parsed = parseCareIdentityVault(
    JSON.stringify({
      format: "woofwatcher.care.identity-v1",
      slots: { "user:user-a": snapshot },
      quarantine: [],
    }),
    SCOPE_A,
  );

  assert.equal(readCareIdentitySlot(parsed.vault, SCOPE_A), null);
  assert.equal(readCareIdentitySlot(parsed.vault, "user:user-a"), null);
  assert.deepEqual(parsed.vault.quarantine[0]?.snapshot, {
    dataScope: "user:user-a",
    snapshot,
  });
  assert.match(
    parsed.vault.quarantine[0]?.reason ?? "",
    /without guessing a household/i,
  );
});

test("legacy local-only data stays usable in local mode", () => {
  const legacy = JSON.stringify({
    doc: { owner: "local" },
    entries: ["local-entry"],
    serverVersion: 0,
  });
  const parsed = parseCareIdentityVault(legacy, "local");

  assert.deepEqual(readCareIdentitySlot(parsed.vault, "local"), {
    doc: { owner: "local" },
    entries: ["local-entry"],
    serverVersion: 0,
  });
  assert.equal(parsed.vault.quarantine.length, 0);
});

test("cleanup ledgers are household-scoped so B cannot retry A deletes", () => {
  const stored = encodeCareCleanupLedger([
    { dataScope: SCOPE_A, entryId: "a-server" },
    { dataScope: SCOPE_A, entryId: "temp_a" },
    { dataScope: SCOPE_B, entryId: "b-server" },
  ]);

  assert.deepEqual(decodeCareCleanupLedger(stored, SCOPE_A), {
    entryIds: ["a-server", "temp_a"],
    quarantined: [],
  });
  assert.deepEqual(decodeCareCleanupLedger(stored, SCOPE_B), {
    entryIds: ["b-server"],
    quarantined: [],
  });
});

test("legacy unscoped cleanup ids are quarantined rather than run under a different signed-in user", () => {
  assert.deepEqual(
    decodeCareCleanupLedger(JSON.stringify(["a-server", "temp_a"]), SCOPE_B),
    {
      entryIds: [],
      quarantined: ["a-server", "temp_a"],
    },
  );
});

test("a malformed slot inside an otherwise valid identity vault is quarantined instead of silently discarded", () => {
  const malformedSnapshot = {
    doc: { owner: "user-a" },
    entries: "not-an-array",
    serverVersion: 4,
  };
  const raw = JSON.stringify({
    format: "woofwatcher.care.identity-v1",
    slots: {
      [SCOPE_A]: malformedSnapshot,
      [SCOPE_B]: {
        doc: { owner: "user-b" },
        entries: [],
        serverVersion: 2,
      },
    },
    quarantine: [],
  });

  const parsed = parseCareIdentityVault(raw, SCOPE_B);

  assert.equal(readCareIdentitySlot(parsed.vault, SCOPE_A), null);
  assert.deepEqual(readCareIdentitySlot(parsed.vault, SCOPE_B), {
    doc: { owner: "user-b" },
    entries: [],
    serverVersion: 2,
  });
  assert.equal(parsed.vault.quarantine.length, 1);
  assert.deepEqual(parsed.vault.quarantine[0]?.snapshot, {
    dataScope: SCOPE_A,
    snapshot: malformedSnapshot,
  });
  assert.match(
    parsed.vault.quarantine[0]?.reason ?? "",
    /malformed identity slot/i,
  );
});

test("updating a supported identity preserves every byte of an unselected future-schema slot", () => {
  const futureSlotRaw =
    '{"doc":{"dataVersion":999,"futureCounter":9007199254740993,"nested":{"retain":"exact"}},"entries":[],"serverVersion":41}';
  const supportedSlot = {
    doc: { owner: "house-b" },
    entries: ["before"],
    serverVersion: 2,
  };
  const futureMemberRaw = `${JSON.stringify(SCOPE_A)} \n :\t${futureSlotRaw}`;
  const raw = `{"format":"woofwatcher.care.identity-v1","slots":{${futureMemberRaw},${JSON.stringify(SCOPE_B)}:${JSON.stringify(supportedSlot)}},"quarantine":[]}`;

  const parsed = parseCareIdentityVault(raw, SCOPE_B);
  assert.equal(readCareIdentitySlotRaw(parsed.vault, SCOPE_A), futureSlotRaw);

  writeCareIdentitySlot(parsed.vault, SCOPE_B, {
    ...supportedSlot,
    entries: ["after"],
    serverVersion: 3,
  });
  parsed.vault.quarantine.push({
    reason: "A supported-slot recovery record.",
    snapshot: { source: SCOPE_B },
  });

  const persisted = serializeCareIdentityVault(parsed.vault);
  assert.ok(
    persisted.includes(futureMemberRaw),
    "the future slot member must not pass through JSON.parse/JSON.stringify",
  );
  assert.equal(
    persisted.includes("9007199254740992"),
    false,
    "a rounded IEEE-754 rendering must never replace the opaque source bytes",
  );

  const relaunched = parseCareIdentityVault(persisted, SCOPE_B);
  assert.equal(readCareIdentitySlotRaw(relaunched.vault, SCOPE_A), futureSlotRaw);
  assert.deepEqual(readCareIdentitySlot(relaunched.vault, SCOPE_B), {
    ...supportedSlot,
    entries: ["after"],
    serverVersion: 3,
  });
});

test("local identity rewrites preserve an unselected future-schema signed-in slot exactly", () => {
  const futureSlotRaw =
    '{ "doc" : { "dataVersion" : 500, "opaqueInteger" : 9007199254740993 }, "entries" : [ ], "serverVersion" : 8 }';
  const localSlot = {
    doc: { owner: "local" },
    entries: ["local-before"],
    serverVersion: 0,
  };
  const raw = `{"format":"woofwatcher.care.identity-v1","slots":{${JSON.stringify(SCOPE_A)}:${futureSlotRaw},"local":${JSON.stringify(localSlot)}},"quarantine":[]}`;

  const parsed = parseCareIdentityVault(raw, "local");
  writeCareIdentitySlot(parsed.vault, "local", {
    ...localSlot,
    entries: ["local-after"],
  });

  const persisted = serializeCareIdentityVault(parsed.vault);
  assert.ok(persisted.includes(`${JSON.stringify(SCOPE_A)}:${futureSlotRaw}`));
  const relaunched = parseCareIdentityVault(persisted, "local");
  assert.equal(readCareIdentitySlotRaw(relaunched.vault, SCOPE_A), futureSlotRaw);
  assert.deepEqual(readCareIdentitySlot(relaunched.vault, "local"), {
    ...localSlot,
    entries: ["local-after"],
  });
});

test("selected future-schema and quarantined unsupported values retain their exact raw JSON", () => {
  const selectedFutureRaw =
    '{"doc":{"dataVersion":999,"selectedCounter":9007199254740993},"entries":[],"serverVersion":4}';
  const unsupportedRaw =
    '{"doc":{"unsupportedCounter":9007199254740995},"entries":"not-an-array","serverVersion":7}';
  const existingQuarantineRaw =
    '{"reason":"future recovery evidence","snapshot":{"opaqueCounter":9007199254740997}}';
  const raw = `{"format":"woofwatcher.care.identity-v1","slots":{${JSON.stringify(SCOPE_A)}:${selectedFutureRaw},${JSON.stringify(SCOPE_B)}:${unsupportedRaw}},"quarantine":[${existingQuarantineRaw}]}`;

  const parsed = parseCareIdentityVault(raw, SCOPE_A);
  assert.equal(readCareIdentitySlotRaw(parsed.vault, SCOPE_A), selectedFutureRaw);
  assert.equal(readCareIdentitySlot(parsed.vault, SCOPE_B), null);

  const persisted = serializeCareIdentityVault(parsed.vault);
  assert.ok(persisted.includes(`${JSON.stringify(SCOPE_A)}:${selectedFutureRaw}`));
  assert.ok(
    persisted.includes(unsupportedRaw),
    "new quarantine wrapping must embed the unsupported snapshot's original raw bytes",
  );
  assert.ok(
    persisted.includes(existingQuarantineRaw),
    "pre-existing quarantine evidence must also stay opaque",
  );

  const relaunched = parseCareIdentityVault(persisted, SCOPE_A);
  assert.equal(
    readCareIdentitySlotRaw(relaunched.vault, SCOPE_A),
    selectedFutureRaw,
  );
  const persistedAgain = serializeCareIdentityVault(relaunched.vault);
  assert.ok(persistedAgain.includes(unsupportedRaw));
  assert.ok(persistedAgain.includes(existingQuarantineRaw));
});

test("a selected future document stays addressable and byte-exact when its envelope no longer matches this client", () => {
  const divergentFutureRaw =
    '{"doc":{"dataVersion":999,"futureCounter":9007199254740993},"entries":{"futureIndex":"opaque"},"serverVersion":{"futureClock":41},"futureEnvelope":{"codec":7}}';
  const malformedCurrentRaw =
    '{"doc":{"dataVersion":1},"entries":{"not":"an array"},"serverVersion":4}';
  const raw = `{"format":"woofwatcher.care.identity-v1","slots":{${JSON.stringify(SCOPE_A)}:${divergentFutureRaw},${JSON.stringify(SCOPE_B)}:${malformedCurrentRaw}},"quarantine":[]}`;

  const parsed = parseCareIdentityVault(raw, SCOPE_A);
  const selected = readCareIdentitySlot<{
    doc?: { dataVersion?: unknown };
  }>(parsed.vault, SCOPE_A);
  assert.equal(selected?.doc?.dataVersion, 999);
  assert.equal(
    readCareIdentitySlotRaw(parsed.vault, SCOPE_A),
    divergentFutureRaw,
  );
  assert.equal(
    readCareIdentitySlot(parsed.vault, SCOPE_B),
    null,
    "a malformed current-schema envelope must still fail closed",
  );

  const persisted = serializeCareIdentityVault(parsed.vault);
  assert.ok(
    persisted.includes(
      `${JSON.stringify(SCOPE_A)}:${divergentFutureRaw}`,
    ),
  );
  assert.equal(persisted.includes("9007199254740992"), false);
  assert.ok(
    persisted.includes(malformedCurrentRaw),
    "the malformed current snapshot remains preserved inside quarantine",
  );

  const relaunched = parseCareIdentityVault(persisted, SCOPE_A);
  assert.equal(
    readCareIdentitySlotRaw(relaunched.vault, SCOPE_A),
    divergentFutureRaw,
  );
  assert.equal(readCareIdentitySlot(relaunched.vault, SCOPE_B), null);
});

test("an overflowing future dataVersion remains a selected opaque slot through parse and serialize", () => {
  const overflowFutureRaw =
    '{"doc":{"dataVersion":1e400,"futureCounter":9007199254740993},"entries":"future-envelope","serverVersion":null,"futureMember":[1,2,3]}';
  const raw = `{"format":"woofwatcher.care.identity-v1","slots":{${JSON.stringify(SCOPE_A)}:${overflowFutureRaw}},"quarantine":[]}`;

  const parsed = parseCareIdentityVault(raw, SCOPE_A);
  const selected = readCareIdentitySlot<{
    doc?: { dataVersion?: unknown };
  }>(parsed.vault, SCOPE_A);
  assert.equal(selected?.doc?.dataVersion, Number.POSITIVE_INFINITY);
  assert.equal(
    readCareIdentitySlotRaw(parsed.vault, SCOPE_A),
    overflowFutureRaw,
  );

  const persisted = serializeCareIdentityVault(parsed.vault);
  assert.ok(
    persisted.includes(`${JSON.stringify(SCOPE_A)}:${overflowFutureRaw}`),
  );
  assert.equal(persisted.includes("null"), true);
  assert.equal(persisted.includes("9007199254740992"), false);

  const relaunched = parseCareIdentityVault(persisted, SCOPE_A);
  assert.equal(
    readCareIdentitySlotRaw(relaunched.vault, SCOPE_A),
    overflowFutureRaw,
  );
});

test("a top-level legacy future snapshot with an evolved envelope is local-only and byte-exact", () => {
  const divergentFutureRaw =
    '{"doc":{"dataVersion":999,"futureCounter":9007199254740993},"entries":{"futureIndex":"opaque"},"serverVersion":{"futureClock":41},"futureEnvelope":{"codec":7}}';

  const local = parseCareIdentityVault(divergentFutureRaw, "local");
  assert.equal(local.corruptRaw, null);
  assert.equal(local.migrated, true);
  assert.equal(
    readCareIdentitySlot<{
      doc?: { dataVersion?: unknown };
    }>(local.vault, "local")?.doc?.dataVersion,
    999,
  );
  assert.equal(
    readCareIdentitySlotRaw(local.vault, "local"),
    divergentFutureRaw,
  );
  assert.ok(
    serializeCareIdentityVault(local.vault).includes(
      `"local":${divergentFutureRaw}`,
    ),
  );

  const signedIn = parseCareIdentityVault(divergentFutureRaw, SCOPE_A);
  assert.equal(signedIn.corruptRaw, null);
  assert.equal(readCareIdentitySlot(signedIn.vault, SCOPE_A), null);
  assert.equal(signedIn.vault.quarantine.length, 1);
  assert.ok(
    serializeCareIdentityVault(signedIn.vault).includes(
      `"snapshot":${divergentFutureRaw}`,
    ),
  );
});

test("a top-level legacy 1e400 version stays local future evidence while malformed current data stays corrupt", () => {
  const overflowFutureRaw =
    '{"doc":{"dataVersion":1e400,"futureCounter":9007199254740993},"entries":"future-envelope","serverVersion":null}';
  const local = parseCareIdentityVault(overflowFutureRaw, "local");
  assert.equal(
    readCareIdentitySlot<{
      doc?: { dataVersion?: unknown };
    }>(local.vault, "local")?.doc?.dataVersion,
    Number.POSITIVE_INFINITY,
  );
  assert.equal(
    readCareIdentitySlotRaw(local.vault, "local"),
    overflowFutureRaw,
  );

  const signedIn = parseCareIdentityVault(overflowFutureRaw, SCOPE_A);
  assert.equal(readCareIdentitySlot(signedIn.vault, SCOPE_A), null);
  assert.equal(signedIn.corruptRaw, null);
  assert.ok(
    serializeCareIdentityVault(signedIn.vault).includes(
      `"snapshot":${overflowFutureRaw}`,
    ),
  );

  const malformedCurrentRaw =
    '{"doc":{"dataVersion":1},"entries":"not-an-array","serverVersion":0}';
  const malformedCurrent = parseCareIdentityVault(
    malformedCurrentRaw,
    "local",
  );
  assert.equal(readCareIdentitySlot(malformedCurrent.vault, "local"), null);
  assert.equal(malformedCurrent.corruptRaw, malformedCurrentRaw);
});

test("unknown and future quarantine members survive parse and rewrite byte-exact", () => {
  const opaqueNumber = "9007199254740993";
  const futureObject =
    '{"futureReason":{"code":7},"snapshot":{"opaqueCounter":9007199254740995},"futureMember":true}';
  const futureReasonType =
    '{"reason":{"localized":"future"},"snapshot":[1,2,3],"opaqueCounter":9007199254740997}';
  const knownFutureExtended =
    '{"reason":"recognized evidence","snapshot":{"safe":true},"futureCounter":9007199254740999}';
  const raw = `{"format":"woofwatcher.care.identity-v1","slots":{},"quarantine":[${opaqueNumber},${futureObject},${futureReasonType},${knownFutureExtended}]}`;

  const parsed = parseCareIdentityVault(raw, "local");
  assert.equal(
    parsed.vault.quarantine.length,
    4,
    "unsupported quarantine evidence must remain represented at runtime",
  );
  parsed.vault.quarantine.push({
    reason: "Current client evidence",
    snapshot: { retained: true },
  });

  const persisted = serializeCareIdentityVault(parsed.vault);
  for (const opaqueMember of [
    opaqueNumber,
    futureObject,
    futureReasonType,
    knownFutureExtended,
  ]) {
    assert.ok(
      persisted.includes(opaqueMember),
      `missing opaque quarantine member ${opaqueMember}`,
    );
  }
  assert.equal(persisted.includes("9007199254740992"), false);
  assert.equal(persisted.includes("9007199254740994"), false);
  assert.equal(persisted.includes("9007199254740996"), false);
  assert.equal(persisted.includes("9007199254741000"), false);

  const relaunched = parseCareIdentityVault(persisted, "local");
  assert.equal(relaunched.vault.quarantine.length, 5);
  const persistedAgain = serializeCareIdentityVault(relaunched.vault);
  for (const opaqueMember of [
    opaqueNumber,
    futureObject,
    futureReasonType,
    knownFutureExtended,
  ]) {
    assert.ok(persistedAgain.includes(opaqueMember));
  }
});

test("duplicate decoded scope members preserve the earlier opaque member as quarantine evidence", () => {
  const earlierFutureRaw =
    '{"doc":{"dataVersion":999,"opaqueCounter":9007199254740993},"entries":{"future":"shape"},"serverVersion":null}';
  const selectedSupported = {
    doc: { dataVersion: 1, owner: "last-member-wins" },
    entries: [],
    serverVersion: 4,
  };
  const supportedB = {
    doc: { dataVersion: 1, owner: "house-b" },
    entries: [],
    serverVersion: 2,
  };
  const raw = `{"format":"woofwatcher.care.identity-v1","slots":{${JSON.stringify(SCOPE_A)}:${earlierFutureRaw},${JSON.stringify(SCOPE_A)}:${JSON.stringify(selectedSupported)},${JSON.stringify(SCOPE_B)}:${JSON.stringify(supportedB)}},"quarantine":[]}`;

  const parsed = parseCareIdentityVault(raw, SCOPE_A);
  assert.deepEqual(
    readCareIdentitySlot(parsed.vault, SCOPE_A),
    selectedSupported,
  );
  assert.equal(parsed.vault.quarantine.length, 1);
  assert.match(parsed.vault.quarantine[0]?.reason ?? "", /duplicate/i);

  writeCareIdentitySlot(parsed.vault, SCOPE_B, {
    ...supportedB,
    serverVersion: 3,
  });
  const persisted = serializeCareIdentityVault(parsed.vault);
  assert.ok(
    persisted.includes(earlierFutureRaw),
    "the earlier duplicate's exact value must survive outside active slots",
  );
  assert.equal(persisted.includes("9007199254740992"), false);

  const relaunched = parseCareIdentityVault(persisted, SCOPE_A);
  assert.deepEqual(
    readCareIdentitySlot(relaunched.vault, SCOPE_A),
    selectedSupported,
  );
  assert.equal(relaunched.vault.quarantine.length, 1);
  assert.ok(serializeCareIdentityVault(relaunched.vault).includes(earlierFutureRaw));
});

test("direct replacement or mutation cannot resurrect a lossy preserved raw slot", () => {
  const unsafeIntegerRaw =
    '{"doc":{"dataVersion":999,"opaqueCounter":9007199254740993},"entries":[],"serverVersion":4}';
  const unsafeVaultRaw = `{"format":"woofwatcher.care.identity-v1","slots":{${JSON.stringify(SCOPE_A)}:${unsafeIntegerRaw}},"quarantine":[]}`;
  const replaced = parseCareIdentityVault(unsafeVaultRaw, SCOPE_A).vault;
  replaced.slots[SCOPE_A] = {
    doc: { dataVersion: 999, opaqueCounter: 9007199254740992 },
    entries: [],
    serverVersion: 4,
  };
  const replacedRaw = serializeCareIdentityVault(replaced);
  assert.equal(replacedRaw.includes("9007199254740993"), false);
  assert.ok(replacedRaw.includes("9007199254740992"));

  const overflowRaw =
    '{"doc":{"dataVersion":1e400,"futureMember":{"keep":true}},"entries":[],"serverVersion":4}';
  const overflowVaultRaw = `{"format":"woofwatcher.care.identity-v1","slots":{${JSON.stringify(SCOPE_A)}:${overflowRaw}},"quarantine":[]}`;
  const mutated = parseCareIdentityVault(overflowVaultRaw, SCOPE_A).vault;
  const selected = readCareIdentitySlot<{
    doc: { dataVersion: number | null; futureMember: object };
  }>(mutated, SCOPE_A);
  assert.ok(selected);
  selected.doc.dataVersion = null;
  selected.doc.futureMember = { keep: true };
  const mutatedRaw = serializeCareIdentityVault(mutated);
  assert.equal(mutatedRaw.includes("1e400"), false);
  assert.ok(mutatedRaw.includes('"dataVersion":null'));
});

test("a deeply nested unselected future slot never blocks a supported identity rewrite", () => {
  let nested = '"leaf"';
  for (let depth = 0; depth < 5_000; depth += 1) {
    nested = `{"next":${nested}}`;
  }
  const deepFutureRaw =
    `{"doc":{"dataVersion":999,"deep":${nested}},"entries":{"future":"shape"},"serverVersion":null}`;
  const supported = {
    doc: { dataVersion: 1, owner: "house-b" },
    entries: [],
    serverVersion: 1,
  };
  const raw = `{"format":"woofwatcher.care.identity-v1","slots":{${JSON.stringify(SCOPE_A)}:${deepFutureRaw},${JSON.stringify(SCOPE_B)}:${JSON.stringify(supported)}},"quarantine":[]}`;

  const parsed = parseCareIdentityVault(raw, SCOPE_B);
  writeCareIdentitySlot(parsed.vault, SCOPE_B, {
    ...supported,
    serverVersion: 2,
  });
  let persisted = "";
  assert.doesNotThrow(() => {
    persisted = serializeCareIdentityVault(parsed.vault);
  });
  assert.ok(persisted.includes(`${JSON.stringify(SCOPE_A)}:${deepFutureRaw}`));

  const relaunched = parseCareIdentityVault(persisted, SCOPE_B);
  assert.equal(
    readCareIdentitySlotRaw(relaunched.vault, SCOPE_A),
    deepFutureRaw,
  );
  assert.deepEqual(readCareIdentitySlot(relaunched.vault, SCOPE_B), {
    ...supported,
    serverVersion: 2,
  });
});

test("escaped duplicate top-level containers preserve their earlier raw evidence after last-wins parsing", () => {
  const earlierFutureSlotRaw =
    '{"doc":{"dataVersion":999,"opaqueCounter":9007199254740993},"entries":{"future":"shape"},"serverVersion":null}';
  const earlierSlotsRaw =
    `{${JSON.stringify(SCOPE_A)}:${earlierFutureSlotRaw}}`;
  const selectedB = {
    doc: { dataVersion: 1, owner: "selected-b" },
    entries: [],
    serverVersion: 2,
  };
  const finalSlotsRaw = `{${JSON.stringify(SCOPE_B)}:${JSON.stringify(selectedB)}}`;
  const earlierQuarantineRaw =
    '[{"futureEvidence":{"codec":7},"opaqueCounter":9007199254740995}]';
  const escapedSlotsMember = `"sl\\u006fts" : ${earlierSlotsRaw}`;
  const escapedQuarantineMember =
    `"quar\\u0061ntine" : ${earlierQuarantineRaw}`;
  const raw = `{"format":"woofwatcher.care.identity-v1",${escapedSlotsMember},"slots":${finalSlotsRaw},${escapedQuarantineMember},"quarantine":[]}`;

  const parsed = parseCareIdentityVault(raw, SCOPE_B);
  assert.deepEqual(readCareIdentitySlot(parsed.vault, SCOPE_B), selectedB);
  assert.equal(readCareIdentitySlot(parsed.vault, SCOPE_A), null);
  assert.equal(
    parsed.vault.quarantine.length,
    2,
    "both earlier known containers must become explicit evidence",
  );
  assert.ok(
    parsed.vault.quarantine.every((item) => /duplicate/i.test(item.reason)),
  );

  writeCareIdentitySlot(parsed.vault, SCOPE_B, {
    ...selectedB,
    serverVersion: 3,
  });
  const persisted = serializeCareIdentityVault(parsed.vault);
  assert.ok(persisted.includes(escapedSlotsMember));
  assert.ok(persisted.includes(escapedQuarantineMember));
  assert.equal(persisted.includes("9007199254740992"), false);
  assert.equal(persisted.includes("9007199254740994"), false);

  const relaunched = parseCareIdentityVault(persisted, SCOPE_B);
  assert.equal(relaunched.vault.quarantine.length, 2);
  const persistedAgain = serializeCareIdentityVault(relaunched.vault);
  assert.ok(persistedAgain.includes(escapedSlotsMember));
  assert.ok(persistedAgain.includes(escapedQuarantineMember));
});

test("an opaque unknown top-level futureVault member remains byte-exact through rewrite and relaunch", () => {
  const selectedB = {
    doc: { dataVersion: 1, owner: "selected-b" },
    entries: [],
    serverVersion: 2,
  };
  const futureVaultMember =
    '"future\\u0056ault" \n :\t{"codec":7,"opaqueCounter":9007199254740993,"nested":{"retain":"exact"}}';
  const raw = `{"format":"woofwatcher.care.identity-v1","slots":{${JSON.stringify(SCOPE_B)}:${JSON.stringify(selectedB)}},"quarantine":[],${futureVaultMember}}`;

  const parsed = parseCareIdentityVault(raw, SCOPE_B);
  writeCareIdentitySlot(parsed.vault, SCOPE_B, {
    ...selectedB,
    serverVersion: 3,
  });
  const persisted = serializeCareIdentityVault(parsed.vault);
  assert.ok(persisted.includes(futureVaultMember));
  assert.equal(persisted.includes("9007199254740992"), false);

  const relaunched = parseCareIdentityVault(persisted, SCOPE_B);
  assert.deepEqual(readCareIdentitySlot(relaunched.vault, SCOPE_B), {
    ...selectedB,
    serverVersion: 3,
  });
  assert.ok(serializeCareIdentityVault(relaunched.vault).includes(futureVaultMember));
});

test("escaped nested duplicate keys make selected vault and legacy slots fail closed without rewriting raw", () => {
  const duplicateDocSlotRaw =
    '{"doc":{"dataVersion":999,"futureOnly":"earlier"},"d\\u006fc":{"dataVersion":1,"owner":"last-wins-must-not-open"},"entries":[],"serverVersion":4}';
  const vaultRaw = `{"format":"woofwatcher.care.identity-v1","slots":{"local":${duplicateDocSlotRaw}},"quarantine":[]}`;

  for (const [label, raw] of [
    ["vault", vaultRaw],
    ["legacy", duplicateDocSlotRaw],
  ] as const) {
    const parsed = parseCareIdentityVault(raw, "local");
    const selected = readCareIdentitySlot<{
      doc?: { dataVersion?: unknown };
    }>(parsed.vault, "local");
    assert.equal(
      selected?.doc?.dataVersion,
      Number.POSITIVE_INFINITY,
      `${label} duplicate keys must produce an opaque future sentinel`,
    );
    assert.equal(
      readCareIdentitySlotRaw(parsed.vault, "local"),
      duplicateDocSlotRaw,
    );
    assert.ok(
      serializeCareIdentityVault(parsed.vault).includes(
        label === "vault"
          ? `"local":${duplicateDocSlotRaw}`
          : `"local":${duplicateDocSlotRaw}`,
      ),
    );
  }
});

test("legacy local and signed-in migration wrap opaque source JSON without numeric normalization", () => {
  const legacyFutureRaw =
    '{ "doc" : { "dataVersion" : 999, "legacyCounter" : 9007199254740993 }, "entries" : [ ], "serverVersion" : 5 }';

  const local = parseCareIdentityVault(legacyFutureRaw, "local");
  assert.equal(readCareIdentitySlotRaw(local.vault, "local"), legacyFutureRaw);
  assert.ok(
    serializeCareIdentityVault(local.vault).includes(
      `"local":${legacyFutureRaw}`,
    ),
  );

  const signedIn = parseCareIdentityVault(legacyFutureRaw, SCOPE_A);
  assert.equal(readCareIdentitySlot(signedIn.vault, SCOPE_A), null);
  const quarantined = serializeCareIdentityVault(signedIn.vault);
  assert.ok(quarantined.includes(`"snapshot":${legacyFutureRaw}`));
  assert.equal(quarantined.includes("9007199254740992"), false);
});
