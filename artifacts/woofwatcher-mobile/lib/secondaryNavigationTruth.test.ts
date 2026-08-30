import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const MOBILE_ROOT = existsSync(
  join(process.cwd(), "artifacts", "woofwatcher-mobile"),
)
  ? join(process.cwd(), "artifacts", "woofwatcher-mobile")
  : process.cwd();

const RECORDS_PATH = join(
  MOBILE_ROOT,
  "components",
  "health",
  "RecordsScreen.tsx",
);
const WOOFGUIDE_PATH = join(
  MOBILE_ROOT,
  "components",
  "more",
  "WoofGuideScreen.tsx",
);
const AVATAR_STUDIO_PATH = join(
  MOBILE_ROOT,
  "components",
  "more",
  "AvatarStudioScreen.tsx",
);
const PREMIUM_PATH = join(MOBILE_ROOT, "app", "premium.tsx");

function read(path: string): string {
  assert.equal(existsSync(path), true, `missing navigation input: ${path}`);
  return readFileSync(path, "utf8");
}

function between(source: string, start: string, end: string): string {
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end, startAt + start.length);
  assert.notEqual(startAt, -1, `missing start anchor: ${start}`);
  assert.notEqual(endAt, -1, `missing end anchor: ${end}`);
  return source.slice(startAt, endAt);
}

test("Records consumes valid entry and report deep links and explains stale targets", () => {
  const records = read(RECORDS_PATH);
  const targetEffect = between(
    records,
    "// Resolve one canonical Records target at a time",
    "// Chart geometry",
  );

  assert.match(
    records,
    /export default function RecordsScreen\(\{[\s\S]*entryId,[\s\S]*reportId,[\s\S]*onBack/,
  );
  assert.match(
    records,
    /import \{[\s\S]*createRecordsDeepLinkController,[\s\S]*decideRecordsDeepLinkRequest,[\s\S]*\} from "@\/lib\/recordsDeepLink"/,
  );
  assert.match(
    targetEffect,
    /deepLinkController\.next\([\s\S]*decideRecordsDeepLinkRequest\(\{[\s\S]*entryId,[\s\S]*reportId,[\s\S]*isLoaded,[\s\S]*isSyncing,[\s\S]*isInitialSyncSettled/,
  );
  assert.doesNotMatch(
    targetEffect,
    /requestAnimationFrame|cancelAnimationFrame/,
  );
  assert.match(records, /createRecordsDeepLinkController\(\)/);
  assert.match(targetEffect, /if \(!action\) return/);
  assert.match(
    targetEffect,
    /router\.replace\(\{ pathname: "\/log", params: \{ entry: action\.id \} \}\)/,
  );
  assert.match(targetEffect, /Record entry unavailable/);
  assert.match(
    targetEffect,
    /state\.reportArtifacts\.find\([\s\S]*artifact\.id === action\.id/,
  );
  assert.match(
    targetEffect,
    /setCarePassPreviewAudience\(matchingReport\.audience\)/,
  );
  assert.match(targetEffect, /Report preset unavailable/);
});

test("Premium Back to care has a deterministic deep-link fallback", () => {
  const premium = read(PREMIUM_PATH);
  const labelAt = premium.indexOf('accessibilityLabel="Back to care"');
  const actionStart = premium.lastIndexOf("<Pressable", labelAt);
  const actionEnd = premium.indexOf("</Pressable>", labelAt);
  assert.ok(
    actionStart >= 0 && actionEnd > labelAt,
    "missing Back to care action",
  );
  const backAction = premium.slice(actionStart, actionEnd);

  assert.match(
    premium,
    /import \{ canonicalHomeRoute \} from "@\/lib\/canonicalRouteBuilders"/,
  );
  assert.match(backAction, /router\.canGoBack\(\)/);
  assert.match(backAction, /router\.back\(\)/);
  assert.match(
    backAction,
    /router\.replace\(canonicalHomeRoute\(\) as never\)/,
  );
});

test("Records deep-link decisions prioritize entry and wait for unsettled data", async () => {
  const {
    decideRecordsDeepLinkRequest,
  }: {
    decideRecordsDeepLinkRequest: (input: {
      entryId?: string;
      reportId?: string;
      isLoaded: boolean;
      isSyncing: boolean;
      isInitialSyncSettled: boolean;
      entryIds: readonly string[];
      reportIds: readonly string[];
    }) => { kind: string; id?: string; requestKey?: string };
  } = await import("./recordsDeepLink.ts");

  const bothParameters = {
    entryId: "entry-1",
    reportId: "report-1",
    entryIds: ["entry-1"],
    reportIds: ["report-1"],
  };
  assert.deepEqual(
    decideRecordsDeepLinkRequest({
      ...bothParameters,
      isLoaded: true,
      isSyncing: false,
      isInitialSyncSettled: true,
    }),
    { kind: "open-entry", id: "entry-1", requestKey: "entry:entry-1" },
  );

  const missingEntry = {
    entryId: "deferred-entry",
    isLoaded: true,
    isInitialSyncSettled: false,
    entryIds: [],
    reportIds: [],
  };
  assert.deepEqual(
    decideRecordsDeepLinkRequest({ ...missingEntry, isSyncing: true }),
    { kind: "wait", id: "deferred-entry", requestKey: "entry:deferred-entry" },
  );
  assert.deepEqual(
    decideRecordsDeepLinkRequest({
      ...missingEntry,
      isSyncing: true,
      entryIds: ["deferred-entry"],
    }),
    {
      kind: "wait",
      id: "deferred-entry",
      requestKey: "entry:deferred-entry",
    },
  );
  assert.deepEqual(
    decideRecordsDeepLinkRequest({
      ...missingEntry,
      isSyncing: false,
      isInitialSyncSettled: true,
      entryIds: ["deferred-entry"],
    }),
    {
      kind: "open-entry",
      id: "deferred-entry",
      requestKey: "entry:deferred-entry",
    },
  );
  assert.deepEqual(
    decideRecordsDeepLinkRequest({ ...missingEntry, isSyncing: false }),
    { kind: "wait", id: "deferred-entry", requestKey: "entry:deferred-entry" },
  );
  assert.deepEqual(
    decideRecordsDeepLinkRequest({
      ...missingEntry,
      isSyncing: false,
      isInitialSyncSettled: true,
    }),
    {
      kind: "unavailable-entry",
      id: "deferred-entry",
      requestKey: "entry:deferred-entry",
    },
  );
});

test("Records report links also stay pending until hydration and sync settle", async () => {
  const {
    decideRecordsDeepLinkRequest,
  }: {
    decideRecordsDeepLinkRequest: (input: {
      entryId?: string;
      reportId?: string;
      isLoaded: boolean;
      isSyncing: boolean;
      isInitialSyncSettled: boolean;
      entryIds: readonly string[];
      reportIds: readonly string[];
    }) => { kind: string; id?: string; requestKey?: string };
  } = await import("./recordsDeepLink.ts");

  const request = {
    reportId: "report-1",
    entryIds: [],
    reportIds: [],
  };
  assert.equal(
    decideRecordsDeepLinkRequest({
      ...request,
      isLoaded: false,
      isSyncing: false,
      isInitialSyncSettled: false,
    }).kind,
    "wait",
  );
  assert.equal(
    decideRecordsDeepLinkRequest({
      ...request,
      isLoaded: true,
      isSyncing: true,
      isInitialSyncSettled: false,
    }).kind,
    "wait",
  );
  assert.deepEqual(
    decideRecordsDeepLinkRequest({
      ...request,
      isLoaded: true,
      isSyncing: false,
      isInitialSyncSettled: true,
      reportIds: ["report-1"],
    }),
    { kind: "open-report", id: "report-1", requestKey: "report:report-1" },
  );
});

test("an unavailable Records target remains openable when a later sync supplies it", async () => {
  const { createRecordsDeepLinkController, decideRecordsDeepLinkRequest } =
    await import("./recordsDeepLink.ts");
  const controller = createRecordsDeepLinkController();
  const request = {
    entryId: "late-entry",
    isLoaded: true,
    isSyncing: false,
    isInitialSyncSettled: true,
    reportIds: [] as string[],
  };

  const unavailable = decideRecordsDeepLinkRequest({
    ...request,
    entryIds: [],
  });
  assert.equal(controller.next(unavailable)?.kind, "unavailable-entry");
  assert.equal(
    controller.next(unavailable),
    null,
    "the same unavailable request should notify once",
  );
  assert.deepEqual(
    controller.next(
      decideRecordsDeepLinkRequest({
        ...request,
        entryIds: ["late-entry"],
      }),
    ),
    {
      kind: "open-entry",
      id: "late-entry",
      requestKey: "entry:late-entry",
    },
  );
  assert.equal(
    controller.next(
      decideRecordsDeepLinkRequest({
        ...request,
        entryIds: ["late-entry"],
      }),
    ),
    null,
    "a successful open consumes the request",
  );
});

test("a Records target blocked by terminal initial-sync failure has a real retry action", () => {
  const records = read(RECORDS_PATH);

  assert.match(records, /initialSyncStatus,/);
  assert.match(records, /retryInitialSync,/);
  assert.match(
    records,
    /\(entryId \|\| reportId\) && initialSyncStatus\.state !== "settled"/,
  );
  assert.match(records, /Confirming current household records/);
  assert.match(records, /accessibilityRole="alert"/);
  assert.match(records, /onPress=\{retryInitialSync\}/);
  assert.match(
    records,
    /initialSyncStatus\.state === "error"\s*&&\s*initialSyncStatus\.retryable[\s\S]{0,120}<Pressable/,
  );
  assert.match(records, /Retry current household Records refresh/);
});

test("WoofGuide preview lands on the canonical Care Pass section", () => {
  const guide = read(WOOFGUIDE_PATH);
  const applyDraft = between(
    guide,
    "const applyDraft = useCallback",
    "return (",
  );
  const carePass = between(
    applyDraft,
    'if (draft.kind === "care_pass")',
    "\n    }",
  );

  assert.match(carePass, /pathname: "\/health"/);
  assert.match(carePass, /section: "care-pass"/);
  assert.doesNotMatch(carePass, /section: "records"/);
});

test("Avatar Studio Back confirms before discarding an unsaved draft", () => {
  const studio = read(AVATAR_STUDIO_PATH);
  const discardConfirmation = between(
    studio,
    "function confirmAvatarDraftDiscard",
    "export default function AvatarStudioScreen",
  );
  const requestBack = between(
    studio,
    "const requestAvatarStudioBack =",
    "const saveDraft = async",
  );

  assert.match(
    studio,
    /import\s*\{[^}]*confirmThroughSteps[^}]*\}\s*from "@\/lib\/confirmDialog"/,
  );
  assert.match(
    studio,
    /import\s*\{[^}]*requestAvatarDraftExit[^}]*\}\s*from "@\/lib\/avatarDraftExitGuard"/,
  );
  assert.match(
    discardConfirmation,
    /title: "Discard unsaved avatar changes\?"/,
  );
  assert.match(discardConfirmation, /confirmLabel: "Discard changes"/);
  assert.match(discardConfirmation, /cancelLabel: "Keep editing"/);
  assert.match(discardConfirmation, /destructive: true/);
  assert.match(discardConfirmation, /onConfirmed,[\s\S]*onCancelled/);
  assert.match(requestBack, /requestAvatarDraftExit\(\{/);
  assert.match(requestBack, /dirty: avatarDraftDirtyRef\.current/);
  assert.match(
    requestBack,
    /persistenceInFlight: avatarPersistenceInFlightRef\.current/,
  );
  assert.match(
    requestBack,
    /confirmationLatch: avatarDraftExitConfirmationLatchRef\.current/,
  );
  assert.match(requestBack, /confirmDiscard: confirmAvatarDraftDiscard/);
  assert.match(
    requestBack,
    /markClean: \(\) => clearAvatarDraftDirty\(avatarDraftDirtyRef\)/,
  );
  assert.match(requestBack, /exit: onBack/);
  assert.match(
    studio,
    /navigation\.addListener\("beforeRemove"[\s\S]*event\.preventDefault\(\)[\s\S]*requestAvatarDraftExit/,
  );
  assert.match(studio, /renderAvatarStudioHeader\(requestAvatarStudioBack\)/);
});

test("Records leaves entrance ownership with Reduce-Motion-aware cards", () => {
  const records = read(RECORDS_PATH);

  assert.match(records, /useReducedMotion/);
  assert.match(records, /const reducedMotion = useReducedMotion\(\)/);
  assert.match(records, /<BoardCard[\s\S]{0,100}enter=\{0\}/);
  assert.doesNotMatch(records, /new Animated\.Value|opacity: fade/);
  assert.match(records, /animated: false/);
});

test("Records empty-state actions use the theme foreground on primary", () => {
  const records = read(RECORDS_PATH);
  for (const label of ["Log a weight from the Log tab", "Add first record"]) {
    const actionStart = records.indexOf(`accessibilityLabel="${label}"`);
    assert.notEqual(actionStart, -1, `missing empty-state action: ${label}`);
    const actionEnd = records.indexOf("</Pressable>", actionStart);
    assert.notEqual(actionEnd, -1, `unbounded empty-state action: ${label}`);
    const action = records.slice(actionStart, actionEnd);
    assert.match(action, /backgroundColor: colors\.primary/);
    assert.match(action, /color=\{colors\.primaryForeground\}/);
    assert.match(action, /color: colors\.primaryForeground/);
    assert.doesNotMatch(action, /#FFFFFF|#fff|white/i);
  }
});

test("Records selected primary controls never hard-code white", () => {
  const records = read(RECORDS_PATH);
  const medicationFilters = between(
    records,
    "{MEDICATION_OUTCOME_FILTERS.map",
    "{medicationHistory.hasActiveFilters",
  );
  const recordTypes = between(records, "{RECORD_OPTIONS.map", "</ScrollView>");

  for (const control of [medicationFilters, recordTypes]) {
    assert.match(control, /active \? colors\.primary/);
    assert.match(control, /active\s*\?\s*colors\.primaryForeground/);
    assert.doesNotMatch(control, /#FFFFFF|#fff|white/i);
  }
});

test("Records medication and record editor inputs have programmatic labels", () => {
  const records = read(RECORDS_PATH);
  for (const [placeholder, labelPattern] of [
    [
      "Search meds, dose, caregiver...",
      /accessibilityLabel="Search medication history"/,
    ],
    [
      "${recordOption.label} name",
      /accessibilityLabel=\{`\$\{recordOption\.label\} title`\}/,
    ],
    ["YYYY-MM-DD (optional)", /accessibilityLabel=\{recordOption\.dueLabel\}/],
    [
      "Dose, provider, receipt amount, card details, or anything useful",
      /accessibilityLabel=\{`\$\{recordOption\.label\} notes`\}/,
    ],
  ] as const) {
    const placeholderAt = records.indexOf(
      `placeholder=${
        placeholder.startsWith("$")
          ? `{\`${placeholder}\`}`
          : `"${placeholder}"`
      }`,
    );
    assert.notEqual(placeholderAt, -1, `missing Records input: ${placeholder}`);
    const field = records.slice(
      Math.max(0, placeholderAt - 300),
      placeholderAt + 300,
    );
    assert.match(field, labelPattern);
  }
});
