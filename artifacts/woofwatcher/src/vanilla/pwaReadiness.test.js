import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { buildHostedNudgePlan } from "./woof-operations.js";
import { buildCloudSyncPlan } from "./woof-privacy-cloud.js";

const here = dirname(fileURLToPath(import.meta.url));
const appEntry = readFileSync(join(here, "app-entry.js"), "utf8");
const productViewModel = readFileSync(join(here, "woof-product-view-model.js"), "utf8");
const core = readFileSync(join(here, "woof-core.js"), "utf8");

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
  assert.match(appEntry, /function buildWoofGuideVetNoteDraft/);
  assert.match(appEntry, /owner-reviewed/);
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
