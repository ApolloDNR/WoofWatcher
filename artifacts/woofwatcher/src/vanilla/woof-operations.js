import {
  buildReportText,
  createEntry,
  getNotificationCenter,
  getReminderCenter,
  normalizeState
} from "./woof-core.js";

export const AUDIT_ACTIONS = [
  "create",
  "update",
  "remove",
  "export",
  "import",
  "invite_draft",
  "sync_plan",
  "notification_schedule",
  "ai_review"
];

export const AUDIT_RESOURCE_TYPES = [
  "household",
  "member",
  "pet",
  "care_entry",
  "routine",
  "record",
  "goal",
  "care_pass",
  "report",
  "notification",
  "assistant",
  "settings"
];

const PRIVACY_LEVELS = ["household_private", "care_pass_scoped", "system_private", "public_demo_safe"];
const SECRET_KEY_PATTERN = /(token|secret|password|api[-_ ]?key|auth|session|credential)/i;

export function createAuditEvent(input = {}, now = new Date().toISOString()) {
  const action = normalizeChoice(input.action, AUDIT_ACTIONS, "update");
  const resourceType = normalizeChoice(input.resourceType, AUDIT_RESOURCE_TYPES, "settings");
  const resourceId = cleanText(input.resourceId, 120) || "unknown";
  const actor = cleanText(input.actor, 80) || "local_caregiver";
  const summary = cleanText(input.summary, 240) || `${action} ${resourceType}`;
  const privacyLevel = normalizeChoice(input.privacyLevel, PRIVACY_LEVELS, "household_private");
  const metadata = redactMetadata(input.metadata);
  const createdAt = normalizeTimestamp(now);

  return {
    id: `audit_${timestampSlug(createdAt)}_${slugify(action)}_${stableFingerprint({
      action,
      resourceType,
      resourceId,
      actor,
      summary,
      metadata,
      createdAt
    }).slice(0, 8)}`,
    packageType: "woofwatcher.audit-event",
    version: 1,
    createdAt,
    action,
    resourceType,
    resourceId,
    actor,
    summary,
    privacyLevel,
    source: cleanText(input.source, 80) || "local_app",
    metadata
  };
}

export function buildTalkToLogDraft(text = "", options = {}, now = new Date().toISOString()) {
  const original = cleanText(text, 1000);
  const caregiver = cleanText(options.caregiver || options.defaultCaregiver, 80) || "Unassigned";
  const type = inferEntryType(original);
  const entryDraft = createEntry({
    type,
    title: inferEntryTitle(type, original),
    caregiver,
    occurredAt: now,
    durationMinutes: inferDurationMinutes(original),
    amount: inferAmount(original),
    appetite: inferAppetite(original),
    mood: inferMood(original),
    severity: inferSeverity(type, original),
    note: original || "Drafted from caregiver voice/text input."
  });
  const needsReview = type === "note" || entryDraft.requiresFollowUp || ["vomit", "health", "vet", "medication"].includes(type);

  return {
    packageType: "woofwatcher.talk-to-log-draft",
    version: 1,
    createdAt: normalizeTimestamp(now),
    autoSave: false,
    confidence: type === "note" ? "low" : needsReview ? "medium" : "high",
    source: cleanText(options.source, 80) || "caregiver_text",
    entryDraft,
    reviewPrompt: needsReview
      ? "Review before saving. For urgent symptoms, contact a veterinarian instead of relying on WoofWatcher."
      : "Review before saving so Phoenix's care log stays accurate.",
    boundary: "Talk-to-log drafts organize caregiver notes. They are not a diagnosis, veterinary advice, or an automatic saved record."
  };
}

export function buildHostedNudgePlan(input = {}, options = {}, now = new Date().toISOString()) {
  const state = normalizeState(input, now);
  const reminders = getReminderCenter(state, now);
  const notifications = getNotificationCenter(state, now, {
    supported: true,
    permission: cleanText(options.permission, 40) || "default"
  });
  const backendConfigured = Boolean(options.backendConfigured || cleanText(options.backendUrl));
  const householdId = cleanText(options.householdId, 120);
  const pushProviderConfigured = Boolean(options.pushProviderConfigured || cleanText(options.pushProvider));
  const quietHours = normalizeQuietHours(options.quietHours);
  const quietNow = isWithinQuietHours(now, quietHours);
  const maxDailyNudges = clampWholeNumber(options.maxDailyNudges, 4);
  const nudgesSentToday = clampWholeNumber(options.nudgesSentToday, 0);
  const remainingToday = Math.max(0, maxDailyNudges - nudgesSentToday);
  const blockers = [];

  if (!backendConfigured) blockers.push("Choose and configure a backend before hosted nudges can run.");
  if (!householdId) blockers.push("Create a household id before scheduling caregiver-specific nudges.");
  if (!pushProviderConfigured) blockers.push("Configure a push/email/SMS provider before closed-app delivery.");

  const candidates = reminders.items
    .filter((item) => ["overdue", "due", "upcoming"].includes(item.status))
    .sort(sortNudgeCandidates);
  const jobs = blockers.length || remainingToday === 0
    ? []
    : candidates.slice(0, remainingToday).map((item) => buildNudgeJob(item, state, { householdId, quietNow }, now));

  return {
    packageType: "woofwatcher.hosted-nudge-plan",
    version: 1,
    generatedAt: normalizeTimestamp(now),
    status: blockers.length ? "local_only" : remainingToday === 0 ? "budget_exhausted" : quietNow ? "quiet_hold" : "ready_to_schedule",
    householdId,
    petName: state.profile.name,
    budget: {
      maxDailyNudges,
      nudgesSentToday,
      remainingToday,
      quietHours
    },
    localNotificationCenter: notifications,
    dueCount: reminders.dueCount,
    overdueCount: reminders.overdueCount,
    upcomingCount: reminders.upcomingCount,
    jobs,
    blockers,
    deliveryBoundary:
      "Hosted nudges are a backend plan only. Closed-app push, email, or SMS delivery requires account consent, provider setup, and caregiver privacy rules."
  };
}

export function buildReportArtifact(input = {}, options = {}, now = new Date().toISOString()) {
  const state = normalizeState(input, now);
  const format = normalizeChoice(options.format, ["text", "print_pdf"], "text");
  const reportText = buildReportText(state, now);
  const content = `${state.profile.name} Care Report\n\n${reportText}`;
  const dateKey = formatDateKey(now);
  const petSlug = slugify(state.profile.name || "phoenix");
  const extension = format === "print_pdf" ? "pdf" : "txt";

  return {
    packageType: "woofwatcher.report-artifact",
    version: 1,
    createdAt: normalizeTimestamp(now),
    format,
    filename: `woofwatcher-${petSlug}-report-${dateKey}.${extension}`,
    mimeType: format === "print_pdf" ? "application/pdf" : "text/plain;charset=utf-8",
    content: format === "print_pdf" ? "" : content,
    sourceText: content,
    checksum: stableFingerprint({ content, format, pet: state.profile.name, dateKey }),
    printInstructions:
      format === "print_pdf"
        ? "Render sourceText in the report view and use browser or server PDF generation. Do not include raw local state in the PDF payload."
        : "Download as text, or render sourceText in the report view before printing to PDF.",
    privacy: {
      includesRawState: false,
      containsPrivateCareContext: true,
      boundary: "Report artifacts contain Phoenix care context. Share only with trusted caregivers or a veterinarian."
    },
    auditEvent: createAuditEvent(
      {
        action: "export",
        resourceType: "report",
        resourceId: `report_${dateKey}`,
        actor: cleanText(options.actor, 80) || "local_caregiver",
        summary: `Built ${format} monthly care report for ${state.profile.name}`,
        metadata: { format, filename: `woofwatcher-${petSlug}-report-${dateKey}.${extension}` }
      },
      now
    )
  };
}

function buildNudgeJob(item, state, options, now) {
  const scheduledFor = typeof item.minutesUntil === "number"
    ? new Date(new Date(now).getTime() + item.minutesUntil * 60000).toISOString()
    : "";
  const message = `${state.profile.name} needs ${item.label}${item.time ? ` around ${item.time}` : ""}. Log it when handled so the care team stays aligned.`;

  return {
    id: `nudge_${slugify(item.id || item.label)}_${formatDateKey(now)}`,
    type: "care_reminder",
    routineId: item.id,
    label: item.label,
    status: item.status,
    priority: item.status === "overdue" ? "high" : item.status === "due" ? "normal" : "low",
    scheduledFor,
    deliveryWindow: options.quietNow ? "quiet_hold" : "active_window",
    householdId: options.householdId,
    message,
    auditEvent: createAuditEvent(
      {
        action: "notification_schedule",
        resourceType: "notification",
        resourceId: item.id,
        actor: "system",
        summary: `Scheduled ${item.label} nudge`,
        privacyLevel: "system_private",
        metadata: {
          reminderStatus: item.status,
          routineType: item.type,
          scheduledFor
        }
      },
      now
    )
  };
}

function inferEntryType(text) {
  const lower = text.toLowerCase();
  if (/(throw|threw|vomit|puke|yellow bile|bile)/.test(lower)) return "vomit";
  if (/(vet|veterinarian|clinic)/.test(lower)) return "vet";
  if (/(medicine|medication|pill|dose)/.test(lower)) return "medication";
  if (/(walk|walked|stroll|sniff)/.test(lower)) return "walk";
  if (/(breakfast|dinner|meal|fed|food|kibble|ate|eating)/.test(lower)) return "meal";
  if (/(treat|chew|snack)/.test(lower)) return "treat";
  if (/(training|trained|place|recall|heel|leash)/.test(lower)) return "training";
  if (/(dog park|met a dog|social|playdate)/.test(lower)) return "social";
  if (/(alone|home by herself|separation)/.test(lower)) return "alone";
  if (/(poop|stool)/.test(lower)) return "poop";
  if (/(pee|urine)/.test(lower)) return "pee";
  if (/(potty)/.test(lower)) return "potty";
  if (/(weight|weighed|lbs|pounds)/.test(lower)) return "weight";
  if (/(anxious|calm|nervous|happy|mood)/.test(lower)) return "mood";
  return "note";
}

function inferEntryTitle(type, text) {
  const lower = text.toLowerCase();
  if (type === "vomit") return /(yellow bile|bile)/.test(lower) ? "Yellow bile" : "Vomit incident";
  if (type === "meal") {
    if (/breakfast/.test(lower)) return "Breakfast";
    if (/dinner/.test(lower)) return "Dinner";
    if (/snack/.test(lower)) return "Snack";
    return "Meal";
  }
  if (type === "walk") return "Walk";
  if (type === "training") return "Training win";
  if (type === "alone") return "Alone time";
  if (type === "social") return /dog park/.test(lower) ? "Dog park" : "Social interaction";
  if (type === "medication") return "Medication";
  if (type === "vet") return "Vet note";
  if (type === "weight") return "Weight check";
  if (type === "mood") return "Mood check";
  return "Care note";
}

function inferDurationMinutes(text) {
  const minuteMatch = text.match(/\b(\d{1,3})\s*(minutes?|mins?|min|m)\b/i);
  if (minuteMatch) return clampWholeNumber(minuteMatch[1], 0);
  const hourMatch = text.match(/\b(\d{1,2})\s*(hours?|hrs?|hr|h)\b/i);
  if (hourMatch) return clampWholeNumber(Number(hourMatch[1]) * 60, 0);
  return 0;
}

function inferAmount(text) {
  const amountMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(cups?|scoops?|lbs?|pounds?)\b/i);
  return amountMatch ? amountMatch[0] : "";
}

function inferAppetite(text) {
  const lower = text.toLowerCase();
  if (/(refused|would not eat|didn't eat|did not eat|skipped)/.test(lower)) return "refused";
  if (/(ate all|finished|good appetite)/.test(lower)) return "good";
  if (/(ate later|picked|slow|little appetite)/.test(lower)) return "watch";
  return "";
}

function inferMood(text) {
  const lower = text.toLowerCase();
  if (/normal energy/.test(lower)) return "normal energy";
  if (/anxious|nervous|stressed/.test(lower)) return "anxious";
  if (/calm|settled/.test(lower)) return "calm";
  if (/happy|playful|joyful/.test(lower)) return "happy";
  return "";
}

function inferSeverity(type, text) {
  const lower = text.toLowerCase();
  if (/(urgent|blood|bloated|repeated|twice|multiple|lethargic|collapsed|emergency)/.test(lower)) return "urgent";
  if (type === "vomit" || /(watch|yellow bile|bile|symptom)/.test(lower)) return "watch";
  return "normal";
}

function sortNudgeCandidates(a, b) {
  const statusWeight = { overdue: 0, due: 1, upcoming: 2 };
  const aWeight = statusWeight[a.status] ?? 9;
  const bWeight = statusWeight[b.status] ?? 9;
  if (aWeight !== bWeight) return aWeight - bWeight;
  const aMinutes = typeof a.minutesUntil === "number" ? a.minutesUntil : Number.MAX_SAFE_INTEGER;
  const bMinutes = typeof b.minutesUntil === "number" ? b.minutesUntil : Number.MAX_SAFE_INTEGER;
  return aMinutes - bMinutes;
}

function normalizeQuietHours(input = {}) {
  return {
    start: cleanText(input.start, 20) || "21:00",
    end: cleanText(input.end, 20) || "07:00"
  };
}

function isWithinQuietHours(now, quietHours) {
  const date = new Date(now);
  const current = date.getHours() * 60 + date.getMinutes();
  const start = parseClockMinutes(quietHours.start);
  const end = parseClockMinutes(quietHours.end);
  if (start === null || end === null) return false;
  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

function parseClockMinutes(value) {
  const match = cleanText(value, 20).match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const period = (match[3] || "").toLowerCase();
  if (minutes < 0 || minutes > 59 || hours < 0 || hours > 23) return null;
  if (period === "pm" && hours < 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function redactMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => cleanText(key, 80))
      .slice(0, 24)
      .map(([key, value]) => {
        const safeKey = cleanText(key, 80);
        return [safeKey, SECRET_KEY_PATTERN.test(safeKey) ? "[redacted]" : sanitizeMetadataValue(value)];
      })
  );
}

function sanitizeMetadataValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 12).map((item) => cleanText(item, 120));
  if (typeof value === "object") return stableFingerprint(value);
  return cleanText(value, 240);
}

function normalizeChoice(value, choices, fallback) {
  const cleaned = cleanText(value, 80).toLowerCase();
  return choices.includes(cleaned) ? cleaned : fallback;
}

function normalizeTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function formatDateKey(value) {
  return normalizeTimestamp(value).slice(0, 10);
}

function timestampSlug(value) {
  return normalizeTimestamp(value).replace(/[-:.TZ]/g, "").slice(0, 14);
}

function slugify(value) {
  return cleanText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "item";
}

function clampWholeNumber(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.floor(number);
}

function cleanText(value, maxLength = 500) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function stableFingerprint(value) {
  const text = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}
