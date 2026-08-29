import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();
const MOBILE_ROOT = join(ROOT, "artifacts", "woofwatcher-mobile");

function readMobile(...parts: string[]): string {
  return readFileSync(join(MOBILE_ROOT, ...parts), "utf8");
}

function listTsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listTsxFiles(path);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [path] : [];
  });
}

test("keeps every React Native modal on the VoiceOver-safe structural contract", () => {
  const primitives = readMobile("components", "board", "BoardPrimitives.tsx");
  const modalOwners = [
    ...listTsxFiles(join(MOBILE_ROOT, "app")),
    ...listTsxFiles(join(MOBILE_ROOT, "components")),
  ].filter((path) => readFileSync(path, "utf8").includes("<Modal"));

  assert.match(
    primitives,
    /type StructuralPressableProps = Omit<[\s\S]*StructuralAccessibilityProp \| "onPress"/,
  );
  for (const forbiddenProp of [
    "accessible",
    "accessibilityLabel",
    "accessibilityHint",
    "accessibilityRole",
    "accessibilityState",
    "accessibilityViewIsModal",
    "onAccessibilityEscape",
    "importantForAccessibility",
    "aria-label",
    "aria-modal",
  ]) {
    assert.match(
      primitives,
      new RegExp(`\\|? \\"${forbiddenProp}\\"`),
      `${forbiddenProp} must stay outside the structural wrapper API`,
    );
  }
  assert.match(primitives, /closeAccessibilityLabel = "Dismiss dialog"/);
  assert.match(primitives, /accessibilityRole="button"/);
  assert.match(
    primitives,
    /<Pressable[\s\S]*accessible=\{false\}[\s\S]*accessibilityViewIsModal[\s\S]*onAccessibilityEscape=\{requestCloseIfAllowed\}[\s\S]*event\.stopPropagation\(\)/,
  );
  assert.match(primitives, /accessibilityLabel=\{closeAccessibilityLabel\}/);
  assert.match(primitives, /AccessibilityInfo\.setAccessibilityFocus\(reactTag\)/);
  assert.match(primitives, /if \(!visible \|\| closeBlocked\) return/);
  assert.match(primitives, /minHeight:\s*MIN_MOBILE_TOUCH_TARGET/);
  assert.match(primitives, /minWidth:\s*MIN_MOBILE_TOUCH_TARGET/);
  assert.ok(modalOwners.length > 0, "the candidate should still have modal owners");

  for (const path of modalOwners) {
    const source = readFileSync(path, "utf8");
    const label = relative(ROOT, path);
    const modalCount = source.match(/<Modal\b/g)?.length ?? 0;
    const backdropCount = source.match(/<ModalBackdropPressable\b/g)?.length ?? 0;
    const sheetCount = source.match(/<ModalSheetPressable\b/g)?.length ?? 0;
    const sheetCloseCount = source.match(
      /<ModalSheetPressable\b(?=[\s\S]{0,420}?\bonRequestClose=)/g,
    )?.length ?? 0;
    const sheetVisibilityCount = source.match(
      /<ModalSheetPressable\b(?=[\s\S]{0,420}?\bvisible=)/g,
    )?.length ?? 0;

    assert.equal(backdropCount, modalCount, `${label}: one safe backdrop per modal`);
    assert.equal(sheetCount, modalCount, `${label}: one modal focus boundary per modal`);
    assert.equal(sheetCloseCount, modalCount, `${label}: every modal sheet exposes an explicit close action`);
    assert.equal(sheetVisibilityCount, modalCount, `${label}: focus moves only when its modal is visible`);
    assert.doesNotMatch(
      source,
      /<Pressable\s+style=\{\[?s\.modalBackdrop/,
      `${label}: no raw Pressable modal backdrop may return`,
    );
  }
});

test("keeps shared primary controls at the declared 48-point minimum", () => {
  const primitives = readMobile("components", "board", "BoardPrimitives.tsx");

  for (const styleName of [
    "segmentChip",
    "actionButton",
    "actionButtonCompact",
  ]) {
    assert.match(
      primitives,
      new RegExp(`${styleName}: \\{[\\s\\S]{0,180}?minHeight: MIN_MOBILE_TOUCH_TARGET`),
      `${styleName} must use the shared 48-point minimum`,
    );
  }
});

test("serializes proof picking and commits care metadata before physical cleanup", () => {
  const log = readMobile("app", "(tabs)", "log.tsx");
  const records = readMobile("components", "health", "RecordsScreen.tsx");
  const attachProof = log.slice(
    log.indexOf("const handleAttachProof = useCallback"),
    log.indexOf("const logSearch = useMemo"),
  );

  assert.match(attachProof, /proofPickerInFlightRef\.current/);
  assert.match(attachProof, /const latestEntry = careStateRef\.current\.entries\.find/);
  assert.match(attachProof, /buildCareLogPhotoProofAttachmentPatch\(latestEntry/);
  assert.match(attachProof, /source: "library",\s*now: Date\.now\(\)/);
  assert.doesNotMatch(attachProof, /source: "library",\s*now,/);
  assert.doesNotMatch(attachProof, /cleanupAfterApplyUris/);
  assert.ok(
    attachProof.indexOf("persistCurrentCareSnapshot") <
      attachProof.lastIndexOf("releasePickedMediaReferences"),
    "the durable metadata receipt must precede old-proof deletion",
  );
  assert.match(log, /if \(logScreenMountedRef\.current\) onDeleted\?\.\(\)/);
  assert.match(log, /disabled=\{proofPickerBusy\}/);
  assert.match(log, /accessibilityState=\{\{ disabled: proofPickerBusy \}\}/);
  assert.ok(
    (records.match(/runCareFileCleanupAfterDurableSnapshot\(\{/g)?.length ?? 0) >= 2,
    "record replacement and deletion both need the durability gate",
  );
  assert.ok(
    (log.match(/runCareFileCleanupAfterDurableSnapshot\(\{/g)?.length ?? 0) >= 2,
    "proof replacement and log deletion both need the durability gate",
  );
});

test("QA evidence actions are exclusive and freeze concurrent note or status edits", () => {
  const qa = readMobile("app", "care-twin-qa.tsx");
  const editAdmission = qa.slice(
    qa.indexOf("const applyRealQaEdit ="),
    qa.indexOf("const setQaStatusById:"),
  );
  const evidenceAdmission = qa.slice(
    qa.indexOf("const enqueueQaEvidenceOperation ="),
    qa.indexOf("const persistQaSessionInput ="),
  );

  assert.match(editAdmission, /qaEvidenceActionGate\.isBusy\(\)/);
  assert.match(evidenceAdmission, /qaEvidenceActionGate\.run/);
  assert.match(
    evidenceAdmission,
    /!qaScreenMountedRef\.current \|\| !qaEditAdmissionRef\.current/,
  );
  assert.doesNotMatch(qa, /qaEvidenceOperationTailRef/);
  assert.match(qa, /pointerEvents=\{qaEvidenceBusy \? "none" : "auto"\}/);
  assert.match(
    qa,
    /const qaEditControlsDisabled =[\s\S]{0,220}qaEvidenceBusy[\s\S]{0,80}qaReportShareBusy/,
  );
  assert.ok(
    (qa.match(/editable=\{!qaEditControlsDisabled\}/g)?.length ?? 0) >= 5,
    "every QA note editor must freeze while hydration, persistence, or sharing blocks edits",
  );
  assert.ok(
    (qa.match(/disabled=\{qaEditControlsDisabled\}/g)?.length ?? 0) >= 10,
    "evidence and review actions must expose the full edit-admission gate",
  );
});

test("keeps long modal forms reachable above compact screens and the keyboard", () => {
  const calendar = readMobile("app", "(tabs)", "calendar.tsx");
  const records = readMobile("components", "health", "RecordsScreen.tsx");
  const dogProfile = readMobile("components", "more", "DogProfileScreen.tsx");
  const diet = readMobile("components", "health", "DietScreen.tsx");

  assert.match(calendar, /KeyboardAvoidingView/);
  assert.match(calendar, /getKeyboardAvoidingVerticalOffset/);
  assert.match(calendar, /modalDock:\s*\{\s*flex:\s*1,\s*justifyContent:\s*"flex-end"\s*\}/);
  assert.match(calendar, /modalSheet:\s*\{[^}]*maxHeight:\s*"92%"/);
  assert.equal(
    calendar.match(/style=\{s\.modalFormScroll\}/g)?.length,
    2,
    "both Calendar editor sheets need their own vertical form scroller",
  );
  assert.equal(
    calendar.match(/keyboardShouldPersistTaps="handled"/g)?.length,
    2,
    "both Calendar editor sheets keep actions usable while the keyboard is open",
  );

  assert.match(
    records,
    /<ScrollView\s+keyboardShouldPersistTaps="handled"\s+showsVerticalScrollIndicator\s+bounces=\{false\}\s+style=\{s\.recordFormScroll\}/,
  );
  assert.match(records, /recordFormScroll:\s*\{\s*flexShrink:\s*1\s*\}/);
  assert.match(records, /recordFormContent:\s*\{[^}]*paddingBottom:/);

  for (const [label, source] of [
    ["Dog Profile", dogProfile],
    ["Diet Profile", diet],
  ] as const) {
    assert.match(source, /KeyboardAvoidingView/, `${label} must avoid the keyboard`);
    assert.match(source, /getKeyboardAvoidingVerticalOffset/);
    assert.match(
      source,
      /behavior=\{Platform\.OS === "ios" \? "padding" : undefined\}/,
    );
    assert.match(source, /keyboardShouldPersistTaps="handled"/);
    assert.match(
      source,
      /profileFormScroll:\s*\{[^}]*flexShrink:\s*1[^}]*minHeight:\s*0/,
      `${label} must let its long form shrink and scroll above the keyboard`,
    );
  }
});

test("keeps owner tooling and proof language outside the consumer candidate", () => {
  const qaRoute = readMobile("app", "care-twin-qa.tsx");
  const premiumRoute = readMobile("app", "premium.tsx");
  const signInRoute = readMobile("app", "(auth)", "sign-in.tsx");
  const signUpRoute = readMobile("app", "(auth)", "sign-up.tsx");
  const rootLayout = readMobile("app", "_layout.tsx");
  const boundary = readMobile(
    "components",
    "board",
    "OwnerOpsBoundary.tsx",
  );
  const primitives = readMobile(
    "components",
    "board",
    "BoardPrimitives.tsx",
  );
  const authUi = readMobile("components", "auth-ui.tsx");
  const avatarStudio = readMobile("components", "more", "AvatarStudioScreen.tsx");
  const records = readMobile("components", "health", "RecordsScreen.tsx");
  const privacy = readMobile(
    "components",
    "more",
    "PrivacyDataScreen.tsx",
  );
  const settings = readMobile(
    "components",
    "more",
    "SettingsScreen.tsx",
  );
  const notFound = readMobile("app", "+not-found.tsx");

  for (const route of [qaRoute, premiumRoute]) {
    assert.match(
      route,
      /if \(!isOwnerOpsBuild\(\)\) \{\s*return <OwnerOpsUnavailableScreen \/>;\s*\}/,
    );
    assert.doesNotMatch(route, /<OwnerOpsUnavailableScreen\s+title=/);
  }
  for (const route of [signInRoute, signUpRoute]) {
    assert.match(
      route,
      /if \(!isClerkEnabledForBuild\) \{\s*return <OwnerOpsUnavailableScreen \/>;\s*\}/,
    );
    assert.doesNotMatch(route, /<LocalPreviewGateway/);
  }

  const boundaryDetail = boundary.match(
    /This page isn't available[\s\S]*?More\./,
  )?.[0];
  assert.ok(boundaryDetail, "the neutral boundary must explain the next step");
  assert.doesNotMatch(
    boundaryDetail,
    /owner|internal|QA|proof|provider|store|reviewer/i,
  );
  assert.match(boundary, /title = "Page unavailable"/);
  assert.match(
    rootLayout,
    /name="premium"[\s\S]*?headerShown:\s*false[\s\S]*?name="privacy"/,
  );
  assert.match(
    rootLayout,
    /name="care-twin-qa"[\s\S]*?headerShown:\s*false[\s\S]*?name="trends"/,
  );
  assert.match(
    primitives,
    /const showQaReturn = isOwnerOpsBuild\(\) && qaReturn === "care-twin-qa"/,
  );
  assert.match(
    authUi,
    /const authSetupProofManifest = ownerOps \? buildAuthSetupProofManifest\(\) : null/,
  );
  assert.match(
    authUi,
    /\{ownerOps && authSetupProofManifest \? \(/,
  );
  assert.match(
    records,
    /const binaryProofManifest = ownerOps \? buildReportBinaryExportProofManifest\(/,
  );
  assert.match(records, /\{ownerOps && binaryProofManifest \? \(/);
  assert.match(
    privacy,
    /\{ownerOps \? \(\s*<BoardCard enter=\{1\}[\s\S]*title="Attachment queue"/,
  );
  assert.match(privacy, /<StatCard label="File refs"/);
  assert.match(settings, /Your care data stays on this device/);
  assert.doesNotMatch(settings, /provider|readiness|launch|proof|QA/i);
  assert.doesNotMatch(notFound, /Phoenix|QA|proof|provider|store/i);
  assert.doesNotMatch(
    avatarStudio,
    /Live PixelLab sprite rig|Still preview until|Sprite rig in production|Make me Phoenix|\{liveTemplateCount\}\/\{AVATAR_TEMPLATES\.length\} live/,
  );
});

test("keeps fresh-install names and care copy natural and truthful", () => {
  const setup = readMobile("app", "setup.tsx");
  const calendar = readMobile("app", "(tabs)", "calendar.tsx");
  const calendarMonth = readMobile("app", "calendar-month.tsx");
  const home = readMobile("app", "(tabs)", "index.tsx");
  const livingRoom = readMobile("components", "LivingPhoenixRoom.tsx");
  const avatarContext = readMobile("context", "AvatarContext.tsx");
  const avatarStudioModel = readMobile("lib", "avatarStudio.ts");
  const authUi = readMobile("components", "auth-ui.tsx");
  const log = readMobile("app", "(tabs)", "log.tsx");
  const records = readMobile("components", "health", "RecordsScreen.tsx");
  const careTeam = readMobile(
    "components",
    "more",
    "CareTeamSuppliesScreen.tsx",
  );
  const woofGuide = readMobile("components", "more", "WoofGuideScreen.tsx");
  const reminders = readFileSync(
    join(ROOT, "lib", "care-domain", "src", "care-reminders.ts"),
    "utf8",
  );
  const medication = readFileSync(
    join(ROOT, "lib", "care-domain", "src", "medication.ts"),
    "utf8",
  );

  assert.match(setup, /placeholder="Your name"/);
  assert.doesNotMatch(setup, /placeholder="Apollo"/);
  assert.doesNotMatch(setup, /placeholder="Phoenix(?: House)?"/);
  assert.doesNotMatch(calendar, /Household Sync|reminder candidates?/i);
  assert.match(calendar, /eyebrow:\s*"Care team"/);
  assert.match(calendar, /more reminder/);
  assert.doesNotMatch(careTeam, /\?\?\s*"Apollo"/);
  assert.doesNotMatch(reminders, /reminder candidates?/i);
  assert.doesNotMatch(medication, /reminder candidate/i);
  assert.match(home, /buildPetSetupCopy\(state\.profile\.name\)/);
  assert.doesNotMatch(home, /Let's make \{petName\} yours|Phoenix \$\{avatarTemplate\.label\}/);
  assert.doesNotMatch(calendarMonth, /log Phoenix's first moment/);
  assert.doesNotMatch(livingRoom, /`Phoenix room|"PHOENIX TWIN"|\?\? "Shepherd"|\?\? "Phoenix"/);
  assert.doesNotMatch(
    avatarContext,
    /createDefaultAvatarConfig\("Phoenix"\)|normalizeAvatarConfig\(JSON\.parse\(raw\), "Phoenix"\)|config\.petName \|\| "Phoenix"|petName = "Phoenix"/,
  );
  assert.match(avatarContext, /DEFAULT_PET_PLACEHOLDER/);
  assert.doesNotMatch(
    avatarStudioModel,
    /createDefaultAvatarConfig\(petName = "Phoenix"|normalizeAvatarConfig\(input: unknown, petName = "Phoenix"/,
  );
  assert.doesNotMatch(authUi, /Set up Phoenix/);
  assert.match(authUi, /Set up your dog/);
  assert.doesNotMatch(
    `${authUi}\n${readMobile("app", "(auth)", "sign-in.tsx")}\n${readMobile("app", "(auth)", "sign-up.tsx")}`,
    /Phoenix care starts here|review Phoenix's|Phoenix's care twin|production sync providers/i,
  );
  assert.match(authUi, /Your dog's care starts here/);
  assert.match(woofGuide, /placeholder=\{`Ask about \$\{name\}\.\.\.`\}/);
  assert.doesNotMatch(woofGuide, /placeholder=\{`Ask about \$\{state\.profile\.name\}/);
  assert.doesNotMatch(
    `${log}\n${records}`,
    /durable app storage|local proof file|Attach proof photo|Proof not attached|care log is accurate/i,
  );
});
