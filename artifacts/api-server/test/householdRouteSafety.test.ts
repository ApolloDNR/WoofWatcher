import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { test } from "node:test";

import express from "express";

import {
  EXPECTED_HOUSEHOLD_CHANGED_ERROR,
  EXPECTED_HOUSEHOLD_HEADER,
  EXPECTED_HOUSEHOLD_REQUIRED_ERROR,
  requireExpectedHouseholdCapability,
} from "../src/routes/household-capability.ts";

const root = process.cwd();
const ACTIVE_HOUSEHOLD_ID = "Household/Aa-01";

function read(path: string): string {
  return readFileSync(join(root, path), "utf8").replace(/\r\n/g, "\n");
}

function section(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing section start: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

function operationSection(source: string, operationId: string): string {
  const start = `      operationId: ${operationId}`;
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing operation: ${operationId}`);
  const nextIndex = source.indexOf(
    "\n      operationId:",
    startIndex + start.length,
  );
  return source.slice(startIndex, nextIndex === -1 ? undefined : nextIndex);
}

const guardedRoutes = [
  {
    operationId: "updateHousehold",
    headerValidator: "UpdateHouseholdHeader",
    start: 'router.patch("/household"',
    end: 'router.get("/household/invitations"',
    join: false,
  },
  {
    operationId: "listHouseholdInvitations",
    headerValidator: "ListHouseholdInvitationsHeader",
    start: 'router.get("/household/invitations"',
    end: 'router.post("/household/invitations"',
    join: false,
  },
  {
    operationId: "createHouseholdInvitation",
    headerValidator: "CreateHouseholdInvitationHeader",
    start: 'router.post("/household/invitations"',
    end: 'router.post("/household/invitations/:id/revoke"',
    join: false,
  },
  {
    operationId: "revokeHouseholdInvitation",
    headerValidator: "RevokeHouseholdInvitationHeader",
    start: 'router.post("/household/invitations/:id/revoke"',
    end: 'router.post("/household/join"',
    join: false,
  },
  {
    operationId: "joinHousehold",
    headerValidator: "JoinHouseholdHeader",
    start: 'router.post("/household/join"',
    end: 'router.get("/household/sharing-cleanup"',
    join: true,
  },
  {
    operationId: "listHouseholdSharingCleanup",
    headerValidator: "ListHouseholdSharingCleanupHeader",
    start: 'router.get("/household/sharing-cleanup"',
    end: 'router.get("/household/audit-events"',
    join: false,
  },
  {
    operationId: "listHouseholdAuditEvents",
    headerValidator: "ListHouseholdAuditEventsHeader",
    start: 'router.get("/household/audit-events"',
    end: 'router.patch("/household/members/:id"',
    join: false,
  },
  {
    operationId: "updateHouseholdMember",
    headerValidator: "UpdateHouseholdMemberHeader",
    start: 'router.patch("/household/members/:id"',
    end: "router.delete(",
    join: false,
  },
  {
    operationId: "revokeHouseholdMember",
    headerValidator: "RevokeHouseholdMemberHeader",
    start: "router.delete(",
    end: 'router.post("/household/access-passes/activate"',
    join: false,
  },
  {
    operationId: "activateHouseholdAccessPass",
    headerValidator: "ActivateHouseholdAccessPassHeader",
    start: 'router.post("/household/access-passes/activate"',
    end: 'router.post("/household/access-passes/revoke"',
    join: false,
  },
  {
    operationId: "revokeHouseholdAccessPass",
    headerValidator: "RevokeHouseholdAccessPassHeader",
    start: 'router.post("/household/access-passes/revoke"',
    end: "export default router",
    join: false,
  },
] as const;

const managedRoutes = [
  {
    operationId: "updateHousehold",
    start: 'router.patch("/household"',
    end: 'router.get(\n    "/household/invitations"',
  },
  {
    operationId: "listHouseholdInvitations",
    start: 'router.get(\n    "/household/invitations"',
    end: 'router.post(\n    "/household/invitations/:id/revoke"',
  },
  {
    operationId: "revokeHouseholdInvitation",
    start: 'router.post(\n    "/household/invitations/:id/revoke"',
    end: 'router.get(\n    "/household/sharing-cleanup"',
  },
  {
    operationId: "listHouseholdSharingCleanup",
    start: 'router.get(\n    "/household/sharing-cleanup"',
    end: 'router.get(\n    "/household/audit-events"',
  },
  {
    operationId: "listHouseholdAuditEvents",
    start: 'router.get(\n    "/household/audit-events"',
    end: 'router.patch(\n    "/household/members/:id"',
  },
  {
    operationId: "updateHouseholdMember",
    start: 'router.patch(\n    "/household/members/:id"',
    end: 'router.delete(\n    "/household/members/:id"',
  },
  {
    operationId: "revokeHouseholdMember",
    start: 'router.delete(\n    "/household/members/:id"',
    end: 'router.post(\n    "/household/access-passes/activate"',
  },
  {
    operationId: "activateHouseholdAccessPass",
    start: 'router.post(\n    "/household/access-passes/activate"',
    end: 'router.post(\n    "/household/access-passes/revoke"',
  },
  {
    operationId: "revokeHouseholdAccessPass",
    start: 'router.post(\n    "/household/access-passes/revoke"',
    end: "return router;",
  },
] as const;

test("every household-scoped shipping handler checks the exact capability before parsing, lookup, or authorization", () => {
  const routeSource = read("artifacts/api-server/src/routes/household.ts");
  const managementSource = read(
    "artifacts/api-server/src/routes/household-management-router.ts",
  );
  const invitationCreateSource = read(
    "artifacts/api-server/src/routes/household-invitation-create-handler.ts",
  );

  for (const route of managedRoutes) {
    const block = section(managementSource, route.start, route.end);
    const guardIndex = block.indexOf(
      "parseExpectedHouseholdCapability(req, res)",
    );
    assert.notEqual(
      guardIndex,
      -1,
      `${route.operationId} must invoke the production capability guard`,
    );

    const downstreamIndices = [
      block.indexOf("getUserId(req)"),
      block.indexOf(".safeParse("),
      block.indexOf("runHouseholdScopedRouteOperation("),
    ].filter((index) => index >= 0);
    assert.ok(
      downstreamIndices.length > 0,
      `${route.operationId} safety test needs a real downstream boundary`,
    );
    assert.ok(
      downstreamIndices.every((index) => guardIndex < index),
      `${route.operationId} must guard before body/query parsing or entering the database transaction`,
    );
  }

  const invitationCreateGuard = invitationCreateSource.indexOf(
    "parseExpectedHouseholdCapability(req, res)",
  );
  assert.ok(invitationCreateGuard >= 0);
  assert.ok(
    invitationCreateGuard <
      invitationCreateSource.indexOf("CreateHouseholdInvitationBody.safeParse"),
  );
  assert.ok(
    invitationCreateGuard <
      invitationCreateSource.indexOf("createHouseholdInvitationAtomically("),
  );

  const joinBlock = section(
    routeSource,
    'router.post("/household/join"',
    "const runHouseholdScopedOperation",
  );
  const joinGuard = joinBlock.indexOf(
    "parseExpectedHouseholdCapability(req, res)",
  );
  assert.ok(joinGuard >= 0);
  assert.ok(joinGuard < joinBlock.indexOf("JoinHouseholdBody.safeParse"));
  assert.ok(joinGuard < joinBlock.indexOf("ensureUserAndHousehold("));
  assert.doesNotMatch(
    joinBlock,
    /\.from\(householdsTable\)/,
    "Join must not retain the permanent legacy household-code fallback",
  );
});

test("household management handlers keep authority, tables, mutation, audit, and Exact Me in one scoped transaction", () => {
  const routeSource = read(
    "artifacts/api-server/src/routes/household-management-router.ts",
  );

  for (const route of managedRoutes) {
    const block = section(routeSource, route.start, route.end);
    const capabilityIndex = block.indexOf(
      "parseExpectedHouseholdCapability(req, res)",
    );
    const scopedOperationIndex = block.indexOf(
      "runHouseholdScopedOperation",
    );
    assert.notEqual(
      capabilityIndex,
      -1,
      `${route.operationId} must parse the opaque capability before any database authority work`,
    );
    assert.ok(
      scopedOperationIndex > capabilityIndex,
      `${route.operationId} must enter the locked user/membership transaction after parsing the capability`,
    );
    assert.match(
      block,
      /scope\.database/,
      `${route.operationId} must use the scoped transaction handle for all household table work`,
    );
    assert.doesNotMatch(block, /\bdb\./);
    assert.doesNotMatch(block, /getHouseholdMemberAuthz\(/);
    assert.doesNotMatch(block, /buildMe\(/);
  }

  const rootSource = read("artifacts/api-server/src/routes/household.ts");
  assert.match(rootSource, /createHouseholdManagementRouter\(/);
  assert.match(rootSource, /createDrizzleHouseholdScopedOperationStore\(/);
  assert.doesNotMatch(rootSource, /requireHouseholdTarget\(/);
  assert.doesNotMatch(rootSource, /buildMeOrSendConflict\(/);
  assert.doesNotMatch(routeSource, /\bas any\b/);
});

test("Me authority failures and join identity snapshots stay inside their shipping route boundaries", () => {
  const routeSource = read("artifacts/api-server/src/routes/household.ts");
  const getMeBlock = section(
    routeSource,
    'router.get("/me"',
    'router.patch("/me"',
  );
  const updateMeBlock = section(
    routeSource,
    'router.patch("/me"',
    'router.post("/household/invitations"',
  );

  for (const [operation, block] of [
    ["GET /me", getMeBlock],
    ["PATCH /me", updateMeBlock],
  ] as const) {
    assert.match(
      block,
      /runHouseholdAuthorityRequest\(/,
      `${operation} must translate typed household authority failures before sending any Me body`,
    );
    assert.doesNotMatch(
      block,
      /buildMeOrSendConflict\(/,
      `${operation} must keep provisioning and exact-Me failures inside one typed response boundary`,
    );
  }

  assert.match(
    updateMeBlock,
    /updateHouseholdProfileAtomically\(/,
    "PATCH /me must serialize, revalidate, update both names, and build Exact Me in one transaction",
  );
  assert.doesNotMatch(updateMeBlock, /\bdb\.(?:update|transaction)\(/);
  assert.doesNotMatch(updateMeBlock, /ensureUserAndHousehold\(/);

  const joinBlock = section(
    routeSource,
    'router.post("/household/join"',
    "const runHouseholdScopedOperation",
  );
  assert.match(joinBlock, /getFreshVerifiedHouseholdJoinIdentity\(/);
  assert.match(joinBlock, /verifiedIdentity/);
  assert.match(joinBlock, /\.\.\.joinResult\.me/);
  assert.match(joinBlock, /auditEvent:\s*joinResult\.auditEvent/);
  assert.doesNotMatch(
    joinBlock,
    /buildMeOrSendConflict\(/,
    "Join must return the exact snapshot captured by its commit transaction, never start a second snapshot transaction",
  );
});

test("OpenAPI and generated validators require the capability for the exact guarded operation inventory", () => {
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");

  const parameterBlock = section(
    openapi,
    "    ExpectedHouseholdId:",
    "  responses:",
  );
  assert.match(parameterBlock, /required:\s+true/);
  assert.match(parameterBlock, /minLength:\s+1/);
  assert.match(
    parameterBlock,
    /pattern:\s+['"]\.\*\\S\.\*['"]/,
    "the documented required header must reject blank-only values without transforming opaque bytes",
  );

  for (const route of guardedRoutes) {
    const block = operationSection(openapi, route.operationId);
    assert.match(
      block,
      /\$ref:\s+"#\/components\/parameters\/ExpectedHouseholdId"/,
      `${route.operationId} must require the expected-household header`,
    );
    assert.match(block, /"412":/);
    assert.match(block, /"428":/);

    assert.match(
      zodApi,
      new RegExp(
        `export const ${route.headerValidator} = zod\\.object\\(\\{[\\s\\S]*?X-WoofWatcher-Expected-Household-Id[\\s\\S]*?\\.min\\(1\\)`,
      ),
      `${route.headerValidator} must validate the required generated header`,
    );
    const validatorBlock = section(
      zodApi,
      `export const ${route.headerValidator}`,
      "\n\n",
    );
    const regexpConstant = `${route.headerValidator[0].toLowerCase()}${route.headerValidator.slice(1)}XWoofWatcherExpectedHouseholdIdRegExp`;
    assert.match(
      section(zodApi, `export const ${regexpConstant}`, ";"),
      /new RegExp\(["']\.\\\*\\\\S\.\\\*["']\)/,
      `${regexpConstant} must preserve the generated non-whitespace rule without trimming opaque bytes`,
    );
    assert.match(
      validatorBlock,
      new RegExp(`\\.regex\\(\\s*${regexpConstant},?\\s*\\)`),
      `${route.headerValidator} must apply its exact generated non-whitespace RegExp constant`,
    );
    assert.match(
      reactClient,
      new RegExp(
        `export const ${route.operationId} = async \\([\\s\\S]{0,240}?options\\?: RequestInit`,
      ),
      `${route.operationId} must expose RequestInit so callers can send the exact capability header`,
    );
  }

  assert.match(
    section(zodApi, "export const updateHouseholdBodyNameRegExp", ";"),
    /new RegExp\(["']\.\\\*\\\\S\.\\\*["']\)/,
    "the generated household-name RegExp constant must reject blank-only names",
  );
  assert.match(
    section(zodApi, "export const UpdateHouseholdBody", "\n\n"),
    /\.regex\(\s*updateHouseholdBodyNameRegExp,?\s*\)/,
    "UpdateHouseholdBody must apply the exact generated non-whitespace name constant",
  );

  const getMeBlock = section(
    openapi,
    "      operationId: getMe",
    "      operationId: updateMe",
  );
  const updateMeBlock = section(
    openapi,
    "      operationId: updateMe",
    "  /household:",
  );
  assert.doesNotMatch(getMeBlock, /ExpectedHouseholdId/);
  assert.doesNotMatch(updateMeBlock, /ExpectedHouseholdId/);
});

test("the production capability guard blocks a real Express route before its household table boundary", async () => {
  const app = express();
  let activeLookups = 0;
  let tableAccesses = 0;

  app.all("/household", async (req, res) => {
    const target = await requireExpectedHouseholdCapability({
      req,
      res,
      async resolveActiveHouseholdId() {
        activeLookups += 1;
        return ACTIVE_HOUSEHOLD_ID;
      },
    });
    if (!target) return;

    tableAccesses += 1;
    res.json({ householdId: target });
  });

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const { port } = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${port}/household`;
    for (const capabilityCase of [
      {
        value: undefined,
        status: 428,
        error: EXPECTED_HOUSEHOLD_REQUIRED_ERROR,
        expectedActiveLookups: 0,
      },
      {
        value: "   ",
        status: 428,
        error: EXPECTED_HOUSEHOLD_REQUIRED_ERROR,
        expectedActiveLookups: 0,
      },
      {
        value: ACTIVE_HOUSEHOLD_ID.toLowerCase(),
        status: 412,
        error: EXPECTED_HOUSEHOLD_CHANGED_ERROR,
        expectedActiveLookups: 1,
      },
    ] as const) {
      activeLookups = 0;
      tableAccesses = 0;
      const response = await fetch(url, {
        headers:
          capabilityCase.value === undefined
            ? {}
            : { [EXPECTED_HOUSEHOLD_HEADER]: capabilityCase.value },
      });

      assert.equal(response.status, capabilityCase.status);
      assert.deepEqual(await response.json(), {
        error: capabilityCase.error,
      });
      assert.equal(activeLookups, capabilityCase.expectedActiveLookups);
      assert.equal(tableAccesses, 0);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.match(
        response.headers.get("vary") ?? "",
        new RegExp(EXPECTED_HOUSEHOLD_HEADER, "i"),
      );
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});
