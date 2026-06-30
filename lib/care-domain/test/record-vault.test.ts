import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPetCredential,
  derivePetCredentialReadiness,
  deriveRecordReminders,
  getPetCredentialPrintView,
  getRecordDueStatus,
  summarizeRecordVault,
} from "../src/index.ts";

const records = [
  { id: "rabies", type: "vaccine", title: "Rabies", due: "Due May 2027", note: "Certificate on file" },
  { id: "visit", type: "vet", title: "Wellness Visit", due: "May 2026", note: "Healthy exam" },
  { id: "receipt", type: "receipt", title: "Vet receipt", due: "May 2026", note: "$182 wellness visit" },
  { id: "insurance", type: "insurance", title: "Lemonade", due: "Policy WW-1042", note: "Accident and illness plan" },
  { id: "chip", type: "microchip", title: "HomeAgain", due: "985112003004551", note: "Registered to household" },
];

test("summarizes the record vault into credential-critical sections", () => {
  const vault = summarizeRecordVault(records);

  assert.equal(vault.total, 5);
  assert.equal(vault.sections.find((section) => section.kind === "vaccine")?.count, 1);
  assert.equal(vault.sections.find((section) => section.kind === "receipt")?.status, "On file");
  assert.deepEqual(vault.missingCritical, []);
  assert.equal(vault.priorityRecords[0].title, "Rabies");
});

test("summarizes local attachment readiness for receipt and document records", () => {
  const vault = summarizeRecordVault([
    { id: "receipt_1", type: "receipt", title: "Wellness receipt", note: "$182 exam", attachmentUri: "file://receipt.jpg" },
    { id: "receipt_2", type: "receipt", title: "Food receipt", note: "$74 food order" },
    { id: "doc_1", type: "document", title: "Rabies certificate", attachmentUri: "file://rabies.pdf" },
    { id: "vaccine_1", type: "vaccine", title: "Rabies", due: "May 2027" },
  ]);

  assert.equal(vault.localAttachmentSummary.totalAttachable, 3);
  assert.equal(vault.localAttachmentSummary.withAttachment, 2);
  assert.equal(vault.localAttachmentSummary.missingAttachment, 1);
  assert.deepEqual(vault.localAttachmentSummary.missingAttachmentTitles, ["Food receipt"]);
  assert.equal(vault.sections.find((section) => section.kind === "receipt")?.attachmentCount, 1);
});

test("flags missing credential-critical records", () => {
  const vault = summarizeRecordVault([{ id: "visit", type: "vet", title: "Wellness Visit" }]);

  assert.deepEqual(vault.missingCritical, ["Vaccines", "Insurance", "Microchip"]);
});

test("builds a shareable pet credential from profile and records", () => {
  const credential = buildPetCredential({
    profile: {
      name: "Phoenix",
      breed: "German Shepherd Mix",
      careFocus: "Anxiety-aware feeding and steady weight gain",
      weight: { current: 68, unit: "lb" },
      vetBoundary: "For caregiver and veterinarian review.",
    },
    caregivers: [{ name: "Apollo", role: "Owner" }],
    records,
    generatedAt: "2026-06-06T18:00:00.000Z",
  });

  assert.equal(credential.name, "Phoenix");
  assert.equal(credential.microchip, "HomeAgain - 985112003004551");
  assert.equal(credential.insurance, "Lemonade - Policy WW-1042");
  assert.match(credential.message, /Phoenix Dog ID/);
  assert.match(credential.message, /Rabies/);
  assert.match(credential.message, /Apollo/);
});

test("uses dog profile credential fields when records are not uploaded yet", () => {
  const credential = buildPetCredential({
    profile: {
      name: "Phoenix",
      breed: "German Shepherd Mix",
      microchipNumber: "985112003004551",
      insuranceProvider: "Lemonade",
      insurancePolicy: "WW-1042",
      primaryVet: "Alameda Wellness Vet",
      emergencyContact: "Apollo - 555-0100",
    },
    generatedAt: "2026-06-06T18:00:00.000Z",
  });

  assert.equal(credential.microchip, "985112003004551");
  assert.equal(credential.insurance, "Lemonade - WW-1042");
  assert.equal(credential.primaryVet, "Alameda Wellness Vet");
  assert.equal(credential.emergencyContact, "Apollo - 555-0100");
  assert.match(credential.message, /Primary vet: Alameda Wellness Vet/);
  assert.match(credential.message, /Emergency contact: Apollo - 555-0100/);
});

test("derives Dog ID credential readiness from profile fallbacks and saved records", () => {
  const readiness = derivePetCredentialReadiness({
    profile: {
      name: "Phoenix",
      breed: "German Shepherd Mix",
      weight: { current: 68, unit: "lb" },
      primaryVet: "Alameda Wellness Vet",
      emergencyContact: "Apollo - 555-0100",
      microchipNumber: "985112003004551",
    },
    caregivers: [{ name: "Apollo", role: "Owner" }],
    records: [
      { id: "insurance", type: "insurance", title: "Lemonade", due: "Policy WW-1042" },
      { id: "rabies", type: "vaccine", title: "Rabies", due: "May 2028" },
    ],
  });

  assert.equal(readiness.status, "ready");
  assert.equal(readiness.readyCount, readiness.totalCount);
  assert.deepEqual(readiness.missingLabels, []);
  assert.match(readiness.summary, /ready with 8 of 8/i);
  assert.match(readiness.boundaryLine, /local printable source/i);
});

test("flags missing Dog ID credential fields before sharing", () => {
  const readiness = derivePetCredentialReadiness({
    profile: { name: "Phoenix", breed: "German Shepherd Mix" },
    records: [{ id: "rabies", type: "vaccine", title: "Rabies", due: "May 2028" }],
  });

  assert.equal(readiness.status, "needs_info");
  assert.ok(readiness.readyCount < readiness.totalCount);
  assert.deepEqual(readiness.missingLabels, [
    "Weight",
    "Primary caregiver",
    "Primary vet",
    "Emergency contact",
    "Microchip",
    "Insurance",
  ]);
  assert.match(readiness.summary, /needs 6 credential fields/i);
});

test("renders a print-ready dog ID credential with escaped details", () => {
  const credential = buildPetCredential({
    profile: {
      name: "Phoenix <script>",
      breed: "German Shepherd Mix",
      careFocus: "Anxiety-aware feeding",
      weight: { current: 68, unit: "lb" },
      microchipNumber: "985112003004551",
      insuranceProvider: "Lemonade",
      insurancePolicy: "WW-1042",
      primaryVet: "Alameda Wellness Vet",
      emergencyContact: "Apollo - 555-0100",
      vetBoundary: "For caregiver and veterinarian review.",
    },
    caregivers: [{ name: "Apollo", role: "Owner" }],
    generatedAt: "2026-06-06T18:00:00.000Z",
  });

  const printable = getPetCredentialPrintView(credential);

  assert.equal(printable.fileName, "phoenix-script-dog-id-2026-06-06.html");
  assert.match(printable.html, /^<!doctype html>/i);
  assert.match(printable.html, /@media print/);
  assert.match(printable.html, /Phoenix &lt;script&gt; Dog ID/);
  assert.match(printable.html, /985112003004551/);
  assert.match(printable.html, /Lemonade - WW-1042/);
  assert.match(printable.html, /For caregiver and veterinarian review/);
  assert.doesNotMatch(printable.html, /Phoenix <script>/);
});

test("classifies date-backed records by due status", () => {
  const now = new Date("2026-06-06T12:00:00.000Z").getTime();

  assert.deepEqual(
    getRecordDueStatus({ type: "vaccine", title: "Rabies", due: "May 20, 2026" }, now),
    {
      status: "expired",
      label: "Expired",
      daysUntil: -17,
      date: "May 20, 2026",
    },
  );
  assert.deepEqual(
    getRecordDueStatus({ type: "vaccine", title: "Bordetella", due: "Jul 1, 2026" }, now),
    {
      status: "due_soon",
      label: "Due soon",
      daysUntil: 25,
      date: "Jul 1, 2026",
    },
  );
  assert.equal(
    getRecordDueStatus({ type: "insurance", title: "Lemonade", due: "2027-06-01" }, now).status,
    "current",
  );
});

test("treats non-date record references as reference values", () => {
  const status = getRecordDueStatus({
    type: "microchip",
    title: "HomeAgain",
    due: "985112003004551",
  });

  assert.deepEqual(status, {
    status: "reference",
    label: "Reference",
  });
});

test("derives record reminders for expired, due-soon, and missing critical records", () => {
  const now = new Date("2026-06-06T12:00:00.000Z").getTime();
  const reminders = deriveRecordReminders(
    [
      { id: "rabies", type: "vaccine", title: "Rabies", due: "May 20, 2026", note: "Certificate on file" },
      { id: "insurance", type: "insurance", title: "Insurance renewal", due: "Jul 1, 2026" },
    ],
    { now },
  );

  assert.equal(reminders[0].kind, "expired");
  assert.equal(reminders[0].recordId, "rabies");
  assert.match(reminders[0].detail, /expired/i);
  assert.equal(reminders[1].kind, "due_soon");
  assert.equal(reminders[1].recordId, "insurance");
  assert.match(reminders[1].detail, /25 days/i);
  assert.ok(reminders.some((reminder) => reminder.kind === "missing" && /Microchip/i.test(reminder.label)));
});

test("record reminders ignore reference-only record values", () => {
  const reminders = deriveRecordReminders([
    { id: "chip", type: "microchip", title: "HomeAgain", due: "985112003004551" },
    { id: "insurance", type: "insurance", title: "Lemonade", due: "Policy WW-1042" },
    { id: "rabies", type: "vaccine", title: "Rabies", due: "May 2028" },
  ]);

  assert.ok(reminders.every((reminder) => reminder.kind !== "expired" && reminder.kind !== "due_soon"));
  assert.ok(!reminders.some((reminder) => /Microchip|Insurance/i.test(reminder.label)));
});
