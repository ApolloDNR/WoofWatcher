import { test } from "node:test";
import assert from "node:assert/strict";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-11T12:00:00-07:00").getTime();

async function loadReminderCenter() {
  const domain = await import("../src/index.ts") as {
    deriveCareReminderCenter?: (input: {
      routines: readonly unknown[];
      entries: readonly unknown[];
      records?: readonly unknown[];
      caregivers?: readonly unknown[];
      notificationPreferences?: {
        providerConfigured?: boolean;
        pushEnabled?: boolean;
        permissionStatus?: "unknown" | "granted" | "denied" | "unavailable";
        quietHoursStart?: string | null;
        quietHoursEnd?: string | null;
        optOut?: boolean;
      };
      now?: number;
      limit?: number;
      routineLookaheadHours?: number;
    }) => {
      items: Array<{
        id: string;
        kind: string;
        label: string;
        detail: string;
        action: string;
        urgency: string;
        owner: string;
        sourceId?: string;
        daysUntil?: number;
      }>;
      total: number;
      alertCount: number;
      watchCount: number;
      routineCount: number;
      medicationCount: number;
      recordCount: number;
      groomingCount: number;
      status: string;
      summary: string;
      nextStep: string;
      notificationReadiness: string;
      notificationPreferenceSummary: string;
      notificationQuietHours: string;
      notificationOptOut: string;
      providerBackedNotifications: boolean;
    };
  };

  assert.equal(typeof domain.deriveCareReminderCenter, "function", "deriveCareReminderCenter should be exported");
  return domain.deriveCareReminderCenter;
}

test("derives a shared reminder center from routines, medications, records, and grooming due dates", async () => {
  const deriveCareReminderCenter = await loadReminderCenter();

  const center = deriveCareReminderCenter({
    now: NOW,
    limit: 8,
    caregivers: [
      { name: "Apollo", role: "Owner" },
      { name: "Emma", role: "Owner" },
    ],
    routines: [
      { id: "breakfast", label: "Breakfast", type: "meal", time: "7:00 AM", owner: "Apollo", note: "1 cup kibble" },
      { id: "apoquel", label: "Apoquel", type: "medication", time: "8:00 AM", owner: "Emma", note: "1 tablet" },
      { id: "walk", label: "Midday walk", type: "walk", time: "1:00 PM", owner: "Apollo" },
    ],
    entries: [
      {
        id: "private-breakfast",
        type: "meal",
        title: "Breakfast",
        caregiver: "Apollo",
        occurredAt: "2026-06-11T07:05:00-07:00",
        details: { routineId: "breakfast", mealCompletion: "complete", householdVisible: false },
      },
      {
        id: "brush",
        type: "grooming",
        title: "Brush",
        caregiver: "Emma",
        occurredAt: "2026-06-10T18:00:00-07:00",
        durationMinutes: 15,
        details: {
          kind: "brush",
          groomingCondition: "Light shedding",
          groomingProducts: "Slicker brush",
          groomingNextDue: "2026-06-18",
          householdVisible: true,
        },
      },
    ],
    records: [
      { id: "rabies", type: "vaccine", title: "Rabies", due: "Jun 20, 2026" },
      { id: "chip", type: "microchip", title: "HomeAgain", due: "985112003004551" },
      { id: "insurance", type: "insurance", title: "Lemonade", due: "Policy WW-1042" },
    ],
  });

  assert.equal(center.status, "attention");
  assert.equal(center.alertCount, 2);
  assert.ok(center.watchCount >= 2);
  assert.equal(center.routineCount, 2);
  assert.equal(center.medicationCount, 1);
  assert.ok(center.recordCount >= 1);
  assert.equal(center.groomingCount, 1);
  assert.ok(center.items.some((item) => item.kind === "routine" && item.label === "Breakfast overdue"));
  assert.ok(center.items.some((item) => item.kind === "medication" && item.label === "Apoquel missed"));
  assert.ok(center.items.some((item) => item.kind === "record" && item.label === "Rabies due soon"));
  assert.ok(center.items.some((item) => item.kind === "grooming" && item.label === "Grooming due soon"));
  assert.match(center.summary, /reminder/i);
  assert.match(center.nextStep, /overdue|missed/i);
  assert.match(center.notificationReadiness, /push notifications/i);
});

test("clears visible routine reminders only when matching household-visible logs satisfy them", async () => {
  const deriveCareReminderCenter = await loadReminderCenter();

  const privateOnly = deriveCareReminderCenter({
    now: NOW,
    routines: [
      { id: "breakfast", label: "Breakfast", type: "meal", time: "7:00 AM", owner: "Apollo" },
    ],
    entries: [
      {
        id: "private-breakfast",
        type: "meal",
        title: "Breakfast",
        caregiver: "Apollo",
        occurredAt: "2026-06-11T07:05:00-07:00",
        details: { routineId: "breakfast", mealCompletion: "complete", householdVisible: false },
      },
    ],
    records: [
      { id: "rabies", type: "vaccine", title: "Rabies", due: "May 2030" },
      { id: "insurance", type: "insurance", title: "Lemonade", due: "Policy WW-1042" },
      { id: "chip", type: "microchip", title: "HomeAgain", due: "985112003004551" },
    ],
  });
  const visibleLog = deriveCareReminderCenter({
    now: NOW,
    routines: [
      { id: "breakfast", label: "Breakfast", type: "meal", time: "7:00 AM", owner: "Apollo" },
    ],
    entries: [
      {
        id: "shared-breakfast",
        type: "meal",
        title: "Breakfast",
        caregiver: "Apollo",
        occurredAt: "2026-06-11T07:05:00-07:00",
        details: { routineId: "breakfast", mealCompletion: "complete", householdVisible: true },
      },
    ],
    records: [
      { id: "rabies", type: "vaccine", title: "Rabies", due: "May 2030" },
      { id: "insurance", type: "insurance", title: "Lemonade", due: "Policy WW-1042" },
      { id: "chip", type: "microchip", title: "HomeAgain", due: "985112003004551" },
    ],
  });

  assert.equal(privateOnly.status, "attention");
  assert.ok(privateOnly.items.some((item) => item.label === "Breakfast overdue"));
  assert.equal(visibleLog.status, "clear");
  assert.equal(visibleLog.total, 0);
  assert.match(visibleLog.nextStep, /push notifications/i);
  assert.match(visibleLog.notificationPreferenceSummary, /Push provider not configured/i);
  assert.match(visibleLog.notificationQuietHours, /Quiet hours not set/i);
  assert.match(visibleLog.notificationOptOut, /Opt-out control/i);
  assert.equal(visibleLog.providerBackedNotifications, false);
});

test("keeps notification permission, quiet hours, and opt-out boundaries explicit", async () => {
  const deriveCareReminderCenter = await loadReminderCenter();

  const providerGated = deriveCareReminderCenter({
    now: NOW,
    routines: [],
    entries: [],
    records: [],
    notificationPreferences: {
      providerConfigured: false,
      pushEnabled: true,
      permissionStatus: "granted",
      quietHoursStart: "9:00 PM",
      quietHoursEnd: "7:00 AM",
      optOut: false,
    },
  });
  const optedOut = deriveCareReminderCenter({
    now: NOW,
    routines: [],
    entries: [],
    records: [],
    notificationPreferences: {
      providerConfigured: true,
      pushEnabled: true,
      permissionStatus: "granted",
      quietHoursStart: "9:00 PM",
      quietHoursEnd: "7:00 AM",
      optOut: true,
    },
  });
  const denied = deriveCareReminderCenter({
    now: NOW,
    routines: [],
    entries: [],
    records: [],
    notificationPreferences: {
      providerConfigured: true,
      pushEnabled: true,
      permissionStatus: "denied",
      quietHoursStart: "9:00 PM",
      quietHoursEnd: "7:00 AM",
      optOut: false,
    },
  });
  const deliveryQaReady = deriveCareReminderCenter({
    now: NOW,
    routines: [],
    entries: [],
    records: [],
    notificationPreferences: {
      providerConfigured: true,
      pushEnabled: true,
      permissionStatus: "granted",
      quietHoursStart: "9:00 PM",
      quietHoursEnd: "7:00 AM",
      optOut: false,
    },
  });

  assert.match(providerGated.notificationPreferenceSummary, /Push provider not configured/i);
  assert.equal(providerGated.providerBackedNotifications, false);
  assert.match(optedOut.notificationPreferenceSummary, /Notifications are off by your choice/i);
  assert.match(optedOut.notificationOptOut, /Opted out/i);
  assert.equal(optedOut.providerBackedNotifications, false);
  assert.match(denied.notificationPreferenceSummary, /Device permission is denied/i);
  assert.equal(denied.providerBackedNotifications, false);
  assert.match(deliveryQaReady.notificationPreferenceSummary, /eligible for delivery QA/i);
  assert.match(deliveryQaReady.notificationQuietHours, /Quiet hours 9:00 PM-7:00 AM/i);
  assert.match(deliveryQaReady.notificationOptOut, /Opt-out remains available/i);
  assert.equal(deliveryQaReady.providerBackedNotifications, true);
});

test("sorts alerts before watch items and respects the display limit", async () => {
  const deriveCareReminderCenter = await loadReminderCenter();

  const center = deriveCareReminderCenter({
    now: NOW,
    limit: 3,
    routines: [
      { id: "breakfast", label: "Breakfast", type: "meal", time: "7:00 AM", owner: "Apollo" },
      { id: "dinner", label: "Dinner", type: "meal", time: "6:00 PM", owner: "Emma" },
      { id: "walk", label: "Midday walk", type: "walk", time: "1:00 PM", owner: "Apollo" },
    ],
    entries: [
      {
        id: "grooming",
        type: "grooming",
        title: "Bath",
        caregiver: "Emma",
        occurredAt: "2026-06-08T10:00:00-07:00",
        details: { kind: "bath", groomingNextDue: "2026-06-15", householdVisible: true },
      },
    ],
    records: [
      { id: "rabies", type: "vaccine", title: "Rabies", due: "Jun 12, 2026" },
    ],
  });

  assert.equal(center.items.length, 3);
  assert.equal(center.items[0].urgency, "alert");
  assert.ok(center.items.slice(1).every((item) => item.urgency !== "alert" || center.items[0].urgency === "alert"));
  assert.equal(center.total > center.items.length, true);
  assert.equal(center.items[0].label, "Breakfast overdue");
});
