import assert from "node:assert/strict";
import { test } from "node:test";

import type { Request, Response } from "express";

import {
  EXPECTED_HOUSEHOLD_CHANGED_ERROR,
  EXPECTED_HOUSEHOLD_HEADER,
  EXPECTED_HOUSEHOLD_REQUIRED_ERROR,
  parseExpectedHouseholdCapability,
  requireExpectedHouseholdCapability,
  verifyExpectedHouseholdCapability,
} from "../src/routes/household-capability.ts";

const ACTIVE_HOUSEHOLD_ID = "Household/Aa-01";

interface RecordedResponse {
  response: Response;
  headers: Map<string, string>;
  variedBy: string[];
  events: string[];
  getStatus(): number | null;
  getBody(): unknown;
}

function createRecordedResponse(events: string[] = []): RecordedResponse {
  const headers = new Map<string, string>();
  const variedBy: string[] = [];
  let status: number | null = null;
  let body: unknown;

  const response = {
    set(name: string, value: string) {
      events.push(`set:${name}:${value}`);
      headers.set(name, value);
      return response;
    },
    vary(name: string) {
      events.push(`vary:${name}`);
      variedBy.push(name);
      return response;
    },
    status(nextStatus: number) {
      events.push(`status:${nextStatus}`);
      status = nextStatus;
      return response;
    },
    json(nextBody: unknown) {
      events.push("json");
      body = nextBody;
      return response;
    },
  } as unknown as Response;

  return {
    response,
    headers,
    variedBy,
    events,
    getStatus: () => status,
    getBody: () => body,
  };
}

function createRequest(
  headerValue: string | undefined,
  events: string[] = [],
): Request {
  return {
    get(name: string) {
      events.push(`get:${name}`);
      assert.equal(name, EXPECTED_HOUSEHOLD_HEADER);
      return headerValue;
    },
  } as Request;
}

for (const missingCase of [
  { name: "missing", value: undefined },
  { name: "empty", value: "" },
  { name: "space-only", value: "   " },
  { name: "tab-only", value: "\t\t" },
] as const) {
  test(`expected-household parser rejects ${missingCase.name} input with 428 and private non-cacheable variation`, () => {
    const recorded = createRecordedResponse();

    const capability = parseExpectedHouseholdCapability(
      createRequest(missingCase.value),
      recorded.response,
    );

    assert.equal(capability, null);
    assert.equal(recorded.getStatus(), 428);
    assert.deepEqual(recorded.getBody(), {
      error: EXPECTED_HOUSEHOLD_REQUIRED_ERROR,
    });
    assert.equal(recorded.headers.get("Cache-Control"), "private, no-store");
    assert.deepEqual(recorded.variedBy, [EXPECTED_HOUSEHOLD_HEADER]);
  });
}

test("expected-household parser preserves every nonblank opaque byte", () => {
  const recorded = createRecordedResponse();
  const opaqueValue = ` ${ACTIVE_HOUSEHOLD_ID}\t`;

  const capability = parseExpectedHouseholdCapability(
    createRequest(opaqueValue),
    recorded.response,
  );

  assert.deepEqual(capability, { expectedHouseholdId: opaqueValue });
  assert.equal(recorded.getStatus(), null);
  assert.equal(recorded.getBody(), undefined);
});

test("exact verification rejects surrounding whitespace, casing, and other opaque mismatches with 412", () => {
  for (const expectedHouseholdId of [
    ` ${ACTIVE_HOUSEHOLD_ID}`,
    `${ACTIVE_HOUSEHOLD_ID} `,
    ACTIVE_HOUSEHOLD_ID.toLowerCase(),
    `${ACTIVE_HOUSEHOLD_ID}/other`,
  ]) {
    const recorded = createRecordedResponse();

    const targetHouseholdId = verifyExpectedHouseholdCapability({
      capability: { expectedHouseholdId },
      actualHouseholdId: ACTIVE_HOUSEHOLD_ID,
      res: recorded.response,
    });

    assert.equal(targetHouseholdId, null, expectedHouseholdId);
    assert.equal(recorded.getStatus(), 412, expectedHouseholdId);
    assert.deepEqual(
      recorded.getBody(),
      { error: EXPECTED_HOUSEHOLD_CHANGED_ERROR },
      expectedHouseholdId,
    );
  }
});

test("exact verification returns the expected capability as the route target", () => {
  const recorded = createRecordedResponse();

  const targetHouseholdId = verifyExpectedHouseholdCapability({
    capability: { expectedHouseholdId: ACTIVE_HOUSEHOLD_ID },
    actualHouseholdId: ACTIVE_HOUSEHOLD_ID,
    res: recorded.response,
  });

  assert.equal(targetHouseholdId, ACTIVE_HOUSEHOLD_ID);
  assert.equal(recorded.getStatus(), null);
  assert.equal(recorded.getBody(), undefined);
});

for (const missingCase of [
  { name: "missing", value: undefined },
  { name: "blank", value: "   " },
] as const) {
  test(`guard rejects ${missingCase.name} capability before active lookup`, async () => {
    const events: string[] = [];
    const recorded = createRecordedResponse(events);
    let activeLookups = 0;

    const targetHouseholdId = await requireExpectedHouseholdCapability({
      req: createRequest(missingCase.value, events),
      res: recorded.response,
      async resolveActiveHouseholdId() {
        events.push("active-lookup");
        activeLookups += 1;
        return ACTIVE_HOUSEHOLD_ID;
      },
    });

    assert.equal(targetHouseholdId, null);
    assert.equal(activeLookups, 0);
    assert.equal(events.includes("active-lookup"), false);
    assert.ok(
      events.indexOf(`get:${EXPECTED_HOUSEHOLD_HEADER}`) <
        events.indexOf(`status:428`),
    );
  });
}

test("guard parses and marks the response before resolving active household authority", async () => {
  const events: string[] = [];
  const recorded = createRecordedResponse(events);

  const targetHouseholdId = await requireExpectedHouseholdCapability({
    req: createRequest(ACTIVE_HOUSEHOLD_ID, events),
    res: recorded.response,
    async resolveActiveHouseholdId() {
      events.push("active-lookup");
      return ACTIVE_HOUSEHOLD_ID;
    },
  });

  assert.equal(targetHouseholdId, ACTIVE_HOUSEHOLD_ID);
  assert.deepEqual(events, [
    "set:Cache-Control:private, no-store",
    `vary:${EXPECTED_HOUSEHOLD_HEADER}`,
    `get:${EXPECTED_HOUSEHOLD_HEADER}`,
    "active-lookup",
  ]);
});

test("guard performs one active lookup then rejects an exact mismatch", async () => {
  const recorded = createRecordedResponse();
  let activeLookups = 0;

  const targetHouseholdId = await requireExpectedHouseholdCapability({
    req: createRequest("Household/Aa-02"),
    res: recorded.response,
    async resolveActiveHouseholdId() {
      activeLookups += 1;
      return ACTIVE_HOUSEHOLD_ID;
    },
  });

  assert.equal(targetHouseholdId, null);
  assert.equal(activeLookups, 1);
  assert.equal(recorded.getStatus(), 412);
  assert.deepEqual(recorded.getBody(), {
    error: EXPECTED_HOUSEHOLD_CHANGED_ERROR,
  });
  assert.equal(recorded.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(recorded.variedBy, [EXPECTED_HOUSEHOLD_HEADER]);
});
