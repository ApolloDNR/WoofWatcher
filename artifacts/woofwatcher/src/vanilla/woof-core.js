const ENTRY_TYPES = new Set([
  "meal",
  "treat",
  "walk",
  "park",
  "potty",
  "poop",
  "pee",
  "play",
  "training",
  "social",
  "mood",
  "alone",
  "vomit",
  "health",
  "vet",
  "weight",
  "medication",
  "note"
]);
const GOAL_CATEGORIES = new Set(["weight", "training", "anxiety", "social", "health", "custom"]);
const GOAL_STATUSES = new Set(["active", "paused", "done"]);
const RECORD_TYPES = new Set(["vet", "vaccine", "weight", "instruction", "medication", "microchip"]);
const CARE_ROOM_TRANSFER_TYPE = "woofwatcher.care-room-transfer";

const TYPE_DEFAULT_TITLES = {
  meal: "Meal",
  treat: "Treat",
  walk: "Walk",
  park: "Dog park",
  potty: "Potty",
  poop: "Poop",
  pee: "Pee",
  play: "Play",
  training: "Training",
  social: "Social interaction",
  mood: "Mood check",
  alone: "Alone time",
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
    dietProfile: {
      primaryFood: "Regular kibble Phoenix tolerates well",
      normalPortion: "1 to 1.5 cups per meal, adjusted gently",
      mealSchedule: "Breakfast, dinner, and a small bedtime snack",
      toppers: "Warm water or gentle topper only when needed",
      supplements: "Only vet-approved supplements",
      bedtimeSnack: "Small snack before sleep to reduce long empty-stomach windows",
      treatsAllowed: "Training treats and simple chews",
      avoid: "Rich table scraps and sudden food changes",
      sensitivities: "Food anxiety and long meal gaps",
      appetiteQuirks: "Eats best when the house is calm and nobody pressures her",
      vetNotes: "Track appetite, refused meals, and yellow bile patterns for vet review"
    },
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
    goals: [
      {
        id: "goal_weight_stability",
        category: "weight",
        title: "Stable weight gain",
        target: "Move toward 58 lb with vet-guided pacing",
        status: "active",
        due: "Monthly",
        note: "Use gentle trend tracking; do not force sudden food changes."
      },
      {
        id: "goal_place_work",
        category: "training",
        title: "Calm place work",
        target: "Three short calm sessions per week",
        status: "active",
        due: "Weekly",
        note: "Track whether she settles faster when food or visitors are involved."
      },
      {
        id: "goal_social_neutrality",
        category: "social",
        title: "Neutral dog exposure",
        target: "Calm, low-pressure interactions",
        status: "active",
        due: "Ongoing",
        note: "Log dog park visits and sidewalk passes with mood notes."
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
  const source = unwrapTransferState(input);
  const defaults = getDefaultState(source.createdAt || now);
  const profile = typeof source.profile === "object" && source.profile ? source.profile : {};
  const weight = typeof profile.weight === "object" && profile.weight ? profile.weight : {};
  const dietProfile = typeof source.dietProfile === "object" && source.dietProfile ? source.dietProfile : {};

  return {
    ...defaults,
    ...compactObject(source),
    version: 1,
    profile: {
      ...defaults.profile,
      ...compactObject(profile),
      weight: {
        ...defaults.profile.weight,
        ...compactObject(weight)
      }
    },
    caregivers: Array.isArray(source.caregivers) && source.caregivers.length ? source.caregivers.map(normalizeCaregiver) : defaults.caregivers,
    dietProfile: normalizeDietProfileInput({ ...defaults.dietProfile, ...dietProfile }),
    routines: Array.isArray(source.routines) ? sortRoutines(source.routines.map(normalizeRoutineInput)) : defaults.routines,
    goals: Array.isArray(source.goals) ? sortGoals(source.goals.map(normalizeGoalInput)) : defaults.goals,
    records: Array.isArray(source.records) ? source.records.map(normalizeRecordInput) : defaults.records,
    entries: Array.isArray(source.entries) ? source.entries.map(normalizeImportedEntry) : defaults.entries,
    updatedAt: now
  };
}

export function buildImportReviewMessage(input = {}) {
  const petName = resolvePetName(input.profile?.name);
  return input.packageType === CARE_ROOM_TRANSFER_TYPE
    ? `Care room transfer imported. Review ${petName}'s handoff and latest timeline before continuing care.`
    : `Backup imported. Review ${petName}'s latest care timeline before acting on any old notes.`;
}

export function normalizeCaregiverInput(input = {}) {
  return normalizeCaregiver(input);
}

export function upsertCaregiverProfile(state = {}, previousName = "", input = {}, now = new Date().toISOString()) {
  const normalized = normalizeState(state, now);
  const previous = cleanText(previousName);
  const caregiver = normalizeCaregiver(input);
  const target = previous || caregiver.name;
  let replaced = false;

  const caregivers = (normalized.caregivers || []).map((item) => {
    const existing = normalizeCaregiver(item);
    if (namesEqual(existing.name, target)) {
      replaced = true;
      return caregiver;
    }
    return existing;
  });

  if (!replaced) caregivers.push(caregiver);

  const shouldMigrate = previous && !namesEqual(previous, caregiver.name);
  return normalizeState(
    {
      ...normalized,
      caregivers: dedupeCaregivers(caregivers),
      routines: shouldMigrate ? replaceRoutineOwner(normalized.routines, previous, caregiver.name) : normalized.routines,
      entries: shouldMigrate ? replaceEntryCaregiver(normalized.entries, previous, caregiver.name) : normalized.entries
    },
    now
  );
}

export function removeCaregiverProfile(state = {}, caregiverName = "", now = new Date().toISOString()) {
  const normalized = normalizeState(state, now);
  const target = cleanText(caregiverName);
  if (!target) return normalized;

  const caregivers = (normalized.caregivers || []).filter((caregiver) => !namesEqual(caregiver.name, target));
  return normalizeState(
    {
      ...normalized,
      caregivers: caregivers.length ? caregivers : normalized.caregivers,
      routines: replaceRoutineOwner(normalized.routines, target, "Either caregiver")
    },
    now
  );
}

export function normalizeEntryInput(input = {}) {
  const type = ENTRY_TYPES.has(input.type) ? input.type : "note";
  const title = cleanText(input.title) || TYPE_DEFAULT_TITLES[type] || "Care note";
  const occurredAt = normalizeDate(input.occurredAt);
  const severity = ["normal", "watch", "urgent"].includes(input.severity) ? input.severity : "normal";
  const trustState = ["Confirmed", "Pending", "Estimated", "Corrected"].includes(input.trustState) ? input.trustState : "Confirmed";
  const visibility = ["Household", "Private", "Vet review"].includes(input.visibility) ? input.visibility : "Household";

  return {
    type,
    title,
    caregiver: cleanText(input.caregiver) || "Unassigned",
    occurredAt,
    durationMinutes: clampWholeNumber(input.durationMinutes),
    dogInteractions: clampWholeNumber(input.dogInteractions),
    amount: cleanText(input.amount),
    mealType: cleanText(input.mealType),
    servedAt: input.servedAt ? normalizeDate(input.servedAt) : "",
    servedBy: cleanText(input.servedBy),
    food: cleanText(input.food),
    portionOffered: cleanText(input.portionOffered),
    portionEaten: cleanText(input.portionEaten),
    outcomeAt: input.outcomeAt ? normalizeDate(input.outcomeAt) : "",
    outcomeBy: cleanText(input.outcomeBy),
    appetite: cleanText(input.appetite),
    pottyLocation: cleanText(input.pottyLocation),
    pottyOutcome: cleanText(input.pottyOutcome),
    treatType: cleanText(input.treatType),
    reason: cleanText(input.reason),
    reaction: cleanText(input.reaction),
    skill: cleanText(input.skill),
    outcome: cleanText(input.outcome),
    moodBefore: cleanText(input.moodBefore),
    mood: cleanText(input.mood),
    moodAfter: cleanText(input.moodAfter),
    aloneOutcome: cleanText(input.aloneOutcome),
    endedAt: input.endedAt ? normalizeDate(input.endedAt) : "",
    photo: cleanText(input.photo),
    trustState,
    visibility,
    note: cleanText(input.note),
    severity
  };
}

export function normalizeDietProfileInput(input = {}) {
  return {
    primaryFood: cleanText(input.primaryFood) || "Food not set",
    normalPortion: cleanText(input.normalPortion) || "Portion not set",
    mealSchedule: cleanText(input.mealSchedule) || "Schedule not set",
    toppers: cleanText(input.toppers),
    supplements: cleanText(input.supplements),
    bedtimeSnack: cleanText(input.bedtimeSnack),
    treatsAllowed: cleanText(input.treatsAllowed),
    avoid: cleanText(input.avoid),
    sensitivities: cleanText(input.sensitivities),
    appetiteQuirks: cleanText(input.appetiteQuirks),
    vetNotes: cleanText(input.vetNotes)
  };
}

export function normalizeRoutineInput(input = {}) {
  const type = ENTRY_TYPES.has(input.type) ? input.type : "note";
  const label = cleanText(input.label) || TYPE_DEFAULT_TITLES[type] || "Care routine";
  const time = cleanText(input.time) || "Unscheduled";
  return {
    id: cleanText(input.id) || makeRoutineId({ type, label, time }),
    label,
    type,
    time,
    owner: cleanText(input.owner) || "Either caregiver",
    note: cleanText(input.note)
  };
}

export function upsertRoutine(routines = [], input = {}) {
  const routine = normalizeRoutineInput(input);
  const existing = Array.isArray(routines) ? routines : [];
  const replaced = existing.some((item) => item.id === routine.id);
  const next = replaced ? existing.map((item) => (item.id === routine.id ? routine : normalizeRoutineInput(item))) : [...existing.map(normalizeRoutineInput), routine];
  return sortRoutines(next);
}

export function removeRoutine(routines = [], routineId = "") {
  const target = cleanText(routineId);
  return sortRoutines((Array.isArray(routines) ? routines : []).filter((routine) => routine.id !== target).map(normalizeRoutineInput));
}

export function normalizeGoalInput(input = {}) {
  const category = GOAL_CATEGORIES.has(input.category) ? input.category : "custom";
  const title = cleanText(input.title) || "Care goal";
  return {
    id: cleanText(input.id) || makeGoalId({ category, title }),
    category,
    title,
    target: cleanText(input.target) || "Define target",
    status: GOAL_STATUSES.has(input.status) ? input.status : "active",
    due: cleanText(input.due) || "No date set",
    note: cleanText(input.note)
  };
}

export function upsertGoal(goals = [], input = {}) {
  const goal = normalizeGoalInput(input);
  const existing = Array.isArray(goals) ? goals : [];
  const replaced = existing.some((item) => item.id === goal.id);
  const next = replaced ? existing.map((item) => (item.id === goal.id ? goal : normalizeGoalInput(item))) : [...existing.map(normalizeGoalInput), goal];
  return sortGoals(next);
}

export function removeGoal(goals = [], goalId = "") {
  const target = cleanText(goalId);
  return sortGoals((Array.isArray(goals) ? goals : []).filter((goal) => goal.id !== target).map(normalizeGoalInput));
}

export function normalizeRecordInput(input = {}) {
  const type = RECORD_TYPES.has(input.type) ? input.type : "instruction";
  const title = cleanText(input.title) || "Care record";
  return {
    id: cleanText(input.id) || makeRecordId({ type, title }),
    type,
    title,
    due: cleanText(input.due) || "No date set",
    note: cleanText(input.note)
  };
}

export function upsertRecord(records = [], input = {}) {
  const record = normalizeRecordInput(input);
  const existing = Array.isArray(records) ? records : [];
  const replaced = existing.some((item) => item.id === record.id);
  return replaced ? existing.map((item) => (item.id === record.id ? record : normalizeRecordInput(item))) : [record, ...existing.map(normalizeRecordInput)];
}

export function removeRecord(records = [], recordId = "") {
  const target = cleanText(recordId);
  return (Array.isArray(records) ? records : []).filter((record) => record.id !== target).map(normalizeRecordInput);
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
    potty: countType(entries, "potty"),
    healthNotes: countType(entries, "health"),
    vetRecords: countType(entries, "vet"),
    weightChecks: countType(entries, "weight"),
    followUps: entries.filter((entry) => entry.requiresFollowUp).length,
    caregivers: [...new Set(entries.map((entry) => entry.caregiver).filter(Boolean))]
  };
}

export function getCareCalendar(state, now = new Date().toISOString()) {
  const target = new Date(now);
  const year = target.getFullYear();
  const month = target.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthEntries = entriesForCalendarMonth(state.entries || [], year, month);
  const todayKey = formatDateKey(target);
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, month, index + 1);
    const dateKey = formatDateKey(date);
    const entries = monthEntries
      .filter((entry) => formatDateKey(new Date(entry.occurredAt)) === dateKey)
      .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));
    const counts = getDayCounts(entries);
    const needsReview = entries.some((entry) => entry.requiresFollowUp || entry.severity === "urgent");
    return {
      day: index + 1,
      dateKey,
      isToday: dateKey === todayKey,
      totalEntries: entries.length,
      counts,
      status: needsReview ? "review" : entries.length ? "active" : "empty",
      summary: buildDaySummary(counts),
      entries
    };
  });

  return {
    monthLabel: firstDay.toLocaleString("en-US", { month: "long", year: "numeric" }),
    year,
    month,
    firstWeekday: firstDay.getDay(),
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    monthTotals: {
      ...getMonthlySummary({ ...state, entries: monthEntries }, now),
      totalEntries: monthEntries.length
    },
    reviewDays: days.filter((day) => day.status === "review").length,
    vomitDays: days.filter((day) => day.counts.vomit > 0).length,
    activeDays: days.filter((day) => day.totalEntries > 0).length,
    days
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

export function getReminderCenter(state, now = new Date().toISOString()) {
  const target = new Date(now);
  const currentMinutes = target.getHours() * 60 + target.getMinutes();
  const todayEntries = entriesForLocalDay(state.entries || [], now);
  const items = (state.routines || []).map((routine) => {
    const normalized = normalizeRoutineInput(routine);
    const completedEntry = todayEntries.find((entry) => routineMatchesEntry(normalized, entry)) || null;
    const routineMinutes = parseRoutineMinutes(normalized.time);
    const minutesUntil = routineMinutes === null ? null : routineMinutes - currentMinutes;
    const status = getReminderStatus({ completedEntry, routineMinutes, minutesUntil });
    return {
      ...normalized,
      status,
      statusLabel: titleCase(status),
      minutesUntil,
      completedAt: completedEntry?.occurredAt || null,
      completedBy: completedEntry?.caregiver || "",
      requiresAction: status === "due" || status === "overdue"
    };
  });
  const actionable = items.filter((item) => item.status !== "completed").sort(sortReminderItems);
  const nextReminder = actionable[0] || null;

  return {
    dateLabel: target.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric"
    }),
    totalCount: items.length,
    completedCount: items.filter((item) => item.status === "completed").length,
    dueCount: items.filter((item) => item.status === "due").length,
    overdueCount: items.filter((item) => item.status === "overdue").length,
    upcomingCount: items.filter((item) => item.status === "upcoming").length,
    unscheduledCount: items.filter((item) => item.status === "unscheduled").length,
    nextReminder,
    items,
    message: buildReminderMessage({ items, nextReminder })
  };
}

export function getNotificationCenter(state, now = new Date().toISOString(), options = {}) {
  const petName = resolvePetName(state.profile?.name);
  const supported = options.supported !== false;
  const permission = cleanText(options.permission || "default") || "default";
  const reminders = getReminderCenter(state, now);
  const dueReminders = reminders.items
    .filter((item) => item.status === "due" || item.status === "overdue")
    .sort(sortReminderItems);
  const nextReminder = dueReminders[0] || reminders.nextReminder;
  const dateKey = formatDateKey(new Date(now));
  const notificationKey = dueReminders.length
    ? `${dateKey}:${dueReminders.map((item) => item.id).sort().join(",")}`
    : "";
  const deliveryBoundary =
    "Notifications are local reminders while WoofWatcher is open. Closed-app or cross-device push still needs a hosted notification service.";

  if (!supported) {
    return {
      supported: false,
      permission,
      status: "unsupported",
      statusLabel: "Not Supported",
      canRequestPermission: false,
      canSendTest: false,
      shouldNotifyNow: false,
      dueReminderCount: dueReminders.length,
      notificationKey,
      nextNotification: buildNotificationPayload(nextReminder, dueReminders, petName),
      deliveryBoundary,
      message: "This browser does not support local care notifications. Reminder Center still shows due care."
    };
  }

  if (permission === "denied") {
    return {
      supported: true,
      permission,
      status: "blocked",
      statusLabel: "Blocked",
      canRequestPermission: false,
      canSendTest: false,
      shouldNotifyNow: false,
      dueReminderCount: dueReminders.length,
      notificationKey,
      nextNotification: buildNotificationPayload(nextReminder, dueReminders, petName),
      deliveryBoundary,
      message: `Notifications are blocked in this browser. Use device settings or the Reminder Center for ${petName} care.`
    };
  }

  if (permission === "granted") {
    return {
      supported: true,
      permission,
      status: "enabled",
      statusLabel: "Enabled",
      canRequestPermission: false,
      canSendTest: true,
      shouldNotifyNow: dueReminders.length > 0,
      dueReminderCount: dueReminders.length,
      notificationKey,
      nextNotification: buildNotificationPayload(nextReminder, dueReminders, petName),
      deliveryBoundary,
      message: dueReminders.length
        ? `App-open alerts are enabled. ${dueReminders.length} ${petName} reminder${dueReminders.length === 1 ? "" : "s"} need attention.`
        : `App-open alerts are enabled. ${nextReminder ? `Next: ${nextReminder.label} at ${nextReminder.time}.` : "Scheduled care is covered."}`
    };
  }

  return {
    supported: true,
    permission,
    status: "ready_to_enable",
    statusLabel: "Ready",
    canRequestPermission: true,
    canSendTest: false,
    shouldNotifyNow: false,
    dueReminderCount: dueReminders.length,
    notificationKey,
    nextNotification: buildNotificationPayload(nextReminder, dueReminders, petName),
    deliveryBoundary,
    message: "Enable alerts to let WoofWatcher nudge you while the app is open. Closed-app push needs a hosted notification service."
  };
}

export function getCaregiverHandoff(state, now = new Date().toISOString()) {
  const petName = resolvePetName(state.profile?.name);
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
    message: buildHandoffMessage({ petName, nextRoutine, lastMeal, lastWalk, followUps })
  };
}

export function getHouseholdPulse(state, now = new Date().toISOString()) {
  const petName = resolvePetName(state?.profile?.name);
  const plan = getTodayPlan(state, now);
  const handoff = getCaregiverHandoff(state, now);
  const health = getHealthWatch(state, now);
  const todayEntries = entriesForLocalDay(state.entries || [], now).sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  const timeline = todayEntries.slice(0, 6).map((entry) => ({
    id: entry.id,
    type: entry.type,
    title: entry.title,
    caregiver: entry.caregiver,
    occurredAt: entry.occurredAt,
    label: `${entry.title} by ${entry.caregiver}`,
    detail: entry.note || entry.mood || entry.appetite || entry.outcome || ""
  }));
  const nextAction = plan.nextItems[0] || {
    label: "Routine covered",
    type: "note",
    time: "Today",
    owner: `${petName}'s humans`,
    note: "No scheduled care is currently waiting."
  };
  const latest = timeline[0];
  const summary = latest
    ? `${petName} has ${plan.completedCount}/${plan.totalCount} routine items covered. Latest: ${latest.title} by ${latest.caregiver}.`
    : `${petName} has ${plan.completedCount}/${plan.totalCount} routine items covered. Start with the next planned care item.`;

  return {
    label: "Household Pulse",
    summary,
    nextAction,
    completedCount: plan.completedCount,
    totalCount: plan.totalCount,
    humans: handoff.caregiverLoad,
    timeline,
    healthStatus: health.label,
    healthBoundary: "Household Pulse is shared care context, not veterinary advice."
  };
}

export function getAvatarState(state, now = new Date().toISOString()) {
  const normalized = normalizeState(state, now);
  const reminders = getReminderCenter(normalized, now);
  const plan = getTodayPlan(normalized, now);
  const health = getHealthWatch(normalized, now);
  const bileWatch = getBileWatch(normalized, now);
  const todayEntries = entriesForLocalDay(normalized.entries || [], now).sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  const latestVomit = todayEntries.find((entry) => entry.type === "vomit");
  const activeAlone = todayEntries.find((entry) => entry.type === "alone" && !entry.endedAt);
  const latestTrainingWin = todayEntries.find((entry) => entry.type === "training" && /win|good|calm|brave|proud/i.test(`${entry.title} ${entry.outcome} ${entry.note} ${entry.moodAfter}`));
  const walkPlanned = reminders.items.find((item) => item.type === "walk" && (item.status === "due" || item.status === "upcoming"));
  const overdueWalk = reminders.items.find((item) => item.type === "walk" && item.status === "overdue");
  const foodGapEvidence = bileWatch.emptyStomachWindow ? `${bileWatch.hoursSinceLastFood} hours since food` : "";

  if (latestVomit || health.status === "review" || bileWatch.status === "review") {
    const urgentReview =
      latestVomit?.severity === "urgent" ||
      health.signals.some((signal) => /repeated|urgent|red flag/i.test(signal)) ||
      bileWatch.signals.some((signal) => /repeated|urgent|red flag/i.test(signal));
    return avatarState({
      mood: "tummy-watch",
      urgency: urgentReview ? "review" : "watch",
      scene: "tummy-watch",
      speech: "My tummy was weird. Let's keep an eye on me and save the details for the vet if it repeats.",
      suggestedAction: "Check appetite and energy",
      evidence: [latestVomit ? `Latest vomit log: ${latestVomit.title}` : "", health.signals[0], bileWatch.signals[0]].filter(Boolean)
    });
  }

  if (activeAlone) {
    return avatarState({
      mood: "home-alone",
      urgency: "watch",
      scene: "home-alone",
      speech: "I'm holding down the house. Log how I did when you get back.",
      suggestedAction: "End alone time",
      evidence: [`Alone time started ${formatDateTime(activeAlone.occurredAt)}`]
    });
  }

  if (overdueWalk) {
    return avatarState({
      mood: "bored",
      urgency: "watch",
      scene: "living-room",
      speech: "I have inspected the room twice. A sniff walk would improve my leadership skills.",
      suggestedAction: `Start ${overdueWalk.label}`,
      evidence: [`${overdueWalk.label} is overdue`, reminders.message]
    });
  }

  if (walkPlanned) {
    return avatarState({
      mood: "excited",
      urgency: "steady",
      scene: "walk-path",
      speech: "Adventure is scheduled. I am emotionally preparing my paws.",
      suggestedAction: `${walkPlanned.label} at ${walkPlanned.time}`,
      evidence: [`${walkPlanned.label} is ${walkPlanned.statusLabel.toLowerCase()}`]
    });
  }

  if (latestTrainingWin) {
    return avatarState({
      mood: "proud",
      urgency: "steady",
      scene: "training-win",
      speech: "I was brave. Please update my resume.",
      suggestedAction: "Celebrate training win",
      evidence: [`Training win: ${latestTrainingWin.title}`]
    });
  }

  if (bileWatch.emptyStomachWindow) {
    return avatarState({
      mood: "hungry-watch",
      urgency: "watch",
      scene: "kitchen",
      speech: "My snack committee may need to meet soon.",
      suggestedAction: "Offer normal snack if appropriate",
      evidence: [foodGapEvidence, bileWatch.signals[0]].filter(Boolean)
    });
  }

  if (plan.completedCount >= plan.totalCount && plan.totalCount > 0) {
    return avatarState({
      mood: "calm",
      urgency: "steady",
      scene: "cozy-home",
      speech: "Care is covered. I will now supervise the household from a comfortable location.",
      suggestedAction: "Review today's notes",
      evidence: [`${plan.completedCount}/${plan.totalCount} routines covered`]
    });
  }

  return avatarState({
    mood: "ready",
    urgency: "steady",
    scene: "morning-yard",
    speech: "Let's make today amazing.",
    suggestedAction: plan.nextItems[0] ? `${plan.nextItems[0].label} at ${plan.nextItems[0].time}` : "Log Phoenix's next moment",
    evidence: [plan.nextItems[0] ? `Next planned care: ${plan.nextItems[0].label}` : "No urgent care signals"]
  });
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

export function getBileWatch(state, now = new Date().toISOString()) {
  const target = new Date(now);
  const petName = resolvePetName(state.profile?.name);
  const recent = entriesWithinDays(state.entries || [], now, 14);
  const recentFood = entriesWithinDays(state.entries || [], now, 3)
    .filter(isFoodEntry)
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  const latestFood = recentFood[0] || null;
  const hoursSinceLastFood = latestFood
    ? roundHours((target.getTime() - new Date(latestFood.occurredAt).getTime()) / (60 * 60 * 1000))
    : null;
  const bedtimeSnackLogged = entriesWithinDays(state.entries || [], now, 2).some(isBedtimeSnackEntry);
  const yellowBileEntries = recent.filter((entry) => entry.type === "vomit" && hasYellowBileSignal(entry));
  const refusedMealEntries = recent.filter((entry) => entry.type === "meal" && hasAppetiteDisruption(entry));
  const emptyStomachWindow = hoursSinceLastFood === null || hoursSinceLastFood >= 10;
  const status =
    hoursSinceLastFood === null || hoursSinceLastFood >= 12 || yellowBileEntries.length >= 2 || refusedMealEntries.length > 0
      ? "review"
      : emptyStomachWindow || yellowBileEntries.length === 1 || !bedtimeSnackLogged
        ? "watch"
        : "steady";
  const signals = [];
  const actions = [];

  if (latestFood) {
    signals.push(`${hoursSinceLastFood} hours since ${petName} last logged food (${latestFood.title}).`);
  } else {
    signals.push("No meal or snack has been logged in the last 3 days.");
  }

  signals.push(
    bedtimeSnackLogged
      ? "Bedtime snack coverage logged in the recent overnight window."
      : "No bedtime snack coverage logged in the recent overnight window."
  );

  if (yellowBileEntries.length) {
    signals.push(`${yellowBileEntries.length} yellow bile or bile-like vomit incident${yellowBileEntries.length === 1 ? "" : "s"} logged in the last 14 days.`);
  }

  if (refusedMealEntries.length) {
    signals.push(`${refusedMealEntries.length} refused or skipped meal pattern${refusedMealEntries.length === 1 ? "" : "s"} logged in the last 14 days.`);
  }

  if (emptyStomachWindow) {
    actions.push(`Offer a small calm snack if ${petName} is willing and it fits their normal routine.`);
  }

  if (!bedtimeSnackLogged) {
    actions.push("Use the bedtime snack reminder when it fits her routine, then log whether it helped the next morning.");
  }

  if (yellowBileEntries.length || refusedMealEntries.length) {
    actions.push("Track timing, appetite, energy, stool changes, and meal gaps; contact a veterinarian if the pattern repeats, worsens, or appears with any red flag.");
  }

  if (!actions.length) {
    actions.push("Keep logging meals, bedtime snack coverage, appetite, and any bile/vomit timing.");
  }

  return {
    status,
    label: status === "steady" ? "Steady" : status === "watch" ? "Watch" : "Review",
    latestFood,
    hoursSinceLastFood,
    bedtimeSnackLogged,
    recentYellowBileCount: yellowBileEntries.length,
    refusedMealCount: refusedMealEntries.length,
    emptyStomachWindow,
    signals,
    actions,
    vetBoundary:
      "Bile Watch tracks empty-stomach and yellow-bile patterns for caregiver and veterinarian review. It is not a diagnosis."
  };
}

export function getGoalReview(state, now = new Date().toISOString()) {
  const goals = sortGoals((state.goals || []).map(normalizeGoalInput));
  const active = goals.filter((goal) => goal.status === "active");
  const done = goals.filter((goal) => goal.status === "done");
  const monthEntries = entriesForCurrentMonth(state.entries || [], now);
  const latestWeight = latestWeightEntry(state.entries || []);
  const trainingEntries = monthEntries.filter((entry) => entry.type === "training");
  const socialEntries = monthEntries.filter((entry) => entry.type === "social" || entry.type === "park");
  const review = {
    totalGoals: goals.length,
    activeGoals: active.length,
    completedGoals: done.length,
    goals,
    weight: {
      current: latestWeight?.weight ?? null,
      label: latestWeight ? `${latestWeight.weight} lb logged ${formatDateTime(latestWeight.entry.occurredAt)}` : "No weight check logged yet"
    },
    training: {
      sessions: trainingEntries.length,
      minutes: sumAll(trainingEntries, "durationMinutes")
    },
    social: {
      sessions: socialEntries.length,
      interactions: sumAll(socialEntries, "dogInteractions")
    },
    highlights: []
  };

  if (review.weight.current !== null) review.highlights.push(`Latest weight trend: ${review.weight.current} lb.`);
  review.highlights.push(`Training this month: ${review.training.sessions} sessions, ${review.training.minutes} minutes.`);
  review.highlights.push(`Social exposure this month: ${review.social.sessions} sessions, ${review.social.interactions} dog interactions.`);
  if (!active.length) review.highlights.push("No active goals are set.");
  return review;
}

export function getTrainingProgress(state, now = new Date().toISOString()) {
  const target = new Date(now);
  const monthEntries = entriesForCurrentMonth(state.entries || [], now);
  const trainingEntries = monthEntries.filter((entry) => entry.type === "training");
  const socialEntries = monthEntries.filter((entry) => entry.type === "social" || entry.type === "park");
  const progressEntries = [...trainingEntries, ...socialEntries].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  const calmEntries = progressEntries.filter(hasCalmSignal);
  const struggleEntries = progressEntries.filter(hasStruggleSignal);
  const status = progressEntries.length === 0 ? "Needs logs" : struggleEntries.length > 0 ? "Building" : "Steady";

  return {
    monthLabel: target.toLocaleString("en-US", { month: "long", year: "numeric" }),
    status,
    training: {
      sessions: trainingEntries.length,
      minutes: sumAll(trainingEntries, "durationMinutes")
    },
    social: {
      sessions: socialEntries.length,
      dogInteractions: sumAll(socialEntries, "dogInteractions")
    },
    calmSignals: calmEntries.length,
    struggleSignals: struggleEntries.length,
    wins: buildProgressWins(calmEntries),
    focusAreas: buildProgressFocusAreas(struggleEntries, progressEntries),
    recentEntries: progressEntries.slice(0, 6)
  };
}

export function getAchievementReview(state, now = new Date().toISOString()) {
  const normalized = normalizeState(state, now);
  const visibleEntries = (normalized.entries || []).filter((entry) => entry.visibility !== "Private");
  const recentEntries = entriesWithinDays(visibleEntries, now, 7);
  const monthEntries = entriesForCurrentMonth(visibleEntries, now);
  const routineStreak = getConsecutiveLoggedDayCount(visibleEntries, now, 7);
  const trainingSessions = recentEntries.filter((entry) => entry.type === "training").length;
  const recentVomit = recentEntries.filter((entry) => entry.type === "vomit").length;
  const recentFood = recentEntries.filter(isFoodEntry).length;
  const bedtimeSnacks = recentEntries.filter(isBedtimeSnackEntry).length;
  const calmAloneEntries = recentEntries.filter((entry) => entry.type === "alone" && hasCalmAloneSignal(entry));
  const concerningAloneEntries = recentEntries.filter((entry) => entry.type === "alone" && hasConcerningAloneSignal(entry));
  const requiredRecordTypes = ["vaccine", "vet", "microchip"];
  const recordsPresent = requiredRecordTypes.filter((type) => hasRecordType(normalized.records || [], type));
  const achievements = [
    buildAchievement({
      id: "routine_streak",
      title: "7-day care streak",
      category: "Care rhythm",
      progress: routineStreak,
      target: 7,
      status: routineStreak >= 7 ? "earned" : routineStreak > 0 ? "progress" : "needs_log",
      summary: routineStreak >= 7
        ? "Phoenix has care proof on every day of the last week."
        : "Log at least one household-visible care event each day to build this streak.",
      evidence: `${routineStreak}/7 days with household-visible logs.`
    }),
    buildAchievement({
      id: "training_consistency",
      title: "Training consistency",
      category: "Training",
      progress: trainingSessions,
      target: 3,
      status: trainingSessions >= 3 ? "earned" : trainingSessions > 0 ? "progress" : "needs_log",
      summary: trainingSessions >= 3
        ? "Three short training sessions are logged this week."
        : "Log short, calm sessions to make training patterns visible.",
      evidence: `${trainingSessions}/3 training sessions in the last 7 days.`
    }),
    buildAchievement({
      id: "happy_tummy_week",
      title: "Happy tummy week",
      category: "Health watch",
      progress: recentVomit === 0 && recentFood > 0 ? 1 : 0,
      target: 1,
      status: recentVomit === 0 && recentFood > 0 ? "earned" : recentFood > 0 ? "progress" : "needs_log",
      summary: recentVomit === 0 && recentFood > 0
        ? "Food was logged and no vomit events were recorded in the last week."
        : "Keep logging meals, snacks, appetite, and any vomit timing.",
      evidence: `${recentFood} food logs and ${recentVomit} vomit logs in the last 7 days.`
    }),
    buildAchievement({
      id: "bedtime_snack_proof",
      title: "Bedtime snack proof",
      category: "Bile Watch",
      progress: bedtimeSnacks,
      target: 3,
      status: bedtimeSnacks >= 3 ? "earned" : "progress",
      summary: bedtimeSnacks >= 3
        ? "Bedtime snack coverage is visible for several nights."
        : "Use bedtime snack logs to test whether overnight food gaps improve.",
      evidence: `${bedtimeSnacks}/3 bedtime snack logs in the last 7 days.`
    }),
    buildAchievement({
      id: "calm_alone_time",
      title: "Calm alone time",
      category: "Household",
      progress: calmAloneEntries.length,
      target: 1,
      status: calmAloneEntries.length > 0 && concerningAloneEntries.length === 0 ? "earned" : calmAloneEntries.length > 0 ? "progress" : "needs_log",
      summary: calmAloneEntries.length > 0 && concerningAloneEntries.length === 0
        ? "A calm return was logged without a concerning alone-time outcome this week."
        : "Log Leaving Home and I'm Home outcomes so separation patterns are visible.",
      evidence: `${calmAloneEntries.length} calm and ${concerningAloneEntries.length} watch outcomes in the last 7 days.`
    }),
    buildAchievement({
      id: "records_complete",
      title: "Records complete",
      category: "Care vault",
      progress: recordsPresent.length,
      target: requiredRecordTypes.length,
      status: recordsPresent.length >= requiredRecordTypes.length ? "earned" : recordsPresent.length > 0 ? "progress" : "needs_log",
      summary: recordsPresent.length >= requiredRecordTypes.length
        ? "Core vaccine, vet, and microchip references are stored."
        : "Add vaccine, vet, and microchip records before relying on emergency sharing.",
      evidence: `${recordsPresent.length}/${requiredRecordTypes.length} core record types stored.`
    })
  ];
  const completedCount = achievements.filter((achievement) => achievement.status === "earned").length;

  return {
    monthLabel: new Date(now).toLocaleString("en-US", { month: "long", year: "numeric" }),
    totalCount: achievements.length,
    completedCount,
    progressCount: achievements.filter((achievement) => achievement.status === "progress").length,
    score: Math.round((completedCount / achievements.length) * 100),
    featured: achievements.find((achievement) => achievement.status === "earned") || achievements[0],
    achievements,
    evidence: {
      weekLogs: recentEntries.length,
      monthLogs: monthEntries.length,
      householdCaregivers: [...new Set(monthEntries.map((entry) => entry.caregiver).filter(Boolean))].length
    }
  };
}

export function buildReportText(state, now = new Date().toISOString()) {
  const profile = state.profile || { name: "Phoenix" };
  const petName = resolvePetName(profile.name);
  const summary = getMonthlySummary(state, now);
  const healthWatch = getHealthWatch(state, now);
  const bileWatch = getBileWatch(state, now);
  const goalReview = getGoalReview(state, now);
  const trainingProgress = getTrainingProgress(state, now);
  const latest = [...(state.entries || [])]
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
    .slice(0, 8);

  return [
    "WoofWatcher Monthly Report",
    `${petName} - ${summary.monthLabel}`,
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
    "Bile Watch",
    `Status: ${bileWatch.label}`,
    ...bileWatch.signals.map((signal) => `- ${signal}`),
    "Care actions",
    ...bileWatch.actions.map((action) => `- ${action}`),
    "",
    "Goal Review",
    `Active goals: ${goalReview.activeGoals}/${goalReview.totalGoals}`,
    ...goalReview.highlights.map((highlight) => `- ${highlight}`),
    "",
    "Training Progress",
    `Status: ${trainingProgress.status}`,
    `Training: ${trainingProgress.training.sessions} sessions, ${trainingProgress.training.minutes} minutes`,
    `Social exposure: ${trainingProgress.social.sessions} sessions, ${trainingProgress.social.dogInteractions} dog interactions`,
    `Calm signals: ${trainingProgress.calmSignals}`,
    `Struggle signals: ${trainingProgress.struggleSignals}`,
    "Wins",
    ...trainingProgress.wins.map((win) => `- ${win}`),
    "Focus areas",
    ...trainingProgress.focusAreas.map((focus) => `- ${focus}`),
    "",
    "Recent Care Timeline",
    ...latest.map((entry) => `- ${formatDateTime(entry.occurredAt)} | ${entry.type.toUpperCase()} | ${entry.title} | ${entry.caregiver}${entry.note ? ` | ${entry.note}` : ""}`),
    "",
    "Boundary",
    "This report is pattern tracking for caregiver and veterinarian review. It is not a veterinary diagnosis."
  ].join("\n");
}

export function buildCareRoomTransfer(state, now = new Date().toISOString()) {
  const normalizedState = normalizeState(state, now);
  const petName = resolvePetName(normalizedState.profile.name);
  const normalized = {
    ...normalizedState,
    profile: {
      ...normalizedState.profile,
      name: petName,
      publicLabel: petName,
    },
  };
  return {
    packageType: CARE_ROOM_TRANSFER_TYPE,
    version: 1,
    createdAt: now,
    petName,
    importNote: `Import this file in WoofWatcher to continue ${petName} care from the same local state.`,
    handoff: getCaregiverHandoff(normalized, now),
    monthlySummary: getMonthlySummary(normalized, now),
    healthWatch: getHealthWatch(normalized, now),
    bileWatch: getBileWatch(normalized, now),
    monthlyReport: buildReportText(normalized, now),
    state: normalized
  };
}

export function getAssistantContext(state, question = "", now = new Date().toISOString()) {
  const petName = resolvePetName(state.profile?.name);
  const assistantState = {
    ...state,
    profile: {
      ...(state.profile || {}),
      name: petName,
      publicLabel: petName,
    },
  };
  const summary = getMonthlySummary(assistantState, now);
  const healthWatch = getHealthWatch(assistantState, now);
  const bileWatch = getBileWatch(assistantState, now);
  const todayPlan = getTodayPlan(assistantState, now);
  const handoff = getCaregiverHandoff(assistantState, now);
  const reminders = getReminderCenter(assistantState, now);
  const latest = [...(assistantState.entries || [])]
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
    .slice(0, 5);

  return {
    question: cleanText(question),
    profile: assistantState.profile,
    summary,
    healthWatch,
    bileWatch,
    todayPlan,
    reminders,
    handoff,
    latest,
    localAnswer: buildLocalAssistantAnswer({ petName, question, summary, healthWatch, bileWatch, todayPlan, reminders, handoff, latest })
  };
}

function buildLocalAssistantAnswer({ petName, question, summary, healthWatch, bileWatch, todayPlan, reminders, handoff, latest }) {
  const asksVomiting = /vomit|throw|bile|yellow|nausea/i.test(question);
  const lines = [];

  if (asksVomiting) {
    lines.push(`${petName} has a vomit pattern worth tracking closely. Yellow bile often appears when a dog has an empty stomach, but WoofWatcher should treat it as a pattern for vet review, not a diagnosis.`);
  } else {
    lines.push(`${petName}'s care picture is built from today's routine, logged meals, walks, training, social exposure, and health notes.`);
  }

  lines.push(`This month: ${summary.meals} meals, ${summary.walks} walks, ${summary.trainingSessions} training sessions, ${summary.vomitIncidents} vomit incidents.`);
  lines.push(`Health watch is ${healthWatch.label.toLowerCase()}: ${healthWatch.signals[0]}`);
  lines.push(`Bile watch: ${bileWatch.label}. ${bileWatch.signals[0]}`);
  lines.push(`Today completed: ${todayPlan.completedCount}/${todayPlan.totalCount}. Next: ${todayPlan.nextItems[0]?.label || "routine covered"}.`);
  lines.push(`Reminders: ${reminders.message}`);
  lines.push(`Handoff: ${handoff.message}`);

  if (latest[0]) {
    lines.push(`Latest log: ${latest[0].title} by ${latest[0].caregiver}.`);
  }

  lines.push("For urgent symptoms, repeated vomiting, blood, lethargy, bloating, dehydration, toxin exposure, or not eating, contact a veterinarian or urgent care.");
  return lines.join(" ");
}

function avatarState({ mood, urgency, scene, speech, suggestedAction, evidence = [] }) {
  return {
    mood,
    urgency,
    scene,
    speech,
    suggestedAction,
    evidence
  };
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function resolvePetName(value) {
  const name = cleanText(value);
  return !name || name.toLowerCase() === "my dog" ? "Phoenix" : name;
}

function titleCase(value) {
  return cleanText(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([, item]) => item !== undefined && item !== null));
}

function unwrapTransferState(input = {}) {
  if (input.packageType === CARE_ROOM_TRANSFER_TYPE && typeof input.state === "object" && input.state) {
    return input.state;
  }
  return input;
}

function normalizeCaregiver(caregiver = {}) {
  return {
    name: cleanText(caregiver.name) || "Unassigned",
    role: cleanText(caregiver.role) || "Caregiver"
  };
}

function dedupeCaregivers(caregivers = []) {
  const byName = new Map();
  for (const caregiver of caregivers.map(normalizeCaregiver)) {
    byName.set(caregiver.name.toLowerCase(), caregiver);
  }
  return [...byName.values()];
}

function replaceRoutineOwner(routines = [], previousName = "", nextName = "") {
  return (routines || []).map((routine) => {
    const normalized = normalizeRoutineInput(routine);
    return namesEqual(normalized.owner, previousName) ? { ...normalized, owner: nextName } : normalized;
  });
}

function replaceEntryCaregiver(entries = [], previousName = "", nextName = "") {
  return (entries || []).map((entry) => {
    const normalized = normalizeImportedEntry(entry);
    return namesEqual(normalized.caregiver, previousName) ? { ...normalized, caregiver: nextName } : normalized;
  });
}

function namesEqual(left = "", right = "") {
  return cleanText(left).toLowerCase() === cleanText(right).toLowerCase();
}

function normalizeImportedEntry(entry = {}) {
  const normalized = createEntry(entry);
  return {
    ...normalized,
    id: cleanText(entry.id) || normalized.id
  };
}

function hasCalmSignal(entry) {
  return /calm|settled|engaged|neutral|held|loose|relax|confident/i.test(progressText(entry));
}

function hasStruggleSignal(entry) {
  return /anxious|bark|react|lung|pull|tense|stress|overwhelm|scared|refus|guard/i.test(progressText(entry));
}

function buildProgressWins(entries) {
  if (!entries.length) return ["No calm training or social wins logged yet this month."];
  return sortProgressWins(entries)
    .slice(0, 3)
    .map((entry) => `${entry.title}: ${cleanText(entry.note || entry.mood || "calm progress logged")}`);
}

function buildProgressFocusAreas(struggleEntries, progressEntries) {
  if (struggleEntries.length) {
    return sortProgressWins(struggleEntries)
      .slice(0, 3)
      .map((entry) => `${entry.title}: keep this short, low-pressure, and log what helped Phoenix recover.`);
  }

  if (!progressEntries.length) {
    return ["Log one short training session and one low-pressure social exposure to establish a baseline."];
  }

  return ["Keep repeating the calm patterns that worked, and log duration, mood, dog interactions, and recovery time."];
}

function progressText(entry) {
  return `${entry.title || ""} ${entry.mood || ""} ${entry.note || ""}`;
}

function sortProgressWins(entries) {
  return [...entries].sort((a, b) => {
    const left = a.type === "training" ? 0 : 1;
    const right = b.type === "training" ? 0 : 1;
    if (left !== right) return left - right;
    return new Date(b.occurredAt) - new Date(a.occurredAt);
  });
}

function buildAchievement({ id, title, category, progress, target, status, summary, evidence }) {
  const safeProgress = Math.max(0, Number(progress) || 0);
  const safeTarget = Math.max(1, Number(target) || 1);
  return {
    id,
    title,
    category,
    progress: safeProgress,
    target: safeTarget,
    percent: Math.min(100, Math.round((safeProgress / safeTarget) * 100)),
    status,
    statusLabel: status === "earned" ? "Earned" : status === "progress" ? "In Progress" : "Needs Log",
    summary,
    evidence
  };
}

function getConsecutiveLoggedDayCount(entries = [], now = new Date().toISOString(), limit = 7) {
  const loggedDays = new Set(entries.map((entry) => formatDateKey(new Date(entry.occurredAt))));
  let streak = 0;
  const cursor = new Date(now);
  for (let index = 0; index < limit; index += 1) {
    if (!loggedDays.has(formatDateKey(cursor))) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function hasCalmAloneSignal(entry) {
  return /calm|settled|quiet|relaxed|soft|fine|ok|okay|excited/i.test(aloneText(entry));
}

function hasConcerningAloneSignal(entry) {
  return /anxious|bark|whin|accident|vomit|destruct|panic|stress|howl/i.test(aloneText(entry));
}

function aloneText(entry) {
  return `${entry.aloneOutcome || ""} ${entry.mood || ""} ${entry.note || ""}`;
}

function hasRecordType(records = [], type = "") {
  const normalizedType = cleanText(type).toLowerCase();
  return records.some((record) => {
    const haystack = `${record.type || ""} ${record.title || ""} ${record.note || ""}`.toLowerCase();
    return haystack.includes(normalizedType);
  });
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

function buildHandoffMessage({ petName, nextRoutine, lastMeal, lastWalk, followUps }) {
  const lines = [];
  if (nextRoutine) {
    lines.push(`Next ${petName} care: ${nextRoutine.label} at ${nextRoutine.time} (${nextRoutine.owner}).`);
  } else {
    lines.push(`Next ${petName} care: today's routine is covered.`);
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

function parseRoutineMinutes(value) {
  const minutes = routineSortMinutes(value);
  return minutes === Number.MAX_SAFE_INTEGER ? null : minutes;
}

function getReminderStatus({ completedEntry, routineMinutes, minutesUntil }) {
  if (completedEntry) return "completed";
  if (routineMinutes === null) return "unscheduled";
  if (minutesUntil < -30) return "overdue";
  if (minutesUntil <= 30) return "due";
  return "upcoming";
}

function sortReminderItems(left, right) {
  const statusOrder = {
    due: 0,
    overdue: 1,
    upcoming: 2,
    unscheduled: 3,
    completed: 4
  };
  const leftStatus = statusOrder[left.status] ?? 9;
  const rightStatus = statusOrder[right.status] ?? 9;
  if (leftStatus !== rightStatus) return leftStatus - rightStatus;

  const leftMinutes = left.minutesUntil === null ? Number.MAX_SAFE_INTEGER : left.minutesUntil;
  const rightMinutes = right.minutesUntil === null ? Number.MAX_SAFE_INTEGER : right.minutesUntil;
  if (leftMinutes !== rightMinutes) return leftMinutes - rightMinutes;
  return left.label.localeCompare(right.label);
}

function buildReminderMessage({ items, nextReminder }) {
  const dueCount = items.filter((item) => item.status === "due").length;
  const overdueCount = items.filter((item) => item.status === "overdue").length;
  if (dueCount || overdueCount) {
    const parts = [];
    if (overdueCount) parts.push(`${overdueCount} overdue`);
    if (dueCount) parts.push(`${dueCount} due now`);
    return `${parts.join(" and ")}. Next: ${nextReminder.label} at ${nextReminder.time} (${nextReminder.owner}).`;
  }

  if (nextReminder) {
    return `Next Phoenix reminder: ${nextReminder.label} at ${nextReminder.time} (${nextReminder.owner}).`;
  }

  return "Today's scheduled care is covered.";
}

function buildNotificationPayload(nextReminder, dueReminders = [], petName = "Phoenix") {
  if (!nextReminder) return null;
  const isDue = dueReminders.length > 0;
  const owner = nextReminder.owner || "Either caregiver";
  return {
    title: isDue ? `${petName} care due` : `Next ${petName} care`,
    body: `${nextReminder.label} at ${nextReminder.time} (${owner}). ${nextReminder.note || "Check WoofWatcher before assuming care is covered."}`,
    tag: `woofwatcher-${nextReminder.id}`
  };
}

function makeEntryId(entry) {
  const stamp = new Date(entry.occurredAt).getTime().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `entry_${entry.type}_${stamp}_${rand}`;
}

function makeRoutineId(routine) {
  const label = cleanText(routine.label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `routine_${routine.type}_${label || "care"}_${suffix}`;
}

function makeGoalId(goal) {
  const title = cleanText(goal.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `goal_${goal.category}_${title || "care"}_${suffix}`;
}

function makeRecordId(record) {
  const title = cleanText(record.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `record_${record.type}_${title || "care"}_${suffix}`;
}

function sortGoals(goals = []) {
  const statusOrder = { active: 0, paused: 1, done: 2 };
  return [...goals].sort((a, b) => {
    const leftStatus = statusOrder[a.status] ?? 9;
    const rightStatus = statusOrder[b.status] ?? 9;
    if (leftStatus !== rightStatus) return leftStatus - rightStatus;
    return a.title.localeCompare(b.title);
  });
}

function sortRoutines(routines = []) {
  return [...routines].sort((a, b) => {
    const left = routineSortMinutes(a.time);
    const right = routineSortMinutes(b.time);
    if (left !== right) return left - right;
    return a.label.localeCompare(b.label);
  });
}

function routineSortMinutes(value) {
  const text = cleanText(value);
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3].toUpperCase();
  if (hour === 12) hour = 0;
  if (meridiem === "PM") hour += 12;
  return hour * 60 + minute;
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

function getDayCounts(entries) {
  return {
    meals: countType(entries, "meal"),
    treats: countType(entries, "treat"),
    walks: countType(entries, "walk"),
    walkMinutes: sumNumber(entries, "walk", "durationMinutes"),
    parkVisits: countType(entries, "park"),
    training: countType(entries, "training"),
    trainingMinutes: sumNumber(entries, "training", "durationMinutes"),
    social: countType(entries, "social"),
    dogInteractions: sumAll(entries, "dogInteractions"),
    vomit: countType(entries, "vomit"),
    health: countType(entries, "health"),
    vet: countType(entries, "vet"),
    weight: countType(entries, "weight"),
    medication: countType(entries, "medication"),
    followUps: entries.filter((entry) => entry.requiresFollowUp).length
  };
}

function buildDaySummary(counts) {
  const parts = [];
  if (counts.meals) parts.push(`${counts.meals} meal${counts.meals === 1 ? "" : "s"}`);
  if (counts.walks) parts.push(`${counts.walks} walk${counts.walks === 1 ? "" : "s"}`);
  if (counts.training) parts.push(`${counts.training} training`);
  if (counts.parkVisits || counts.social) parts.push(`${counts.parkVisits + counts.social} social`);
  if (counts.vomit) parts.push(`${counts.vomit} vomit`);
  if (counts.weight) parts.push(`${counts.weight} weight`);
  if (counts.medication) parts.push(`${counts.medication} medication`);
  if (counts.health || counts.vet) parts.push(`${counts.health + counts.vet} health`);
  return parts.length ? parts.join(" | ") : "No logs";
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

function entriesForCalendarMonth(entries, year, month) {
  return entries.filter((entry) => {
    const occurred = new Date(entry.occurredAt);
    return occurred.getFullYear() === year && occurred.getMonth() === month;
  });
}

function entriesForCurrentMonth(entries, now) {
  const date = new Date(now);
  return entries.filter((entry) => {
    const occurred = new Date(entry.occurredAt);
    return occurred.getFullYear() === date.getFullYear() && occurred.getMonth() === date.getMonth();
  });
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function entriesWithinDays(entries, now, days) {
  const end = new Date(now);
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return entries.filter((entry) => {
    const occurred = new Date(entry.occurredAt);
    return occurred >= start && occurred <= end;
  });
}

function latestWeightEntry(entries) {
  const weighted = entries
    .filter((entry) => entry.type === "weight")
    .map((entry) => ({ entry, weight: parseWeight(entry.amount || entry.note || entry.title) }))
    .filter((item) => item.weight !== null)
    .sort((a, b) => new Date(b.entry.occurredAt) - new Date(a.entry.occurredAt));
  return weighted[0] || null;
}

function isFoodEntry(entry) {
  return entry.type === "meal" || entry.type === "treat";
}

function isBedtimeSnackEntry(entry) {
  if (!isFoodEntry(entry)) return false;
  const text = `${entry.title || ""} ${entry.note || ""}`.toLowerCase();
  const hour = new Date(entry.occurredAt).getHours();
  const overnight = hour >= 20 || hour <= 2;
  return overnight && (entry.type === "treat" || /bedtime|snack|treat/.test(text));
}

function hasYellowBileSignal(entry) {
  return /yellow|bile/i.test(`${entry.title || ""} ${entry.note || ""} ${entry.mood || ""}`);
}

function hasAppetiteDisruption(entry) {
  return /refus|skip|would not|did not|not eat|wouldn't/i.test(`${entry.title || ""} ${entry.mood || ""} ${entry.note || ""}`);
}

function roundHours(value) {
  return Math.round(value * 10) / 10;
}

function parseWeight(value) {
  const match = cleanText(value).match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
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
