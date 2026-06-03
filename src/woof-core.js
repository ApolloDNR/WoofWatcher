const ENTRY_TYPES = new Set([
  "meal",
  "treat",
  "walk",
  "park",
  "training",
  "social",
  "vomit",
  "health",
  "vet",
  "weight",
  "medication",
  "note"
]);

const TYPE_DEFAULT_TITLES = {
  meal: "Meal",
  treat: "Treat",
  walk: "Walk",
  park: "Dog park",
  training: "Training",
  social: "Social interaction",
  vomit: "Vomit incident",
  health: "Health note",
  vet: "Vet record",
  weight: "Weight check",
  medication: "Medication",
  note: "Care note"
};

export function getDefaultState(now = new Date().toISOString()) {
  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    profile: {
      name: "Phoenix",
      publicLabel: "Phoenix",
      breed: "German Shepherd / Belgian Shepherd mix",
      background: "Rescued over a year ago after being underweight and food anxious.",
      careFocus: "Keep routines calm, document appetite patterns, and prevent long empty-stomach windows.",
      weight: {
        current: 56.2,
        goal: "Slow, vet-guided weight gain and stable appetite",
        unit: "lb"
      },
      vetBoundary: "WoofWatcher tracks patterns for caregiver and veterinarian review. It is not a veterinary diagnosis."
    },
    caregivers: [
      { name: "Apollo", role: "Primary caregiver" },
      { name: "Girlfriend", role: "Primary caregiver" }
    ],
    routines: [
      {
        id: "routine_breakfast",
        label: "Breakfast",
        type: "meal",
        time: "7:30 AM",
        owner: "Whoever is up first",
        note: "Small calm meal; avoid pressure if Phoenix is anxious."
      },
      {
        id: "routine_morning_walk",
        label: "Morning walk",
        type: "walk",
        time: "8:15 AM",
        owner: "Apollo",
        note: "Decompress walk, sniffing encouraged."
      },
      {
        id: "routine_midday_check",
        label: "Midday check",
        type: "note",
        time: "12:30 PM",
        owner: "Either caregiver",
        note: "Water, mood, appetite, and anxiety check."
      },
      {
        id: "routine_dinner",
        label: "Dinner",
        type: "meal",
        time: "6:30 PM",
        owner: "Either caregiver",
        note: "Document amount and whether she needed company to eat."
      },
      {
        id: "routine_evening_walk",
        label: "Evening walk",
        type: "walk",
        time: "8:15 PM",
        owner: "Whoever is home",
        note: "Short settling walk before bedtime."
      },
      {
        id: "routine_bedtime_snack",
        label: "Bedtime snack",
        type: "treat",
        time: "10:00 PM",
        owner: "Either caregiver",
        note: "Small snack may help reduce empty-stomach bile mornings."
      }
    ],
    records: [
      {
        id: "record_vet_baseline",
        type: "vet",
        title: "Next vet discussion",
        due: "Next regular appointment",
        note: "Mention occasional yellow bile vomiting, appetite anxiety, weight goal, and any frequency changes."
      },
      {
        id: "record_weight_goal",
        type: "weight",
        title: "Weight goal",
        due: "Monthly",
        note: "Track weight trend gently; avoid aggressive feeding changes without vet guidance."
      },
      {
        id: "record_vaccines",
        type: "vaccine",
        title: "Vaccine records",
        due: "Add dates",
        note: "Store rabies, DHPP, Bordetella, and any clinic notes here."
      }
    ],
    entries: [
      createEntry({
        type: "meal",
        title: "Breakfast",
        caregiver: "Apollo",
        amount: "1 cup",
        mood: "settled",
        note: "Ate after a calm start.",
        occurredAt: shiftIso(now, -7)
      }),
      createEntry({
        type: "walk",
        title: "Morning walk",
        caregiver: "Apollo",
        durationMinutes: 22,
        note: "Loose leash, sniffed calmly.",
        occurredAt: shiftIso(now, -6)
      }),
      createEntry({
        type: "training",
        title: "Place work",
        caregiver: "Girlfriend",
        durationMinutes: 10,
        mood: "engaged",
        note: "Held place while food was prepared.",
        occurredAt: shiftIso(now, -5)
      }),
      createEntry({
        type: "vomit",
        title: "Yellow bile",
        caregiver: "Apollo",
        severity: "watch",
        note: "Small amount before breakfast. Normal energy after.",
        occurredAt: shiftIso(now, -4)
      })
    ]
  };
}

export function normalizeState(input = {}, now = new Date().toISOString()) {
  const defaults = getDefaultState(input.createdAt || now);
  const profile = typeof input.profile === "object" && input.profile ? input.profile : {};
  const weight = typeof profile.weight === "object" && profile.weight ? profile.weight : {};

  return {
    ...defaults,
    ...compactObject(input),
    version: 1,
    profile: {
      ...defaults.profile,
      ...compactObject(profile),
      weight: {
        ...defaults.profile.weight,
        ...compactObject(weight)
      }
    },
    caregivers: Array.isArray(input.caregivers) && input.caregivers.length ? input.caregivers.map(normalizeCaregiver) : defaults.caregivers,
    routines: Array.isArray(input.routines) && input.routines.length ? input.routines.map(normalizeRoutine) : defaults.routines,
    records: Array.isArray(input.records) ? input.records.map(normalizeRecord) : defaults.records,
    entries: Array.isArray(input.entries) ? input.entries.map(normalizeImportedEntry) : defaults.entries,
    updatedAt: now
  };
}

export function normalizeEntryInput(input = {}) {
  const type = ENTRY_TYPES.has(input.type) ? input.type : "note";
  const title = cleanText(input.title) || TYPE_DEFAULT_TITLES[type] || "Care note";
  const occurredAt = normalizeDate(input.occurredAt);
  const severity = ["normal", "watch", "urgent"].includes(input.severity) ? input.severity : "normal";

  return {
    type,
    title,
    caregiver: cleanText(input.caregiver) || "Unassigned",
    occurredAt,
    durationMinutes: clampWholeNumber(input.durationMinutes),
    dogInteractions: clampWholeNumber(input.dogInteractions),
    amount: cleanText(input.amount),
    mood: cleanText(input.mood),
    note: cleanText(input.note),
    severity
  };
}

export function createEntry(input = {}) {
  const draft = normalizeEntryInput(input);
  return {
    id: makeEntryId(draft),
    ...draft,
    requiresFollowUp: requiresFollowUp(draft),
    vetDisclaimer:
      "Pattern tracking only. Contact a veterinarian for diagnosis, treatment, worsening symptoms, or urgent red flags."
  };
}

export function getMonthlySummary(state, now = new Date().toISOString()) {
  const date = new Date(now);
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  const entries = (state.entries || []).filter((entry) => {
    const occurred = new Date(entry.occurredAt);
    return occurred >= start && occurred < end;
  });

  return {
    monthLabel: date.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    totalEntries: entries.length,
    meals: countType(entries, "meal"),
    treats: countType(entries, "treat"),
    walks: countType(entries, "walk"),
    walkMinutes: sumNumber(entries, "walk", "durationMinutes"),
    parkVisits: countType(entries, "park"),
    socialSessions: countType(entries, "social") + countType(entries, "park"),
    dogInteractions: sumAll(entries, "dogInteractions"),
    trainingSessions: countType(entries, "training"),
    trainingMinutes: sumNumber(entries, "training", "durationMinutes"),
    vomitIncidents: countType(entries, "vomit"),
    healthNotes: countType(entries, "health"),
    vetRecords: countType(entries, "vet"),
    weightChecks: countType(entries, "weight"),
    followUps: entries.filter((entry) => entry.requiresFollowUp).length,
    caregivers: [...new Set(entries.map((entry) => entry.caregiver).filter(Boolean))]
  };
}

export function getTodayPlan(state, now = new Date().toISOString()) {
  const todayEntries = entriesForLocalDay(state.entries || [], now);
  const completedLabels = (state.routines || [])
    .filter((routine) => todayEntries.some((entry) => routineMatchesEntry(routine, entry)))
    .map((routine) => routine.label);

  const nextItems = (state.routines || []).filter((routine) => !completedLabels.includes(routine.label));

  return {
    dateLabel: new Date(now).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric"
    }),
    completedLabels,
    nextItems,
    completedCount: completedLabels.length,
    totalCount: (state.routines || []).length,
    handoffPrompt:
      "Before assuming Phoenix is covered, check who fed, walked, trained, or noticed symptoms today."
  };
}

export function getCaregiverHandoff(state, now = new Date().toISOString()) {
  const plan = getTodayPlan(state, now);
  const todayEntries = entriesForLocalDay(state.entries || [], now).sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  const lastMeal = todayEntries.find((entry) => entry.type === "meal") || null;
  const lastWalk = todayEntries.find((entry) => entry.type === "walk") || null;
  const followUps = todayEntries.filter((entry) => entry.requiresFollowUp || entry.severity === "urgent");
  const nextRoutine = plan.nextItems[0] || null;
  const caregiverLoad = (state.caregivers || []).map((caregiver) => {
    const name = cleanText(caregiver.name) || "Unassigned";
    const logs = todayEntries.filter((entry) => entryMatchesCaregiver(entry, name));
    const latest = logs[0] || null;
    return {
      name,
      role: cleanText(caregiver.role) || "Caregiver",
      todayLogs: logs.length,
      latestAction: latest ? `${latest.title} at ${formatDateTime(latest.occurredAt)}` : "No logs today"
    };
  });

  return {
    dateLabel: plan.dateLabel,
    completedCount: plan.completedCount,
    totalCount: plan.totalCount,
    nextRoutine,
    lastMeal,
    lastWalk,
    followUps,
    caregiverLoad,
    message: buildHandoffMessage({ nextRoutine, lastMeal, lastWalk, followUps })
  };
}

export function getHealthWatch(state, now = new Date().toISOString()) {
  const recent = entriesWithinDays(state.entries || [], now, 14);
  const vomitCount = countType(recent, "vomit");
  const refusedMeals = recent.filter((entry) => entry.type === "meal" && /refus|skip|would not|did not/i.test(entry.mood || entry.note || "")).length;
  const urgentEntries = recent.filter((entry) => entry.severity === "urgent");
  const signals = [];
  const redFlags = [
    "Urgent red flags include repeated vomiting in one day, blood, black or tarry stool, lethargy, bloating, belly pain, dehydration, toxin exposure, foreign-object concern, or not eating."
  ];

  if (vomitCount > 0) signals.push(`${vomitCount} vomit incidents logged in the last 14 days.`);
  if (refusedMeals > 0) signals.push(`${refusedMeals} refused or skipped meal pattern logged.`);
  if (urgentEntries.length > 0) signals.push(`${urgentEntries.length} urgent health entries need review.`);

  const status = vomitCount >= 2 || refusedMeals > 0 || urgentEntries.length > 0 ? "review" : vomitCount === 1 ? "watch" : "steady";

  if (status === "review") {
    redFlags.unshift("Because repeated vomiting or appetite disruption is logged, review the pattern and contact a veterinarian if it repeats, worsens, or comes with any red flag.");
  }

  return {
    status,
    label: status === "steady" ? "Steady" : status === "watch" ? "Watch" : "Review",
    signals: signals.length ? signals : ["No recent vomit, appetite refusal, or urgent health flags logged."],
    redFlags
  };
}

export function buildReportText(state, now = new Date().toISOString()) {
  const profile = state.profile || { name: "Phoenix" };
  const summary = getMonthlySummary(state, now);
  const healthWatch = getHealthWatch(state, now);
  const latest = [...(state.entries || [])]
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
    .slice(0, 8);

  return [
    "WoofWatcher Monthly Report",
    `${profile.name} - ${summary.monthLabel}`,
    "",
    "Summary",
    `Meals logged: ${summary.meals}`,
    `Treats logged: ${summary.treats}`,
    `Walks: ${summary.walks} (${summary.walkMinutes} minutes)`,
    `Training sessions: ${summary.trainingSessions} (${summary.trainingMinutes} minutes)`,
    `Social sessions: ${summary.socialSessions}`,
    `Dog interactions: ${summary.dogInteractions}`,
    `Vomit incidents: ${summary.vomitIncidents}`,
    `Follow-ups flagged: ${summary.followUps}`,
    "",
    "Health Watch",
    `Status: ${healthWatch.label}`,
    ...healthWatch.signals.map((signal) => `- ${signal}`),
    "",
    "Recent Care Timeline",
    ...latest.map((entry) => `- ${formatDateTime(entry.occurredAt)} | ${entry.type.toUpperCase()} | ${entry.title} | ${entry.caregiver}${entry.note ? ` | ${entry.note}` : ""}`),
    "",
    "Boundary",
    "This report is pattern tracking for caregiver and veterinarian review. It is not a veterinary diagnosis."
  ].join("\n");
}

export function getAssistantContext(state, question = "", now = new Date().toISOString()) {
  const summary = getMonthlySummary(state, now);
  const healthWatch = getHealthWatch(state, now);
  const todayPlan = getTodayPlan(state, now);
  const handoff = getCaregiverHandoff(state, now);
  const latest = [...(state.entries || [])]
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
    .slice(0, 5);

  return {
    question: cleanText(question),
    profile: state.profile,
    summary,
    healthWatch,
    todayPlan,
    handoff,
    latest,
    localAnswer: buildLocalAssistantAnswer({ question, summary, healthWatch, todayPlan, handoff, latest })
  };
}

function buildLocalAssistantAnswer({ question, summary, healthWatch, todayPlan, handoff, latest }) {
  const asksVomiting = /vomit|throw|bile|yellow|nausea/i.test(question);
  const lines = [];

  if (asksVomiting) {
    lines.push("Phoenix has a vomit pattern worth tracking closely. Yellow bile often appears when a dog has an empty stomach, but WoofWatcher should treat it as a pattern for vet review, not a diagnosis.");
  } else {
    lines.push("Phoenix's care picture is built from today's routine, logged meals, walks, training, social exposure, and health notes.");
  }

  lines.push(`This month: ${summary.meals} meals, ${summary.walks} walks, ${summary.trainingSessions} training sessions, ${summary.vomitIncidents} vomit incidents.`);
  lines.push(`Health watch is ${healthWatch.label.toLowerCase()}: ${healthWatch.signals[0]}`);
  lines.push(`Today completed: ${todayPlan.completedCount}/${todayPlan.totalCount}. Next: ${todayPlan.nextItems[0]?.label || "routine covered"}.`);
  lines.push(`Handoff: ${handoff.message}`);

  if (latest[0]) {
    lines.push(`Latest log: ${latest[0].title} by ${latest[0].caregiver}.`);
  }

  lines.push("For urgent symptoms, repeated vomiting, blood, lethargy, bloating, dehydration, toxin exposure, or not eating, contact a veterinarian or urgent care.");
  return lines.join(" ");
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([, item]) => item !== undefined && item !== null));
}

function normalizeCaregiver(caregiver = {}) {
  return {
    name: cleanText(caregiver.name) || "Unassigned",
    role: cleanText(caregiver.role) || "Caregiver"
  };
}

function normalizeRoutine(routine = {}) {
  const type = ENTRY_TYPES.has(routine.type) ? routine.type : "note";
  return {
    id: cleanText(routine.id) || `routine_${type}_${Math.random().toString(36).slice(2, 8)}`,
    label: cleanText(routine.label) || TYPE_DEFAULT_TITLES[type] || "Care routine",
    type,
    time: cleanText(routine.time) || "Unscheduled",
    owner: cleanText(routine.owner) || "Either caregiver",
    note: cleanText(routine.note)
  };
}

function normalizeRecord(record = {}) {
  return {
    id: cleanText(record.id) || `record_${Math.random().toString(36).slice(2, 8)}`,
    type: cleanText(record.type) || "instruction",
    title: cleanText(record.title) || "Care record",
    due: cleanText(record.due),
    note: cleanText(record.note)
  };
}

function normalizeImportedEntry(entry = {}) {
  const normalized = createEntry(entry);
  return {
    ...normalized,
    id: cleanText(entry.id) || normalized.id
  };
}

function normalizeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function clampWholeNumber(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function requiresFollowUp(entry) {
  return entry.type === "vomit" || entry.severity === "urgent";
}

function entryMatchesCaregiver(entry, caregiverName) {
  const entryCaregiver = cleanText(entry.caregiver).toLowerCase();
  const name = cleanText(caregiverName).toLowerCase();
  return entryCaregiver === name || entryCaregiver === "both";
}

function buildHandoffMessage({ nextRoutine, lastMeal, lastWalk, followUps }) {
  const lines = [];
  if (nextRoutine) {
    lines.push(`Next Phoenix care: ${nextRoutine.label} at ${nextRoutine.time} (${nextRoutine.owner}).`);
  } else {
    lines.push("Next Phoenix care: today's routine is covered.");
  }

  if (lastMeal) {
    lines.push(`Last meal: ${lastMeal.title} by ${lastMeal.caregiver} at ${formatDateTime(lastMeal.occurredAt)}.`);
  } else {
    lines.push("No meals logged today.");
  }

  if (lastWalk) {
    lines.push(`Last walk: ${lastWalk.title} by ${lastWalk.caregiver} at ${formatDateTime(lastWalk.occurredAt)}.`);
  } else {
    lines.push("No walks logged today.");
  }

  if (followUps.length) {
    lines.push(`Follow-up: ${followUps[0].title} needs review${followUps.length > 1 ? `, plus ${followUps.length - 1} more` : ""}.`);
  } else {
    lines.push("No active follow-ups logged today.");
  }

  return lines.join(" ");
}

function makeEntryId(entry) {
  const stamp = new Date(entry.occurredAt).getTime().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `entry_${entry.type}_${stamp}_${rand}`;
}

function countType(entries, type) {
  return entries.filter((entry) => entry.type === type).length;
}

function sumNumber(entries, type, field) {
  return entries.filter((entry) => entry.type === type).reduce((total, entry) => total + (Number(entry[field]) || 0), 0);
}

function sumAll(entries, field) {
  return entries.reduce((total, entry) => total + (Number(entry[field]) || 0), 0);
}

function entriesForLocalDay(entries, now) {
  const target = new Date(now);
  return entries.filter((entry) => {
    const date = new Date(entry.occurredAt);
    return (
      date.getFullYear() === target.getFullYear() &&
      date.getMonth() === target.getMonth() &&
      date.getDate() === target.getDate()
    );
  });
}

function entriesWithinDays(entries, now, days) {
  const end = new Date(now);
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return entries.filter((entry) => {
    const occurred = new Date(entry.occurredAt);
    return occurred >= start && occurred <= end;
  });
}

function routineMatchesEntry(routine, entry) {
  const routineLabel = routine.label.toLowerCase();
  const title = entry.title.toLowerCase();
  const note = String(entry.note || "").toLowerCase();
  return title === routineLabel || title.includes(routineLabel) || note.includes(routineLabel);
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function shiftIso(value, hours) {
  const date = new Date(value);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}
