import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type { CareState, Entry } from "../context/CareContext.tsx";
import {
  computeCareStreak,
  deriveCareInitialSyncDashboard,
  deriveCareStorageRecoveryAction,
  deriveCareStorageUnavailableDashboard,
  derivePhoenixStatus,
  isCareEntryObservableAt,
} from "./phoenixStatus.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-08-28T09:00:00-07:00").getTime();

function careState(
  entries: Entry[] = [],
  routines: CareState["routines"] = [],
): CareState {
  return {
    entries,
    routines,
  } as unknown as CareState;
}

function entry(
  patch: Partial<Entry> & Pick<Entry, "id" | "type" | "occurredAt">,
): Entry {
  return {
    title: "Care evidence",
    caregiver: "Owner",
    note: "",
    ...patch,
  } as Entry;
}

test("an empty profile exposes no mood or energy fact", () => {
  const status = derivePhoenixStatus(careState(), NOW);

  assert.deepEqual(status.evidence, {
    mood: null,
    energy: null,
  });
});

test("a clock and scheduled walk cannot become a claimed pet mood", () => {
  const status = derivePhoenixStatus(
    careState(
      [],
      [
        {
          id: "walk-soon",
          label: "Morning walk",
          type: "walk",
          time: "9:30 AM",
          owner: "Owner",
          note: "",
        },
      ],
    ),
    NOW,
  );

  assert.equal(status.minutesUntilNext, 30);
  assert.equal(status.evidence.mood, null);
  assert.equal(status.evidence.energy, null);
});

test("explicit logged observations still derive mood and energy status", () => {
  const status = derivePhoenixStatus(
    careState([
      entry({
        id: "happy-walk",
        type: "walk",
        mood: "happy",
        occurredAt: "2026-08-28T08:20:00-07:00",
        details: { energyLevel: "high" },
      }),
    ]),
    NOW,
  );

  assert.equal(status.evidence.mood, "happy");
  assert.equal(status.evidence.energy, "high");
  assert.equal(status.energy, 96);
});

test("activity remains activity and cannot become an observed energy fact", () => {
  const status = derivePhoenixStatus(
    careState([
      entry({
        id: "walk-only",
        type: "walk",
        occurredAt: "2026-08-28T08:20:00-07:00",
      }),
    ]),
    NOW,
  );

  assert.equal(status.evidence.mood, null);
  assert.equal(status.evidence.energy, null);
  assert.ok(status.energy > 0, "animation may retain a derived activity value");
});

test("entry categories alone do not invent a mood observation", () => {
  const symptomStatus = derivePhoenixStatus(
    careState([
      entry({
        id: "symptom-without-mood",
        type: "symptom",
        occurredAt: "2026-08-28T08:20:00-07:00",
      }),
    ]),
    NOW,
  );
  const aloneStatus = derivePhoenixStatus(
    careState([
      entry({
        id: "alone-without-mood",
        type: "alone",
        occurredAt: "2026-08-28T08:20:00-07:00",
      }),
    ]),
    NOW,
  );

  assert.equal(symptomStatus.evidence.mood, null);
  assert.equal(aloneStatus.evidence.mood, null);
});

test("arbitrary and negated prose cannot become mood or energy evidence", () => {
  const status = derivePhoenixStatus(
    careState([
      entry({
        id: "negated-prose",
        type: "note",
        title: "Not anxious and not unwell",
        note: "No nervous behavior; energy was not low.",
        occurredAt: "2026-08-28T08:20:00-07:00",
        details: {
          moodContext: "Owner was anxious about work",
          energy: "high",
        },
      }),
    ]),
    NOW,
  );

  assert.deepEqual(status.evidence, { mood: null, energy: null });
});

test("private status evidence is removed before timestamp and sensitive fields", () => {
  let timestampRead = false;
  let moodRead = false;
  let titleRead = false;
  const privateEntry = {
    id: "private-mood",
    type: "mood",
    caregiver: "Owner",
    note: "",
    details: { householdVisible: false },
    get occurredAt(): string {
      timestampRead = true;
      throw new Error("private timestamp must not be read");
    },
    get mood(): string {
      moodRead = true;
      throw new Error("private mood must not be read");
    },
    get title(): string {
      titleRead = true;
      throw new Error("private title must not be read");
    },
  } as Entry;

  const status = derivePhoenixStatus(careState([privateEntry]), NOW);
  assert.deepEqual(status.evidence, { mood: null, energy: null });
  assert.equal(computeCareStreak(careState([privateEntry]), NOW), 0);
  assert.equal(timestampRead, false);
  assert.equal(moodRead, false);
  assert.equal(titleRead, false);
});

test("explicit energy observations drive the presented energy evidence", () => {
  const observed = (energyLevel: "low" | "steady" | "high") =>
    derivePhoenixStatus(
      careState([
        entry({
          id: `energy-${energyLevel}`,
          type: "mood",
          occurredAt: "2026-08-28T08:20:00-07:00",
          details: { energyLevel },
        }),
      ]),
      NOW,
    );

  const low = observed("low");
  const steady = observed("steady");
  const high = observed("high");

  assert.equal(low.evidence.energy, "low");
  assert.equal(steady.evidence.energy, "steady");
  assert.equal(high.evidence.energy, "high");
  assert.ok(low.energy < steady.energy);
  assert.ok(steady.energy < high.energy);
});

test("neutral alone-time entries do not invent anxiety, while explicit outcomes remain observable", () => {
  const neutral = derivePhoenixStatus(
    careState([
      entry({
        id: "alone-neutral",
        type: "alone",
        occurredAt: "2026-08-28T08:00:00-07:00",
      }),
      entry({
        id: "alone-calm",
        type: "alone",
        occurredAt: "2026-08-28T08:10:00-07:00",
        details: { aloneOutcome: "settled" },
      }),
    ]),
    NOW,
  );
  assert.notEqual(neutral.evidence.mood, "anxious");

  const anxious = derivePhoenixStatus(
    careState([
      entry({
        id: "alone-anxious",
        type: "alone",
        occurredAt: "2026-08-28T08:20:00-07:00",
        details: { aloneOutcome: "anxious" },
      }),
    ]),
    NOW,
  );
  assert.equal(anxious.evidence.mood, "anxious");
});

test("future and malformed entries are rejected from status and streak evidence", () => {
  const futureToday = entry({
    id: "future-today",
    type: "mood",
    mood: "anxious",
    occurredAt: "2026-08-28T11:00:00-07:00",
    details: { energyLevel: "high" },
  });
  const invalid = entry({
    id: "invalid-time",
    type: "mood",
    mood: "happy",
    occurredAt: "not-a-date",
    details: { energyLevel: "high" },
  });

  assert.equal(isCareEntryObservableAt(futureToday, NOW), false);
  assert.equal(isCareEntryObservableAt(invalid, NOW), false);
  const status = derivePhoenixStatus(careState([futureToday, invalid]), NOW);
  assert.deepEqual(status.evidence, { mood: null, energy: null });
  assert.equal(computeCareStreak(careState([futureToday, invalid]), NOW), 0);
});

test("unhydrated care storage withholds saved claims and default counts", () => {
  const dashboard = deriveCareStorageUnavailableDashboard({
    isLoaded: false,
    storageWarning: null,
  });

  assert.ok(dashboard);
  assert.equal(dashboard.status, "loading");
  assert.equal(dashboard.title, "Checking device storage");
  assert.ok(dashboard.metrics.every((metric) => metric.value === "—"));
  assert.doesNotMatch(
    `${dashboard.title} ${dashboard.message}`,
    /healthy|saved on this device/i,
  );
});

test("hydrated identity-scoped local data stays trustworthy while provider sync is pending", () => {
  const storageDashboard = deriveCareStorageUnavailableDashboard({
    isLoaded: true,
    isInitialSyncSettled: false,
    storageWarning: null,
  });

  assert.equal(storageDashboard, null);
  const providerDashboard = deriveCareInitialSyncDashboard({
    status: {
      state: "pending",
      isSettled: false,
      retryable: false,
      message: null,
    },
    totalEntries: 3,
    caregiverCount: 2,
  });
  assert.ok(providerDashboard);
  assert.equal(providerDashboard.status, "loading");
  assert.equal(providerDashboard.title, "Checking household updates");
  assert.equal(providerDashboard.actionLabel, "Checking");
  assert.deepEqual(
    providerDashboard.metrics.map((metric) => metric.value),
    ["3 entries", "2 members", "Checking"],
  );
  assert.match(providerDashboard.message, /device care record is available/i);
});

test("terminal provider refresh failure keeps local facts visible and offers a real retry", () => {
  const dashboard = deriveCareInitialSyncDashboard({
    status: {
      state: "error",
      isSettled: false,
      retryable: true,
      message:
        "WoofWatcher could not confirm the current household records. Try again.",
    },
    totalEntries: 1,
    caregiverCount: 1,
  });

  assert.ok(dashboard);
  assert.equal(dashboard.status, "attention");
  assert.equal(dashboard.actionLabel, "Retry household sync");
  assert.deepEqual(
    dashboard.metrics.map((metric) => metric.value),
    ["1 entry", "1 member", "Needs retry"],
  );
  assert.match(
    `${dashboard.message} ${dashboard.nextStep}`,
    /saved (?:device|on-device) data/i,
  );
});

test("a future-schema provider block asks for an update and never offers a fake retry", () => {
  const dashboard = deriveCareInitialSyncDashboard({
    status: {
      state: "error",
      isSettled: false,
      retryable: false,
      message:
        "These household records were saved by a newer WoofWatcher version.",
    },
    totalEntries: 1,
    caregiverCount: 1,
  });

  assert.ok(dashboard);
  assert.equal(dashboard.status, "attention");
  assert.equal(dashboard.actionLabel, "Update required");
  assert.deepEqual(
    dashboard.metrics.map((metric) => metric.value),
    ["1 entry", "1 member", "Update required"],
  );
  assert.match(
    `${dashboard.title} ${dashboard.message} ${dashboard.nextStep}`,
    /update/i,
  );
  assert.doesNotMatch(
    `${dashboard.actionLabel} ${dashboard.nextStep}`,
    /retry/i,
  );
});

test("settled provider refresh needs no dashboard override", () => {
  assert.equal(
    deriveCareInitialSyncDashboard({
      status: {
        state: "settled",
        isSettled: true,
        retryable: false,
        message: null,
      },
      totalEntries: 4,
      caregiverCount: 2,
    }),
    null,
  );
});

test("a read failure stays visible and cannot expose trustworthy counts", () => {
  const dashboard = deriveCareStorageUnavailableDashboard({
    isLoaded: false,
    storageWarning: "read-failed",
  });

  assert.ok(dashboard);
  assert.equal(dashboard.status, "attention");
  assert.equal(dashboard.title, "Saved care data unavailable");
  assert.ok(dashboard.metrics.every((metric) => metric.value === "—"));
  assert.match(dashboard.message, /could not read/i);
});

test("healthy local storage returns no override once hydration is trustworthy", () => {
  assert.equal(
    deriveCareStorageUnavailableDashboard({
      isLoaded: true,
      storageWarning: null,
    }),
    null,
  );
});

test("a storage reset never promises a recovery copy without evidence", () => {
  const dashboard = deriveCareStorageUnavailableDashboard({
    isLoaded: true,
    storageWarning: "reset",
  });

  assert.ok(dashboard);
  assert.doesNotMatch(
    `${dashboard.message} ${dashboard.nextStep}`,
    /recovery copy remains|recovery copy is (?:available|saved)/i,
  );
});

test("storage recovery actions exist only when the shown action can really run", () => {
  assert.deepEqual(
    deriveCareStorageRecoveryAction({
      isLoaded: false,
      isInitialSyncSettled: false,
      storageWarning: "read-failed",
    }),
    { kind: "retry-read", label: "Retry saved data" },
  );
  assert.deepEqual(
    deriveCareStorageRecoveryAction({
      isLoaded: true,
      isInitialSyncSettled: false,
      storageWarning: "save-failed",
    }),
    { kind: "retry-save", label: "Retry device save" },
  );

  for (const input of [
    { isLoaded: false, isInitialSyncSettled: false, storageWarning: null },
    {
      isLoaded: true,
      isInitialSyncSettled: true,
      storageWarning: "reset" as const,
    },
    {
      isLoaded: true,
      isInitialSyncSettled: true,
      storageWarning: "newer-version" as const,
    },
  ]) {
    assert.equal(deriveCareStorageRecoveryAction(input), null);
  }
});

test("More fact presentation withholds care-derived facts until storage is trusted", async () => {
  const phoenixModule = await import("./phoenixStatus.ts");
  const derivePresentation = (
    phoenixModule as unknown as Record<string, unknown>
  ).deriveMoreCareFactsPresentation as
    | ((input: {
        isLoaded: boolean;
        storageWarning: "save-failed" | null;
        isInitialSyncSettled?: boolean;
        routineCount: number;
        todayLogCount: number;
        streakDays: number;
      }) => {
        trusted: boolean;
        routineCount: number | null;
        todayLogCount: number | null;
        streakDays: number | null;
        careIntelligenceAvailable: boolean;
      })
    | undefined;

  assert.equal(typeof derivePresentation, "function");
  assert.ok(derivePresentation);

  for (const input of [
    { isLoaded: false, storageWarning: null },
    { isLoaded: true, storageWarning: "save-failed" as const },
  ]) {
    assert.deepEqual(
      derivePresentation({
        ...input,
        routineCount: 4,
        todayLogCount: 3,
        streakDays: 2,
      }),
      {
        trusted: false,
        routineCount: null,
        todayLogCount: null,
        streakDays: null,
        careIntelligenceAvailable: false,
      },
    );
  }

  assert.deepEqual(
    derivePresentation({
      isLoaded: true,
      isInitialSyncSettled: false,
      storageWarning: null,
      routineCount: 4,
      todayLogCount: 3,
      streakDays: 2,
    }),
    {
      trusted: true,
      routineCount: 4,
      todayLogCount: 3,
      streakDays: 2,
      careIntelligenceAvailable: true,
    },
  );
});

test("More consumes evidence and storage trust instead of rendering fallbacks as facts", () => {
  const source = readFileSync(
    new URL("../app/(tabs)/more.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /deriveCareStorageUnavailableDashboard/);
  assert.match(source, /deriveMoreCareFactsPresentation/);
  assert.match(source, /storageWarning/);
  assert.match(source, /status\.evidence\.mood/);
  assert.match(source, /status\.evidence\.energy/);
  assert.match(source, /moreCareFacts\.routineCount/);
  assert.match(source, /moreCareFacts\.todayLogCount/);
  assert.match(source, /moreCareFacts\.careIntelligenceAvailable\s*\?/);
  assert.match(
    source,
    /consumerSurfacePolicy\.providerSyncControls\s*&&\s*!careStorageUnavailable/,
  );
  assert.match(source, /No data/);
  assert.match(source, /retryLocalHydration/);
  assert.match(source, /persistCurrentCareSnapshot/);
  assert.match(source, /isInitialSyncSettled/);
  assert.match(source, /initialSyncStatus/);
  assert.match(source, /retryInitialSync/);
  assert.match(source, /deriveCareInitialSyncDashboard/);
  assert.match(
    source,
    /initialSyncStatus\.state === "error"\s*&&\s*initialSyncStatus\.retryable[\s\S]{0,180}retryInitialSync\(\)/,
  );
  assert.doesNotMatch(
    source,
    /const careStorageUnavailable\s*=\s*[\s\S]{0,100}!isInitialSyncSettled/,
  );
  assert.match(source, /careStorageRecoveryAction\.kind === "retry-read"/);
  assert.match(source, /careStorageRecoveryAction\.kind === "retry-save"/);
  assert.doesNotMatch(
    source,
    /careStorageUnavailable[\s\S]{0,300}actionLabel:\s*"Retry"/,
  );
});

test("More hides personal profile identity until device storage is trusted", () => {
  const source = readFileSync(
    new URL("../app/(tabs)/more.tsx", import.meta.url),
    "utf8",
  );

  const routeHeaderAt = source.indexOf("<BoardRouteHeader");
  const directoryAt = source.indexOf("<BoardCard enter={0}", routeHeaderAt);
  const routeHeader = source.slice(routeHeaderAt, directoryAt);
  assert.match(routeHeader, /careStorageUnavailable\s*\?/);
  assert.match(routeHeader, /Care tools, records, household, and settings\./);

  const recoveryAt = source.indexOf(
    'accessibilityLabel="Care profile storage unavailable"',
  );
  const profileAt = source.indexOf("{/* Profile header card */}");
  assert.ok(recoveryAt > routeHeaderAt && recoveryAt < profileAt);

  const profileEnd = source.indexOf("{/* Today's status strip */}", profileAt);
  const profile = source.slice(profileAt, profileEnd);
  assert.match(profile, /!careStorageUnavailable\s*\?/);

  const woofGuideAt = source.indexOf('label: "WoofGuide Assistant"');
  const woofGuide = source.slice(woofGuideAt, woofGuideAt + 260);
  assert.match(woofGuide, /careStorageUnavailable\s*\?/);
  assert.match(woofGuide, /Ask about your dog's care, diet, and patterns/);

  const directoryRendererAt = source.indexOf(
    "const renderCanonicalDirectoryRow",
  );
  const directoryRenderer = source.slice(
    directoryRendererAt,
    directoryRendererAt + 1_900,
  );
  assert.match(directoryRenderer, /item\.id === "dog-profile"/);
  assert.match(directoryRenderer, /careStorageUnavailable/);
  assert.match(directoryRenderer, /careFactsUnavailableAction/);
  assert.match(directoryRenderer, /careFactsUnavailableActionLabel/);
  assert.match(directoryRenderer, /accessibilityHint=/);

  const recoveryActionStyle = source.slice(
    source.indexOf("providerSetupRowAction: {"),
    source.indexOf(
      "providerSetupRowActionText:",
      source.indexOf("providerSetupRowAction: {"),
    ),
  );
  assert.match(recoveryActionStyle, /minHeight:\s*MIN_MOBILE_TOUCH_TARGET/);

  const dogProfileSource = readFileSync(
    new URL("../components/more/DogProfileScreen.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    dogProfileSource,
    /profileStorageUnavailable\s*=\s*!isLoaded\s*\|\|\s*storageWarning !== null/,
  );
  const recoveryReturnAt = dogProfileSource.indexOf(
    "if (profileStorageUnavailable)",
  );
  const trustedReturnAt = dogProfileSource.indexOf(
    "{/* Full-bleed park hero",
    recoveryReturnAt,
  );
  assert.ok(recoveryReturnAt > 0 && trustedReturnAt > recoveryReturnAt);
  const recoverySurface = dogProfileSource.slice(
    recoveryReturnAt,
    trustedReturnAt,
  );
  assert.match(recoverySurface, /Profile details hidden/);
  assert.doesNotMatch(
    recoverySurface,
    /\{petName\}|profile\.breed|getAvatarSource/,
  );
});

test("Home and More present only explicit categorical energy evidence", () => {
  const source = readFileSync(
    new URL("../app/(tabs)/more.tsx", import.meta.url),
    "utf8",
  );
  const homeSource = readFileSync(
    new URL("../app/(tabs)/index.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /accessibilityLabel="Energy level"[\s\S]{0,300}accessibilityValue=/,
  );
  assert.match(source, /status\.evidence\.energy/);
  assert.match(source, /text: energyEvidenceLabel/);
  assert.doesNotMatch(source, /status\.evidence\.energy\s*-/);
  assert.match(
    homeSource,
    /const hasEnergyEvidence = status\.evidence\.energy !== null/,
  );
  assert.match(homeSource, /energyEvidenceLabel/);
  assert.doesNotMatch(
    homeSource,
    /valueLabel=\{hasEnergyEvidence \? `\$\{status\.energy\}%`/,
  );
  assert.doesNotMatch(homeSource, /Energy \$\{status\.energy\} percent/);
});

test("Home and More filter future care entries before today/streak/latest facts", () => {
  const moreSource = readFileSync(
    new URL("../app/(tabs)/more.tsx", import.meta.url),
    "utf8",
  );
  const homeSource = readFileSync(
    new URL("../app/(tabs)/index.tsx", import.meta.url),
    "utf8",
  );

  assert.match(moreSource, /observedEntries\s*=\s*useMemo/);
  assert.match(moreSource, /selectSharedCareEvidence\(entries, now\)/);
  assert.match(moreSource, /todayLogCount[\s\S]{0,500}observedEntries\.filter/);
  assert.match(
    moreSource,
    /latestCareUpdate[\s\S]{0,500}observedEntries\.reduce/,
  );

  const homeEntriesStart = homeSource.indexOf("const homeEntries = useMemo(");
  const todayEntriesStart = homeSource.indexOf(
    "const todayHomeEntries = useMemo(",
    homeEntriesStart,
  );
  assert.notEqual(
    homeEntriesStart,
    -1,
    "Home must establish an evidence boundary",
  );
  assert.notEqual(
    todayEntriesStart,
    -1,
    "Home evidence boundary must be bounded",
  );
  const homeEvidenceBoundary = homeSource.slice(
    homeEntriesStart,
    todayEntriesStart,
  );
  assert.match(
    homeEvidenceBoundary,
    /selectObservableHomeEntries\(state\.entries, now\)/,
  );
  assert.match(homeEvidenceBoundary, /\[now, state\.entries\]/);
  assert.doesNotMatch(homeEvidenceBoundary, /state\.entries\.filter\(/);
});

test("More primary and forest CTAs use the theme foreground", () => {
  const source = readFileSync(
    new URL("../app/(tabs)/more.tsx", import.meta.url),
    "utf8",
  );
  for (const label of [
    "Edit WoofWatcher provider launch setup",
    "Share WoofWatcher provider setup plan",
    "Share Native QA capture plan",
    "Share WoofWatcher release packet",
    "Share WoofWatcher store submission packet",
    "Open WoofWatcher Plus",
  ]) {
    const actionStart = source.indexOf(`accessibilityLabel="${label}"`);
    assert.notEqual(actionStart, -1, `missing More action: ${label}`);
    const actionEnd = source.indexOf("</Pressable>", actionStart);
    assert.notEqual(actionEnd, -1, `unbounded More action: ${label}`);
    const action = source.slice(actionStart, actionEnd);
    assert.match(action, /color=\{colors\.primaryForeground\}/);
    assert.match(action, /color: colors\.primaryForeground/);
    assert.doesNotMatch(action, /#FFFFFF|#fff|color: "white"/i);
  }
});

test("More provider notes field has a programmatic label", () => {
  const source = readFileSync(
    new URL("../app/(tabs)/more.tsx", import.meta.url),
    "utf8",
  );
  const placeholder =
    'placeholder="What still needs keys, rules, account approval, or QA?"';
  const placeholderAt = source.indexOf(placeholder);
  assert.notEqual(placeholderAt, -1);
  const field = source.slice(
    Math.max(0, placeholderAt - 300),
    placeholderAt + 300,
  );
  assert.match(field, /accessibilityLabel="Provider operator notes"/);
});

test("More leaves entrance ownership with its Reduce-Motion-aware cards", () => {
  const source = readFileSync(
    new URL("../app/(tabs)/more.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /import \{ useReducedMotion \} from "react-native-reanimated"/,
  );
  assert.match(source, /const reducedMotion = useReducedMotion\(\)/);
  assert.match(source, /<BoardCard enter=\{0\}/);
  assert.doesNotMatch(source, /new Animated\.Value|opacity: fade/);
});
