import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const MOBILE_ROOT = existsSync(
  join(process.cwd(), "artifacts", "woofwatcher-mobile"),
)
  ? join(process.cwd(), "artifacts", "woofwatcher-mobile")
  : process.cwd();
const COMPONENT_PATH = join(
  MOBILE_ROOT,
  "components",
  "more",
  "CareTeamSuppliesScreen.tsx",
);
const PACK_PATH = join(MOBILE_ROOT, "app", "(tabs)", "pack.tsx");
const MORE_PATH = join(MOBILE_ROOT, "app", "(tabs)", "more.tsx");
const ROUTER_PATH = join(MOBILE_ROOT, "components", "more", "MoreSectionRouter.tsx");

function read(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function mutationCount(source: string, name: string): number {
  return source.match(new RegExp(`\\b${name}\\(`, "g"))?.length ?? 0;
}

test("places the complete Care Team and supplies owner in one tab-safe component", () => {
  assert.equal(
    existsSync(COMPONENT_PATH),
    true,
    "CareTeamSuppliesScreen.tsx must exist before legacy owners delegate",
  );
  const component = read(COMPONENT_PATH);

  assert.match(component, /export interface CareTeamSuppliesScreenProps/);
  assert.match(component, /section:\s*CareTeamSection/);
  assert.match(component, /itemId\?:\s*string/);
  assert.match(component, /onBack:\s*\(\)\s*=>\s*void/);
  assert.match(
    component,
    /\}:\s*CareTeamSuppliesScreenProps\):\s*React\.JSX\.Element/,
  );
  assert.equal(
    component.match(/\bitemId\b/g)?.length,
    1,
    "itemId must remain an inert compatibility prop in Task 4b",
  );
  assert.doesNotMatch(component, /useLocalSearchParams/);
  assert.match(component, /getRouteTopPadding/);
  assert.match(component, /getTabbedRouteBottomPadding/);
  assert.match(component, /surface:\s*"tabbed"/);
});

test("keeps both accepted v1 stores and every inventory/travel action in the component", () => {
  const component = read(COMPONENT_PATH);

  assert.match(component, /PACK_SUPPLIES_KEY/);
  assert.match(component, /TRAVEL_BAG_KEY/);
  assert.doesNotMatch(component, /"woofwatcher\.packSupplies\.v1"/);
  assert.doesNotMatch(component, /"woofwatcher\.travelBag\.v1"/);
  assert.match(component, /useState<SupplyItem\[\]\s*\|\s*null>\(null\)/);
  assert.match(component, /let cancelled = false/);
  assert.match(component, /useDevicePreferences/);
  assert.doesNotMatch(component, /\bAsyncStorage\b/);
  assert.match(component, /store\s*\.\s*hydrate\(PACK_SUPPLIES_KEY/);
  assert.match(component, /store\s*\.\s*hydrate\(TRAVEL_BAG_KEY/);
  assert.match(component, /LocalDataResetInProgressError/);
  assert.match(component, /operationSettledEpoch/);
  assert.match(component, /createDevicePreferenceHydrationRetryScheduler/);
  assert.match(component, /hydrateSupplies\(\);\s*hydrateTravelBag\(\);/);
  assert.match(component, /suppliesNeedsRetry/);
  assert.match(component, /travelBagNeedsRetry/);
  assert.match(
    component,
    /if \(suppliesHydrated && travelBagHydrated\)\s*\{\s*hydrationRetry\.reset\(\)/,
  );
  assert.doesNotMatch(
    component,
    /\.catch\(\(error\)\s*=>\s*\{[\s\S]{0,260}setSupplies\(parseSupplies\(null\)\)/,
  );
  assert.doesNotMatch(
    component,
    /\.catch\(\(error\)\s*=>\s*\{[\s\S]{0,260}setTravelBag\(defaultTravelBag\(\)\)/,
  );
  assert.match(component, /clearSuppliesDrafts\(\)/);
  assert.match(component, /clearTravelBagDrafts\(\)/);
  assert.match(component, /storedSuppliesProjectionIsMissingOrCorrupt/);
  assert.match(component, /storedTravelBagProjectionIsMissingOrCorrupt/);
  assert.doesNotMatch(
    component,
    /JSON\.stringify\(JSON\.parse\(raw\)\)\s*!==\s*normalizedRaw/,
  );

  for (const action of [
    "commitSupplies",
    "commitTravelBag",
    "activateBag",
    "completeBag",
    "reopenBag",
    "redoBag",
    "openBagLabelEditor",
    "saveBagLabel",
    "cycleSupply",
    "openSupplyEditor",
    "closeSupplyEditor",
    "saveSupplyRename",
    "removeSupply",
    "openAddSupply",
    "cancelAddSupply",
    "saveSupplyAdd",
  ]) {
    assert.match(
      component,
      new RegExp(`const ${action}\\s*=`),
      `${action} must remain in the single substantive owner`,
    );
  }

  assert.match(component, /activateTravelBag\(\s*travelBag,\s*packedCount/);
  assert.match(component, /resetTravelItems\(\s*supplies\s*\)/);
  assert.match(component, /renameTravelBag\(\s*travelBag,\s*bagLabelDraft\s*\)/);
  assert.match(component, /setSupplies\(\(current\)\s*=>/);
  assert.match(component, /store\s*\.\s*save\(PACK_SUPPLIES_KEY/);
  assert.match(component, /store\s*\.\s*save\(TRAVEL_BAG_KEY/);
  assert.match(component, /serializeSupplies\(next\)/);
  assert.match(component, /serializeTravelBag\(next\)/);
});

test("moves the two accepted Care Team writes and their truthful provider boundaries", () => {
  const component = read(COMPONENT_PATH);

  assert.equal(mutationCount(component, "updateCareDoc"), 2);
  assert.equal(mutationCount(component, "runAcceptedCareMutation"), 2);
  assert.match(component, /careMutationsBlocked/);
  assert.match(component, /CARE_READ_ONLY_MESSAGE/);
  assert.match(component, /buildCareTwinRosterDraft/);
  assert.match(component, /buildAccessPassDraft/);
  assert.match(component, /deriveCareTwinRoster/);
  assert.match(component, /deriveHouseholdAccessPlan/);
  assert.match(
    component,
    /householdAccess\.status === "needs-household"[\s\S]*householdAccess\.status === "needs-invites"[\s\S]*\? colors\.amber[\s\S]*householdAccess\.status === "needs-roles"[\s\S]*\? colors\.copper[\s\S]*: colors\.sage/,
  );
  assert.match(component, /deriveHouseholdResponsibility/);
  assert.match(component, /deriveMyCareToday/);
  assert.match(component, /deriveAccessPassPlan/);
  assert.match(
    component,
    /enabled:\s*consumerSurfacePolicy\.householdProviderActions[\s\S]*isClerkEnabledForBuild[\s\S]*Boolean\(isSignedIn\)/,
  );
  assert.match(component, /invalidateQueries\(\{ queryKey: getGetMeQueryKey\(\) \}\)/);

  for (const action of [
    "shareInvite",
    "openFuturePetSheet",
    "saveFuturePet",
    "openAccessPassSheet",
    "saveAccessPassDraft",
    "shareAccessPassSummary",
    "submitJoin",
    "submitRename",
    "submitName",
  ]) {
    assert.match(component, new RegExp(`const ${action}\\s*=`), action);
  }

  assert.match(component, /On this device/);
  assert.match(component, /Multi-dog switching is coming soon/);
  assert.match(component, /Provider-backed sharing is not live yet/);
  assert.match(component, /Share Draft Summary/);
  assert.match(component, /My Care Today/);
  assert.match(component, /Responsibility Center/);
  assert.match(component, /Create Access Pass/);
  assert.match(component, /careTwinRoster\.liveCount/);
  assert.match(component, /careTwinRoster\.futureCount/);
  assert.match(component, /careTwinRoster\.providerGatedCount/);
  assert.match(component, /accessPassPlan\.activeCount/);
  assert.match(component, /accessPassPlan\.upcomingCount/);
  assert.match(component, /accessPassPlan\.draftCount/);
  assert.match(component, /person\.permissions\.slice\(0, 2\)\.join\(", "\)/);
  assert.doesNotMatch(component, /buildCarePass/);
  assert.doesNotMatch(component, /deriveCarePass/);
});

test("makes the extracted controls visible and usable without a hidden gesture", () => {
  const component = read(COMPONENT_PATH);

  assert.match(component, /accessibilityLabel=\{`Edit \$\{item\.name\}`\}/);
  assert.match(component, /onLongPress=\{\(\) => onEdit\(item\)\}/);
  for (const styleName of [
    "travelCaptionRow",
    "supplyEditButton",
    "supplyRemoveButton",
    "addGroupChip",
    "touchAction",
    "careActionButton",
    "inlineAction",
    "infoAction",
    "primaryInlineButton",
    "passKind",
    "modalCancel",
    "modalConfirm",
    "profField",
    "profSaveBtn",
  ]) {
    assert.match(
      component,
      new RegExp(`${styleName}:\\s*\\{[\\s\\S]{0,400}?minHeight:\\s*MIN_MOBILE_TOUCH_TARGET`),
      `${styleName} must retain a 48-point local touch target`,
    );
  }
  assert.match(component, /accessibilityState=\{\{ selected/);
  for (const styleName of [
    "supplyName",
    "supplyInput",
    "careActionButtonText",
    "bodyText",
    "cardTitle",
    "rowTitle",
    "inviteCode",
    "metricValue",
  ]) {
    assert.match(
      component,
      new RegExp(`${styleName}:\\s*\\{[^}]*fontSize:\\s*(?:1[6-9]|[2-9]\\d)`),
      `${styleName} must be at least 16 points`,
    );
  }
  for (const styleName of [
    "suppliesHint",
    "supplyUpdated",
    "supplyPillText",
    "supplyEditButtonText",
    "supplyRemoveText",
    "addGroupChipText",
    "secondaryText",
    "fieldLabel",
    "metricLabel",
    "careItemTime",
    "careItemStatus",
    "emptyCopy",
    "boundaryLabel",
    "boundary",
  ]) {
    assert.match(
      component,
      new RegExp(`${styleName}:\\s*\\{[^}]*fontSize:\\s*(?:1[4-9]|[2-9]\\d)`),
      `${styleName} must be at least 14 points`,
    );
  }
  assert.match(component, /accessibilityLabel="Back to More"/);
  assert.match(component, /accessibilityLabel="Multi-dog care availability"/);
});

test("leaves Pack as a resolver-backed redirect with no second mounted owner", () => {
  const pack = read(PACK_PATH);

  assert.match(pack, /useLocalSearchParams/);
  assert.match(pack, /resolveCanonicalDestination/);
  assert.match(pack, /pathname:\s*"\/pack"/);
  assert.match(pack, /<Redirect\s+href=\{redirectHref\}\s*\/>/);
  assert.doesNotMatch(pack, /AsyncStorage/);
  assert.doesNotMatch(pack, /useState/);
  assert.doesNotMatch(pack, /CareTeamSuppliesScreen/);
  assert.doesNotMatch(pack, /buildCarePass/);
  assert.doesNotMatch(pack, /router\.push/);
  assert.equal(mutationCount(pack, "updateCareDoc"), 0);
});

test("dispatches only the extracted Care Team target from the canonical router", () => {
  const more = read(MORE_PATH);
  const router = read(ROUTER_PATH);

  assert.match(more, /resolveMoreSectionRoute/);
  assert.match(more, /<MoreSectionRouter/);
  assert.match(router, /case "care-team-supplies"/);
  assert.match(router, /<CareTeamSuppliesScreen/);
  assert.match(router, /section=\{target\.section\}/);
  assert.match(router, /itemId=\{itemId\}/);
  assert.match(more, /<MoreScreenContent/);
  assert.equal(mutationCount(more, "updateCareDoc"), 1);
  assert.equal(mutationCount(more, "runAcceptedCareMutation"), 1);

  for (const movedAction of [
    "shareInvite",
    "openFuturePetSheet",
    "saveFuturePet",
    "openAccessPassSheet",
    "saveAccessPassDraft",
    "shareAccessPassSummary",
    "submitJoin",
    "submitRename",
    "submitName",
  ]) {
    assert.doesNotMatch(more, new RegExp(`const ${movedAction}\\s*=`), movedAction);
  }
  for (const movedHook of [
    "useUpdateHousehold",
    "useJoinHousehold",
    "useUpdateMe",
    "useQueryClient",
  ]) {
    assert.doesNotMatch(more, new RegExp(`\\b${movedHook}\\b`), movedHook);
  }
  for (const movedBoard of [
    "CareTwin Roster",
    "Care Team",
    "Household Access",
    "Access Passes",
    "My Care Today",
    "Responsibility Center",
  ]) {
    assert.doesNotMatch(
      more,
      new RegExp(`BoardSectionHeader[\\s\\S]{0,100}title="${movedBoard}"`),
      movedBoard,
    );
  }
  assert.match(
    more,
    /router\.push\(\{ pathname: "\/more", params: \{ section: "care-team" \} \}\)/,
  );
  assert.doesNotMatch(more, /registerSectionAnchor\("household"\)/);
  assert.doesNotMatch(more, /registerSectionAnchor\("access"\)/);
});
