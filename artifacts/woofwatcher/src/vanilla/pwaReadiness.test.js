import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHostedNudgePlan,
  buildReportArtifact,
  buildTalkToLogDraft,
  buildWoofGuideVetNoteDraft,
} from "./woof-operations.js";
import {
  buildCaregiverAccessModel,
  buildCloudSyncPlan,
  buildScopedCarePass,
} from "./woof-privacy-cloud.js";
import {
  buildCareHelperInput,
  buildCareHelperInstructions,
  compactAssistantContext,
} from "./openai-care-helper.js";
import {
  buildCareRoomTransfer,
  buildHouseholdPresenceStatus,
  buildLeavingHomeEntry,
  buildHomeIdentityCopy,
  buildImportReviewMessage,
  buildReportText,
  getAssistantContext,
  getAvatarState,
  getBileWatch,
  getDefaultState,
  getHouseholdPulse,
  getNotificationCenter,
} from "./woof-core.js";
import { buildProductViewModel } from "./woof-product-view-model.js";

const here = dirname(fileURLToPath(import.meta.url));
const appEntry = readFileSync(join(here, "app-entry.js"), "utf8");
const app = readFileSync(join(here, "app.js"), "utf8");
const productViewModel = readFileSync(join(here, "woof-product-view-model.js"), "utf8");
const core = readFileSync(join(here, "woof-core.js"), "utf8");

test("keeps Dog Profile identity canonical in owner-reviewed talk-to-log drafts", () => {
  const placeholder = buildTalkToLogDraft(
    "Breakfast was finished",
    { petName: "My Dog" },
    "2026-08-30T12:00:00.000Z",
  );
  const renamed = buildTalkToLogDraft(
    "Breakfast was finished",
    { petName: "  Mochi  " },
    "2026-08-30T12:00:00.000Z",
  );

  assert.match(placeholder.reviewPrompt, /Phoenix's care log/);
  assert.doesNotMatch(JSON.stringify(placeholder), /My Dog/);
  assert.match(renamed.reviewPrompt, /Mochi's care log/);
  assert.doesNotMatch(JSON.stringify(renamed), /Phoenix|My Dog/);
});

test("keeps Dog Profile identity canonical in the PWA avatar next-moment fallback", () => {
  const recentMeal = {
    id: "meal_recent",
    type: "meal",
    title: "Breakfast",
    occurredAt: "2026-08-14T11:30:00.000Z",
    householdVisible: true,
  };
  const placeholder = getAvatarState(
    { profile: { name: "My Dog" }, routines: [], entries: [recentMeal] },
    "2026-08-14T12:00:00.000Z",
  );
  const renamed = getAvatarState(
    { profile: { name: "  Mochi  " }, routines: [], entries: [recentMeal] },
    "2026-08-14T12:00:00.000Z",
  );

  assert.equal(placeholder.suggestedAction, "Log Phoenix's next moment");
  assert.equal(renamed.suggestedAction, "Log Mochi's next moment");
});

test("keeps Dog Profile identity canonical in the shared PWA product contract", () => {
  const placeholder = buildProductViewModel(
    { profile: { name: "My Dog", publicLabel: "My Dog" } },
    "2026-08-14T12:00:00.000Z",
  );
  const renamed = buildProductViewModel(
    { profile: { name: "  Mochi  ", publicLabel: "  Mochi  " } },
    "2026-08-14T12:00:00.000Z",
  );

  assert.equal(placeholder.phoenix.profile.name, "Phoenix");
  assert.equal(placeholder.phoenix.profile.publicLabel, "Phoenix");
  assert.doesNotMatch(JSON.stringify(placeholder), /My Dog/);
  assert.equal(renamed.phoenix.profile.name, "Mochi");
  assert.equal(renamed.phoenix.profile.publicLabel, "Mochi");
  assert.match(renamed.health.boundary, /Mochi needs a veterinarian/);
  assert.match(renamed.more.woofGuide.boundary, /Mochi's logs/);
  assert.doesNotMatch(renamed.health.boundary, /Phoenix/);
  assert.doesNotMatch(renamed.more.woofGuide.boundary, /Phoenix/);
});

test("keeps Dog Profile identity canonical in the PWA Home five-second answer", () => {
  const placeholder = buildHomeIdentityCopy(
    { profile: { name: "My Dog" } },
    {
      avatar: { mood: "home-alone", speech: "Waiting for the household." },
      pulse: { completedCount: 1, totalCount: 3, humans: [] },
      caregiverName: "friend",
    },
  );
  const renamed = buildHomeIdentityCopy(
    { profile: { name: "  Mochi  " } },
    {
      avatar: { mood: "settled", speech: "Care rhythm looks steady." },
      pulse: {
        completedCount: 1,
        totalCount: 3,
        humans: [{ name: "Emma", todayLogs: 2 }],
        nextAction: { label: "Evening walk" },
      },
      openMeal: { title: "Dinner" },
      caregiverName: "friend",
    },
  );

  assert.equal(placeholder.petName, "Phoenix");
  assert.equal(placeholder.presenceLabel, "Phoenix is home alone");
  assert.match(placeholder.room.speech, /Phoenix is home alone/);
  assert.doesNotMatch(JSON.stringify(placeholder), /My Dog/);
  assert.equal(renamed.petName, "Mochi");
  assert.equal(renamed.presenceLabel, "Mochi is with Emma");
  assert.match(renamed.room.detail, /whether Mochi ate all/);
  assert.doesNotMatch(JSON.stringify(renamed), /Phoenix|My Dog/);
});

test("keeps Dog Profile identity canonical in Household Pulse presence status", () => {
  const now = "2026-08-14T12:00:00.000Z";
  const placeholder = buildHouseholdPresenceStatus(
    {
      profile: { name: "My Dog" },
      entries: [{ caregiver: "Emma", occurredAt: "2026-08-14T11:00:00.000Z" }],
    },
    null,
    now,
  );
  const renamed = buildHouseholdPresenceStatus(
    { profile: { name: "  Mochi  " }, entries: [] },
    { caregiver: "Noah", occurredAt: "2026-08-14T11:30:00.000Z" },
    now,
  );

  assert.equal(placeholder.label, "Phoenix is with Emma");
  assert.match(placeholder.detail, /Phoenix is supervised/);
  assert.doesNotMatch(JSON.stringify(placeholder), /My Dog/);
  assert.equal(renamed.label, "Mochi is home alone");
  assert.equal(renamed.timerMinutes, 30);
  assert.doesNotMatch(JSON.stringify(renamed), /Phoenix|My Dog/);
});

test("keeps Dog Profile identity canonical in both PWA profile cards", () => {
  for (const source of [app, appEntry]) {
    assert.match(source, /const profileCopy = buildHomeIdentityCopy\(state, \{ avatar \}\)/);
    assert.match(source, /<h2>\$\{escapeHtml\(profileCopy\.petName\)\}<\/h2>/);
    assert.doesNotMatch(source, /<h2>\$\{escapeHtml\(state\.profile\.name\)\}<\/h2>/);
  }
});

test("keeps Dog Profile identity canonical in Bile Watch guidance", () => {
  const now = "2026-08-13T12:00:00.000Z";
  const placeholderState = getDefaultState(now);
  placeholderState.profile.name = "My Dog";
  placeholderState.entries = [{
    id: "meal-1",
    type: "meal",
    title: "Breakfast",
    occurredAt: "2026-08-13T01:00:00.000Z",
  }];
  const renamedState = structuredClone(placeholderState);
  renamedState.profile.name = "  Mochi  ";

  const placeholder = getBileWatch(placeholderState, now);
  const renamed = getBileWatch(renamedState, now);

  assert.match(placeholder.signals.join(" "), /Phoenix last logged food/);
  assert.match(placeholder.actions.join(" "), /Phoenix is willing/);
  assert.match(renamed.signals.join(" "), /Mochi last logged food/);
  assert.match(renamed.actions.join(" "), /Mochi is willing/);
  assert.doesNotMatch(JSON.stringify(renamed), /Phoenix|My Dog/);
});

test("keeps the Dog Profile identity canonical in durable PWA report artifacts", () => {
  const placeholder = buildReportArtifact(
    { profile: { name: "My Dog", publicLabel: "My Dog" } },
    { format: "text" },
    "2026-08-12T12:00:00.000Z",
  );
  const renamed = buildReportArtifact(
    { profile: { name: "  Mochi  ", publicLabel: "  Mochi  " } },
    { format: "text" },
    "2026-08-12T12:00:00.000Z",
  );

  assert.match(placeholder.sourceText, /^Phoenix Care Report/);
  assert.equal(placeholder.filename, "woofwatcher-phoenix-report-2026-08-12.txt");
  assert.match(placeholder.auditEvent.summary, /Phoenix/);
  assert.match(placeholder.privacy.boundary, /Phoenix care context/);
  assert.doesNotMatch(JSON.stringify(placeholder), /My Dog/);
  assert.match(renamed.sourceText, /^Mochi Care Report/);
  assert.equal(renamed.filename, "woofwatcher-mochi-report-2026-08-12.txt");
  assert.match(renamed.privacy.boundary, /Mochi care context/);
  assert.doesNotMatch(renamed.privacy.boundary, /Phoenix/);
});

test("keeps Dog Profile identity canonical in PWA notification guidance", () => {
  const placeholder = getNotificationCenter(
    { profile: { name: "My Dog" } },
    "2026-08-13T12:00:00.000Z",
    { permission: "denied" },
  );
  const renamed = getNotificationCenter(
    {
      profile: { name: "  Mochi  " },
      routines: [{ id: "routine_lunch", label: "Lunch", type: "meal", time: "12:00 PM" }],
      entries: [],
    },
    "2026-08-13T12:00:00.000Z",
    { permission: "denied" },
  );

  assert.match(placeholder.message, /Phoenix care/);
  assert.doesNotMatch(placeholder.message, /My Dog/);
  assert.match(renamed.message, /Mochi care/);
  assert.doesNotMatch(renamed.message, /Phoenix/);
  assert.match(renamed.nextNotification.title, /Mochi care/);
  assert.doesNotMatch(renamed.nextNotification.title, /Phoenix/);
});

test("keeps imported Dog Profile identity canonical in recovery review guidance", () => {
  const placeholder = buildImportReviewMessage({
    packageType: "woofwatcher.care-room-transfer",
    profile: { name: "My Dog" },
  });
  const renamed = buildImportReviewMessage({
    profile: { name: "  Mochi  " },
  });

  assert.match(placeholder, /Review Phoenix's handoff/);
  assert.doesNotMatch(placeholder, /My Dog/);
  assert.match(renamed, /Review Mochi's latest care timeline/);
  assert.doesNotMatch(renamed, /Phoenix/);
});

test("keeps Dog Profile identity canonical in the shared PWA assistant context", () => {
  const placeholder = getAssistantContext(
    { profile: { name: "My Dog", publicLabel: "My Dog" } },
    "Review today",
    "2026-08-13T12:00:00.000Z",
  );
  const renamed = getAssistantContext(
    { profile: { name: "  Mochi  ", publicLabel: "  Mochi  " } },
    "Review today",
    "2026-08-13T12:00:00.000Z",
  );

  assert.equal(placeholder.profile.name, "Phoenix");
  assert.equal(placeholder.profile.publicLabel, "Phoenix");
  assert.doesNotMatch(JSON.stringify(placeholder), /My Dog/);
  assert.equal(renamed.profile.name, "Mochi");
  assert.equal(renamed.profile.publicLabel, "Mochi");
  assert.match(renamed.localAnswer, /Mochi's care picture/);
  assert.doesNotMatch(renamed.localAnswer, /Phoenix/);
});

test("keeps Dog Profile identity canonical in base PWA reports and care-room transfers", () => {
  const now = "2026-08-12T12:00:00.000Z";
  const placeholder = {
    profile: { name: "My Dog", publicLabel: "My Dog" },
    entries: [],
  };
  const renamed = {
    profile: { name: "  Mochi  ", publicLabel: "  Mochi  " },
    entries: [],
  };

  const placeholderReport = buildReportText(placeholder, now);
  const renamedReport = buildReportText(renamed, now);
  const placeholderTransfer = buildCareRoomTransfer(placeholder, now);
  const renamedTransfer = buildCareRoomTransfer(renamed, now);

  assert.match(placeholderReport, /\nPhoenix - August 2026\n/);
  assert.doesNotMatch(placeholderReport, /My Dog/);
  assert.match(renamedReport, /\nMochi - August 2026\n/);
  assert.equal(placeholderTransfer.petName, "Phoenix");
  assert.equal(placeholderTransfer.state.profile.name, "Phoenix");
  assert.equal(placeholderTransfer.state.profile.publicLabel, "Phoenix");
  assert.doesNotMatch(JSON.stringify(placeholderTransfer), /My Dog/);
  assert.equal(renamedTransfer.petName, "Mochi");
  assert.equal(renamedTransfer.state.profile.name, "Mochi");
  assert.equal(renamedTransfer.state.profile.publicLabel, "Mochi");
});

test("keeps the Dog Profile identity canonical in PWA vet-note handoffs", () => {
  const context = {
    healthWatch: { signals: ["Appetite changed this week."] },
    bileWatch: { signals: ["One yellow-bile event is recorded."] },
    latest: [],
  };
  const placeholder = buildWoofGuideVetNoteDraft(
    { profile: { name: "My Dog" } },
    context,
  );
  const renamed = buildWoofGuideVetNoteDraft(
    { profile: { name: "  Mochi  " } },
    context,
  );

  assert.match(placeholder, /^Phoenix vet note draft/);
  assert.doesNotMatch(placeholder, /My Dog/);
  assert.match(renamed, /^Mochi vet note draft/);
});

test("keeps the Dog Profile identity canonical in scoped PWA Care Pass handoffs", () => {
  const placeholder = buildScopedCarePass(
    { profile: { name: "My Dog", publicLabel: "My Dog" } },
    { audience: "sitter" },
  );
  const renamed = buildScopedCarePass(
    { profile: { name: "  Mochi  ", publicLabel: "  Mochi  " } },
    { audience: "trainer" },
  );

  assert.equal(placeholder.petName, "Phoenix");
  assert.equal(placeholder.profile.name, "Phoenix");
  assert.equal(placeholder.profile.publicLabel, "Phoenix");
  assert.doesNotMatch(JSON.stringify(placeholder), /My Dog/);
  assert.equal(renamed.petName, "Mochi");
  assert.equal(renamed.profile.name, "Mochi");
  assert.equal(renamed.profile.publicLabel, "Mochi");
});

test("keeps the Dog Profile identity canonical at PWA household sync boundaries", () => {
  const now = "2026-08-12T12:00:00.000Z";
  const placeholderState = { profile: { name: "My Dog", publicLabel: "My Dog" } };
  const renamedState = { profile: { name: "  Mochi  ", publicLabel: "  Mochi  " } };
  const placeholderAccess = buildCaregiverAccessModel(placeholderState, now);
  const renamedAccess = buildCaregiverAccessModel(renamedState, now);
  const placeholderSync = buildCloudSyncPlan(placeholderState, {}, now);
  const phoenixSync = buildCloudSyncPlan({ profile: { name: "Phoenix" } }, {}, now);
  const renamedSync = buildCloudSyncPlan(renamedState, {}, now);
  const trimmedSync = buildCloudSyncPlan({ profile: { name: "Mochi" } }, {}, now);

  assert.equal(placeholderAccess.household.petName, "Phoenix");
  assert.equal(renamedAccess.household.petName, "Mochi");
  assert.match(placeholderAccess.inviteDrafts[0].privacyNotice, /private Phoenix care context/);
  assert.match(renamedAccess.inviteDrafts[0].privacyNotice, /private Mochi care context/);
  assert.doesNotMatch(JSON.stringify(renamedAccess.inviteDrafts), /Phoenix/);
  assert.equal(placeholderSync.localStateFingerprint, phoenixSync.localStateFingerprint);
  assert.equal(renamedSync.localStateFingerprint, trimmedSync.localStateFingerprint);
  assert.equal(placeholderSync.status, "local_only");
  assert.equal(renamedSync.status, "local_only");
  assert.match(placeholderSync.resources.find((resource) => resource.name === "pets").description, /^Phoenix profile/);
  assert.match(renamedSync.resources.find((resource) => resource.name === "pets").description, /^Mochi profile/);
  assert.match(renamedSync.blockers.join(" "), /shared Mochi data/);
  assert.match(renamedSync.privacyChecklist.join(" "), /sharing Mochi data/);
  assert.doesNotMatch(JSON.stringify(renamedSync), /Phoenix/);
});

test("keeps Dog Profile identity canonical in owner-reviewed PWA AI context", () => {
  const placeholder = { profile: { name: "My Dog", breed: "Shepherd mix" } };
  const renamed = { profile: { name: "  Mochi  ", breed: "Shepherd mix" } };

  assert.equal(compactAssistantContext(placeholder).profile.name, "Phoenix");
  assert.doesNotMatch(buildCareHelperInput({ question: "Review today", context: placeholder }), /My Dog/);
  assert.match(buildCareHelperInput({ question: "Review today", context: placeholder }), /Phoenix context:/);
  assert.match(buildCareHelperInstructions(renamed), /Care Helper for Mochi/);
  assert.match(buildCareHelperInput({ question: "Review today", context: renamed }), /Mochi context:/);
  assert.doesNotMatch(buildCareHelperInstructions(renamed), /Care Helper for Phoenix/);
});

function extractConstArray(source, name) {
  const match = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  assert.ok(match, `${name} array should exist`);
  return match[1];
}

test("keeps the PWA shell aligned with v1.5 navigation", () => {
  assert.match(appEntry, /const THEME_KEY = "woofwatcher\.v1\.theme"/);
  assert.match(appEntry, /function renderDesktopSidebar/);
  assert.match(appEntry, /Care & Wellbeing/);
  assert.match(appEntry, /More Tools/);
  assert.match(appEntry, /Avatar Studio/);
  assert.match(appEntry, /data-action="toggle-theme"/);
  assert.match(appEntry, /data-form="top-search"/);
  assert.match(
    appEntry,
    /renderNavButton\("phoenix", "Home"\)[\s\S]*renderNavButton\("log", "Log"\)[\s\S]*renderNavButton\("plans", "Plans"\)[\s\S]*renderNavButton\("health", "Health"\)[\s\S]*renderNavButton\("more", "More"\)/,
  );
});

test("keeps Potty as the PWA quick-log parent action", () => {
  const entryOptions = extractConstArray(appEntry, "ENTRY_SELECT_OPTIONS");
  assert.match(entryOptions, /"potty"/);
  assert.doesNotMatch(entryOptions, /"pee"/);
  assert.doesNotMatch(entryOptions, /"poop"/);

  assert.match(productViewModel, /key: "potty"/);
  assert.match(productViewModel, /detailLevel: "outcome-flow"/);
  assert.doesNotMatch(productViewModel, /key: "pee"/);
  assert.doesNotMatch(productViewModel, /key: "poop"/);
  assert.match(productViewModel, /"pottyLocation"/);
  assert.match(productViewModel, /"pottyOutcome"/);
});

test("preserves the PWA meal served-to-outcome lifecycle contract", () => {
  assert.match(productViewModel, /"mealType"/);
  assert.match(productViewModel, /"servedAt"/);
  assert.match(productViewModel, /"servedBy"/);
  assert.match(productViewModel, /"portionOffered"/);
  assert.match(productViewModel, /"portionEaten"/);
  assert.match(productViewModel, /"outcomeAt"/);
  assert.match(productViewModel, /"outcomeBy"/);
  assert.match(core, /mealType: cleanText\(input\.mealType\)/);
  assert.match(core, /servedAt: input\.servedAt \? normalizeDate\(input\.servedAt\) : ""/);
  assert.match(core, /outcomeAt: input\.outcomeAt \? normalizeDate\(input\.outcomeAt\) : ""/);
});

test("keeps Phoenix Home wired to open meal outcome tasks", () => {
  assert.match(appEntry, /function renderPhoenixStatusCard/);
  assert.match(appEntry, /function getOpenMealOutcomeTask/);
  assert.match(appEntry, /data-action="meal-outcome"/);
  assert.match(appEntry, /Meal outcome updated:/);
  assert.match(appEntry, /No open meal outcomes\. Care proof is current\./);
});

test("keeps Phoenix Home wired to household pulse and health snapshot polish", () => {
  assert.match(appEntry, /function renderHomeHouseholdPulseCard/);
  assert.match(appEntry, /function renderHomeHealthBileSnapshot/);
  assert.match(appEntry, /function buildPhoenixRoomCopy/);
  assert.match(appEntry, /Where Phoenix is/);
  assert.match(appEntry, /Health\/Bile snapshot/);
  assert.match(appEntry, /data-tab="household-pulse"/);
  assert.match(appEntry, /data-tab="health"/);
});

test("keeps Quick Log v2 wired to dedicated meal and potty flows", () => {
  assert.match(appEntry, /let activeQuickFlow/);
  assert.match(appEntry, /function renderQuickLogFlowPanel/);
  assert.match(appEntry, /function renderMealLifecycleFlow/);
  assert.match(appEntry, /data-form="meal-lifecycle"/);
  assert.match(appEntry, /Serve meal/);
  assert.match(appEntry, /Update open meal/);
  assert.match(appEntry, /function renderPottyOutcomeFlow/);
  assert.match(appEntry, /data-form="potty-outcome"/);
  assert.match(appEntry, /What happened\?/);
  assert.match(appEntry, /Tried, nothing/);
});

test("keeps Household Pulse wired to manual alone-time workflow", () => {
  assert.match(appEntry, /"household-pulse"/);
  assert.match(appEntry, /function renderHouseholdPulseTab/);
  assert.match(appEntry, /function getActiveAloneEntry/);
  assert.match(appEntry, /data-form="leaving-home"/);
  assert.match(appEntry, /data-form="return-home"/);
  assert.match(appEntry, /function handleLeavingHomeSubmit/);
  assert.match(appEntry, /function handleReturnHomeSubmit/);
  assert.match(appEntry, /Phoenix is home alone/);
  assert.match(appEntry, /Return outcomes/);
  assert.match(appEntry, /function renderMoreDirectoryPanel/);
});

test("keeps Care Pass wired to scoped audience exports", () => {
  assert.match(appEntry, /buildScopedCarePass/);
  assert.match(appEntry, /CARE_PASS_VARIANTS/);
  assert.match(appEntry, /const SCOPED_CARE_PASS_AUDIENCES = \["vet", "sitter", "trainer", "emergency"\]/);
  assert.match(appEntry, /function renderScopedCarePassPanel/);
  assert.match(appEntry, /data-care-pass-audience="\$\{escapeAttribute\(variant\.id\)\}"/);
  assert.match(appEntry, /data-action="copy-care-pass"/);
  assert.match(appEntry, /data-action="download-care-pass"/);
});

test("keeps Diet & Treats wired as a first-class PWA route", () => {
  assert.match(appEntry, /"diet-treats"/);
  assert.match(appEntry, /diet: "diet-treats"/);
  assert.match(appEntry, /treats: "diet-treats"/);
  assert.match(appEntry, /if \(tab === "diet-treats"\) return renderDietTreatsTab\(context\)/);
  assert.match(appEntry, /function renderDietTreatsTab/);
  assert.match(appEntry, /function renderDietDailyProgress/);
  assert.match(appEntry, /function renderMealsTodayPanel/);
  assert.match(appEntry, /function renderDietAvoidList/);
  assert.match(appEntry, /data-action="open-diet-log-meal"/);
  assert.match(appEntry, /data-action="open-diet-log-treat"/);
  assert.match(appEntry, /data-action="edit-diet-profile"/);
});

test("keeps WoofGuide wired to owner-reviewed action routing", () => {
  assert.match(appEntry, /woofguide: "woofguide"/);
  assert.match(appEntry, /assistant: "woofguide"/);
  assert.match(appEntry, /if \(tab === "woofguide"\) return renderWoofGuideTab\(context\)/);
  assert.match(appEntry, /const WOOFGUIDE_ACTIONS = \[/);
  assert.match(appEntry, /function renderWoofGuideActionCards/);
  assert.match(appEntry, /data-action="woofguide-log-meal"/);
  assert.match(appEntry, /data-action="woofguide-open-care-pass"/);
  assert.match(appEntry, /data-action="woofguide-open-records"/);
  assert.match(appEntry, /data-action="woofguide-draft-vet-note"/);
  assert.match(appEntry, /import \{ buildWoofGuideVetNoteDraft \} from "\.\/woof-operations\.js"/);
  assert.match(appEntry, /buildWoofGuideVetNoteDraft\(\s*state,/);
  assert.match(appEntry, /owner-reviewed/);
});

test("keeps Dog Profile identity canonical in PWA Alone Time history", () => {
  const now = "2026-08-14T12:00:00.000Z";
  const placeholder = buildLeavingHomeEntry({
    profile: { name: "My Dog" },
    caregiver: "Apollo",
    note: "  Music is on.  ",
    occurredAt: now,
  });
  const renamed = buildLeavingHomeEntry({
    profile: { name: "  Mochi  " },
    caregiver: "Apollo",
    occurredAt: now,
  });

  assert.equal(placeholder.title, "Leaving Home");
  assert.equal(placeholder.note, "Phoenix is home alone. Music is on.");
  assert.doesNotMatch(JSON.stringify(placeholder), /My Dog/);
  assert.equal(renamed.note, "Mochi is home alone. Return outcome pending.");
  assert.doesNotMatch(JSON.stringify(renamed), /Phoenix|My Dog/);
});

test("keeps Dog Profile identity canonical in Household Pulse", () => {
  const now = "2026-08-13T12:00:00.000Z";
  const placeholderState = getDefaultState(now);
  placeholderState.profile.name = "My Dog";
  placeholderState.profile.publicLabel = "My Dog";
  placeholderState.routines = [];
  placeholderState.entries = [];
  const renamedState = structuredClone(placeholderState);
  renamedState.profile.name = "  Mochi  ";
  renamedState.profile.publicLabel = "  Mochi  ";

  const placeholder = getHouseholdPulse(placeholderState, now);
  const renamed = getHouseholdPulse(renamedState, now);

  assert.match(placeholder.summary, /^Phoenix has 0\/0 routine items covered/);
  assert.equal(placeholder.nextAction.owner, "Phoenix's humans");
  assert.match(renamed.summary, /^Mochi has 0\/0 routine items covered/);
  assert.equal(renamed.nextAction.owner, "Mochi's humans");
  assert.doesNotMatch(JSON.stringify(renamed), /Phoenix|My Dog/);
});

test("keeps PWA WoofGuide live AI gated behind structured provider proof", () => {
  assert.match(appEntry, /proofReady: false/);
  assert.match(appEntry, /function isAssistantLiveReady/);
  assert.match(appEntry, /const liveReady = isAssistantLiveReady\(\)/);
  assert.match(appEntry, /providerProofReady = Boolean/);
  assert.match(appEntry, /const liveAnswer = isAssistantLiveReady\(\) \? await requestLiveAssistant/);
  assert.match(appEntry, /Provider proof pending/);
  assert.match(appEntry, /Structured AI proof needed/);
  assert.match(appEntry, /structured WoofGuide AI proof/);
  assert.doesNotMatch(appEntry, /Live OpenAI/);
  assert.doesNotMatch(appEntry, /Credential found/);
  assert.doesNotMatch(appEntry, /If live OpenAI is not configured/);
});

test("keeps PWA cloud sync gated behind structured provider proof", () => {
  const stagedPlan = buildCloudSyncPlan(
    {},
    {
      provider: "supabase",
      backendUrl: "https://supabase.example",
      householdId: "house_123"
    },
    "2026-07-04T00:00:00.000Z",
  );

  assert.equal(stagedPlan.status, "provider_proof_pending");
  assert.equal(stagedPlan.backend.configured, true);
  assert.equal(stagedPlan.backend.proofReady, false);
  assert.match(stagedPlan.blockers.join(" "), /structured cloud sync provider proof/);
  assert.match(stagedPlan.providerBoundary, /structured cloud sync provider proof/);
  assert.doesNotMatch(stagedPlan.blockers.join(" "), /Choose and configure a backend/);

  const readyPlan = buildCloudSyncPlan(
    {},
    {
      provider: "supabase",
      backendUrl: "https://supabase.example",
      householdId: "house_123",
      providerEvidence: {
        proofLocator: "proof/cloud-sync/supabase.json",
        proofMimeType: "application/json",
        proofByteSize: 4096,
        supabaseProjectId: "supabase-prod",
        migrationBackfillPolicy: "care_entries updated_at and tombstones are migrated with rollback.",
        activeHouseholdRlsPolicy: "active_household_id scopes cursors, tombstones, and denied reads.",
        retentionPolicy: "Retention is household-scoped and documented.",
        exportPolicy: "Owners can export household data before deletion.",
        deletionPolicy: "Deletion removes household-scoped rows and objects with audit receipt.",
        dependencyBuildProof: "CI run proves dependency-complete sync build.",
        mobileFullRefreshProof: "iOS and Android full-refresh sign-off is attached.",
        supabaseProjectApproved: true,
        migrationBackfillApproved: true,
        rlsApproved: true,
        retentionExportDeletionApproved: true,
        dependencyBuildApproved: true,
        mobileSignoffApproved: true,
        apolloApproved: true
      }
    },
    "2026-07-04T00:00:00.000Z",
  );

  assert.equal(readyPlan.status, "ready_to_connect");
  assert.equal(readyPlan.backend.proofReady, true);
  assert.deepEqual(readyPlan.blockers, []);
});

test("keeps PWA hosted nudges gated behind structured delivery proof", () => {
  const stagedPlan = buildHostedNudgePlan(
    {},
    {
      backendUrl: "https://api.example",
      householdId: "house_123",
      pushProvider: "expo",
      permission: "granted"
    },
    "2026-07-04T15:00:00.000Z",
  );

  assert.equal(stagedPlan.status, "provider_proof_pending");
  assert.equal(stagedPlan.delivery.backendConfigured, true);
  assert.equal(stagedPlan.delivery.pushProviderConfigured, true);
  assert.equal(stagedPlan.delivery.proofReady, false);
  assert.match(stagedPlan.blockers.join(" "), /structured hosted nudge delivery proof/);
  assert.deepEqual(stagedPlan.jobs, []);

  const readyPlan = buildHostedNudgePlan(
    {},
    {
      backendUrl: "https://api.example",
      householdId: "house_123",
      pushProvider: "expo",
      permission: "granted",
      providerEvidence: {
        proofLocator: "proof/hosted-nudges/expo.json",
        proofMimeType: "application/json",
        proofByteSize: 4096,
        backendJobPolicy: "Hosted jobs are idempotent, rate-limited, and household scoped.",
        caregiverConsentPolicy: "Caregiver notification consent is recorded and revocable.",
        providerDeliveryPolicy: "Expo/APNs/FCM delivery provider setup is documented.",
        caregiverPrivacyPolicy: "Nudges contain only scoped routine labels and no private notes.",
        quietHoursPolicy: "Quiet hours and daily budget enforcement are tested.",
        fallbackPolicy: "Missed delivery falls back to in-app Reminder Center review.",
        nativeDeliveryProof: "iOS and Android delivery proof is attached.",
        backendJobApproved: true,
        caregiverConsentApproved: true,
        providerDeliveryApproved: true,
        caregiverPrivacyApproved: true,
        quietHoursApproved: true,
        fallbackApproved: true,
        nativeDeliveryApproved: true,
        apolloApproved: true
      }
    },
    "2026-07-04T15:00:00.000Z",
  );

  assert.equal(readyPlan.delivery.proofReady, true);
  assert.doesNotMatch(readyPlan.blockers.join(" "), /structured hosted nudge delivery proof/);
  assert.notEqual(readyPlan.status, "provider_proof_pending");
});

test("keeps Dog Profile identity canonical at the hosted nudge provider boundary", () => {
  const placeholder = buildHostedNudgePlan(
    { profile: { name: "My Dog", publicLabel: "My Dog" } },
    {},
    "2026-08-12T15:00:00.000Z",
  );
  const renamed = buildHostedNudgePlan(
    { profile: { name: "  Mochi  ", publicLabel: "  Mochi  " } },
    {},
    "2026-08-12T15:00:00.000Z",
  );

  assert.equal(placeholder.petName, "Phoenix");
  assert.equal(renamed.petName, "Mochi");
});

test("keeps records and reports tools directly routable in the PWA", () => {
  assert.match(appEntry, /records: "records"/);
  assert.match(appEntry, /reports: "reports"/);
  assert.match(appEntry, /timeline: "timeline"/);
  assert.match(appEntry, /"care-pass": "care-pass"/);
  assert.match(appEntry, /if \(tab === "timeline"\) return renderTimelineTab\(context\)/);
  assert.match(appEntry, /if \(tab === "records"\) return renderRecordsTab\(context\)/);
  assert.match(appEntry, /if \(tab === "reports"\) return renderReportsTab\(context\)/);
  assert.match(appEntry, /if \(tab === "care-pass"\) return renderCarePassTab\(context\)/);
  assert.match(appEntry, /function renderTimelineTab/);
  assert.match(appEntry, /function renderRecordsTab/);
  assert.match(appEntry, /function renderReportsTab/);
  assert.match(appEntry, /function renderCarePassTab/);
});

test("keeps Avatar Studio wired as a prototype route with state inventory", () => {
  assert.match(appEntry, /avatar: "avatar-studio"/);
  assert.match(appEntry, /"avatar-studio": "avatar-studio"/);
  assert.match(appEntry, /if \(tab === "avatar-studio"\) return renderAvatarStudioTab\(context\)/);
  assert.match(appEntry, /const AVATAR_STATES = \[/);
  assert.match(appEntry, /Happy/);
  assert.match(appEntry, /Home Alone/);
  assert.match(appEntry, /Not Feeling Well/);
  assert.match(appEntry, /function renderAvatarStudioTab/);
  assert.match(appEntry, /data-input="avatar-photo"/);
  assert.match(appEntry, /data-action="avatar-upload-photo"/);
  assert.match(appEntry, /data-action="set-avatar-state"/);
  assert.match(appEntry, /function handleAvatarPhotoInput/);
});

test("keeps Achievements wired as a direct route with meaningful milestones", () => {
  assert.match(appEntry, /getAchievementReview/);
  assert.match(appEntry, /"achievements"/);
  assert.match(appEntry, /achievements: "achievements"/);
  assert.match(appEntry, /if \(tab === "achievements"\) return renderAchievementsTab\(context\)/);
  assert.match(appEntry, /function renderAchievementsTab/);
  assert.match(appEntry, /function renderAchievementCard/);
  assert.match(appEntry, /routine_streak/);
  assert.match(appEntry, /training_consistency/);
  assert.match(appEntry, /happy_tummy_week/);
  assert.match(appEntry, /calm_alone_time/);
  assert.match(appEntry, /records_complete/);
});

test("keeps Settings wired as a direct system route with local safety controls", () => {
  assert.match(appEntry, /buildCloudSyncPlan/);
  assert.match(appEntry, /settings: "settings"/);
  assert.match(appEntry, /if \(tab === "settings"\) return renderSettingsTab\(context\)/);
  assert.match(appEntry, /function renderSettingsTab/);
  assert.match(appEntry, /function renderSettingsBackupPanel/);
  assert.match(appEntry, /function renderSettingsSafetyPanel/);
  assert.match(appEntry, /data-action="export-json"/);
  assert.match(appEntry, /data-action="import-json"/);
  assert.match(appEntry, /data-action="export-transfer"/);
  assert.match(appEntry, /data-action="reset-demo"/);
  assert.match(appEntry, /local-only/);
  assert.match(appEntry, /No provider-backed sync is enabled/);
});
