import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

const mobileRoot = join(process.cwd(), "artifacts", "woofwatcher-mobile");
const expectedHeader = "X-WoofWatcher-Expected-Household-Id";
const scopedGeneratedCalls = [
  "updateHousehold",
  "listHouseholdInvitations",
  "createHouseholdInvitation",
  "revokeHouseholdInvitation",
  "joinHousehold",
  "updateHouseholdMember",
  "revokeHouseholdMember",
  "activateHouseholdAccessPass",
  "revokeHouseholdAccessPass",
  "listHouseholdSharingCleanup",
  "listHouseholdAuditEvents",
  "listMyHouseholdMemberships",
  "activateHousehold",
] as const;

function productionTypeScriptFiles(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    if (name === "node_modules" || name === ".expo") return [];
    if (statSync(path).isDirectory()) return productionTypeScriptFiles(path);
    if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) return [];
    return [path];
  });
}

test("every ordinary generated household call site carries the exact active capability", () => {
  const discovered: Array<{ call: string; file: string; source: string }> = [];
  for (const path of productionTypeScriptFiles(mobileRoot)) {
    if (path.includes(`${join("lib", "api-client-react", "src", "generated")}`)) {
      continue;
    }
    const source = readFileSync(path, "utf8");
    for (const call of scopedGeneratedCalls) {
      if (new RegExp(`\\b${call}\\s*\\(`).test(source)) {
        discovered.push({ call, file: relative(mobileRoot, path), source });
      }
    }
  }

  assert.deepEqual(
    discovered.map(({ call, file }) => ({ call, file })),
    [
      {
        call: "updateHousehold",
        file: "components/more/CareTeamSuppliesScreen.tsx",
      },
      {
        call: "createHouseholdInvitation",
        file: "components/more/CareTeamSuppliesScreen.tsx",
      },
      {
        call: "revokeHouseholdInvitation",
        file: "components/more/CareTeamSuppliesScreen.tsx",
      },
      {
        call: "joinHousehold",
        file: "components/more/CareTeamSuppliesScreen.tsx",
      },
      {
        call: "listMyHouseholdMemberships",
        file: "components/more/CareTeamSuppliesScreen.tsx",
      },
      {
        call: "activateHousehold",
        file: "components/more/CareTeamSuppliesScreen.tsx",
      },
    ],
  );

  const careTeam = discovered[0]?.source ?? "";
  assert.equal(
    careTeam.match(new RegExp(`"${expectedHeader}":`, "g"))
      ?.length,
    discovered.length,
  );
  assert.match(
    careTeam,
    /createHouseholdInvitation\(\s*\{ role: "adult", lifecycleState: "approved", expiresAt \},\s*\{\s*"X-WoofWatcher-Expected-Household-Id": expectedHouseholdId/,
  );
  assert.match(
    careTeam,
    /revokeHouseholdInvitation\(\s*invitationId,\s*\{\s*"X-WoofWatcher-Expected-Household-Id": expectedHouseholdId[\s\S]*?\{ reason:/,
  );
  assert.match(
    careTeam,
    /joinHousehold\(\s*\{ inviteCode \},\s*\{\s*"X-WoofWatcher-Expected-Household-Id": expectedHouseholdId/,
  );
  assert.match(
    careTeam,
    /updateHousehold\(\s*\{ name: householdName \},\s*\{\s*"X-WoofWatcher-Expected-Household-Id": expectedHouseholdId/,
  );
  assert.match(
    careTeam,
    /listMyHouseholdMemberships\(\s*\{\s*"X-WoofWatcher-Expected-Household-Id": requestPermit\.householdId[\s\S]*?\{ signal \}/,
  );
  assert.match(
    careTeam,
    /activateHousehold\(\s*\{ householdId: targetHouseholdId \},\s*\{\s*"X-WoofWatcher-Expected-Household-Id":\s*expectedSourceHouseholdId/,
  );
  assert.doesNotMatch(
    careTeam,
    /headers:\s*\{\s*"X-WoofWatcher-Expected-Household-Id"/,
    "required capability values must not be smuggled through RequestInit",
  );
});

test("no production observer hook can silently omit a household capability", () => {
  const sources = productionTypeScriptFiles(mobileRoot)
    .filter((path) => !path.includes(`${join("lib", "api-client-react", "src", "generated")}`))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  for (const call of scopedGeneratedCalls) {
    const hook = `use${call.charAt(0).toUpperCase()}${call.slice(1)}`;
    assert.doesNotMatch(sources, new RegExp(`\\b${hook}\\b`), hook);
  }
});
