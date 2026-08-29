import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPetCredential,
  deriveRecordReminders,
  getPetCredentialImageView,
  getPetCredentialPrintView,
  getRecordDueStatus,
  PET_CREDENTIAL_SVG_BODY_GLYPH_LIMIT,
  PET_CREDENTIAL_SVG_BODY_MAX_VISIBLE_LINES,
  PET_CREDENTIAL_SVG_BOUNDARY_GLYPH_LIMIT,
  PET_CREDENTIAL_SVG_BOUNDARY_MAX_VISIBLE_LINES,
  PET_CREDENTIAL_SVG_TITLE_GLYPH_LIMIT,
  PET_CREDENTIAL_SVG_TITLE_MAX_VISIBLE_LINES,
  summarizeRecordVault,
  wrapPetCredentialSvgText,
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

test("builds Dog ID fields from the newest current records before truncating vaccines", () => {
  const credential = buildPetCredential({
    profile: { name: "Phoenix" },
    records: [
      { id: "insurance-old", type: "insurance", title: "Old insurance", due: "2024-06-01" },
      { id: "chip-old", type: "microchip", title: "Old registry", due: "111111111111111" },
      { id: "vaccine-old", type: "vaccine", title: "Old vaccine", due: "2024-05-20" },
      { id: "insurance-current", type: "insurance", title: "Current insurance", due: "2027-06-01" },
      { id: "chip-current", type: "microchip", title: "Current registry", due: "222222222222222" },
      { id: "vaccine-a", type: "vaccine", title: "Current vaccine A", due: "2027-01-01" },
      { id: "vaccine-b", type: "vaccine", title: "Current vaccine B", due: "2027-02-01" },
      { id: "vaccine-c", type: "vaccine", title: "Current vaccine C", due: "2027-03-01" },
      { id: "vaccine-d", type: "vaccine", title: "Current vaccine D", due: "2027-04-01" },
    ],
    generatedAt: "2026-06-06T18:00:00.000Z",
  });

  assert.match(credential.insurance, /^Current insurance/);
  assert.match(credential.microchip, /^Current registry/);
  assert.match(credential.vaccines, /Current vaccine A/);
  assert.match(credential.vaccines, /Current vaccine B/);
  assert.match(credential.vaccines, /Current vaccine C/);
  assert.match(credential.vaccines, /Current vaccine D/);
  assert.doesNotMatch(credential.vaccines, /Old vaccine/);
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

test("keeps a fresh-install dog ID neutral and grammatical", () => {
  const credential = buildPetCredential({
    profile: { name: "My Dog" },
    generatedAt: "2026-06-06T18:00:00.000Z",
  });
  const printable = getPetCredentialPrintView(credential);
  const image = getPetCredentialImageView(credential);

  assert.equal(credential.name, "your dog");
  assert.match(credential.message, /^Your Dog's ID/);
  assert.match(printable.html, /Your Dog&#39;s ID/);
  assert.match(image.svg, /Your Dog&#39;s ID/);
  assert.equal(printable.fileName, "your-dog-id-2026-06-06.html");
  assert.equal(image.fileName, "your-dog-id-2026-06-06.svg");
  assert.doesNotMatch(
    `${credential.message}\n${printable.fileName}\n${printable.html}\n${image.fileName}\n${image.svg}`,
    /Phoenix|My Dog|your dog Dog ID|your-dog-dog-id/,
  );
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

test("renders a shareable SVG dog ID image source without claiming PDF output", () => {
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

  const image = getPetCredentialImageView(credential);

  assert.equal(image.fileName, "phoenix-script-dog-id-2026-06-06.svg");
  assert.equal(image.mimeType, "image/svg+xml");
  assert.equal(image.formatLabel, "SVG image source");
  assert.match(image.svg, /^<svg /);
  assert.match(image.svg, /Phoenix &lt;script&gt; Dog ID/);
  assert.match(image.svg, /985112003004551/);
  assert.match(image.svg, /Lemonade -/);
  assert.match(image.svg, /WW-1042/);
  assert.match(image.boundary, /generated PNG is available separately/i);
  assert.match(image.boundary, /both stay inside WoofWatcher unless you share them/i);
  assert.match(image.boundary, /cloud backup is not included/i);
  assert.doesNotMatch(image.boundary, /proof|provider storage|unverified/i);
  assert.doesNotMatch(image.boundary, /PNG and PDF export still need/i);
  assert.doesNotMatch(image.svg, /Phoenix <script>/);
});

test("wraps every long SVG credential field and boundary into an expanded visible card", () => {
  const longVet = "Dr. Jose Garcia at Alameda Wellness Veterinary Hospital and Emergency Center";
  const longFocus = "Anxiety-aware feeding and medication timing with overnight handoff notes";
  assert.equal(PET_CREDENTIAL_SVG_BODY_GLYPH_LIMIT, 16);
  assert.equal(PET_CREDENTIAL_SVG_BODY_MAX_VISIBLE_LINES, 8);
  assert.equal(PET_CREDENTIAL_SVG_TITLE_GLYPH_LIMIT, 16);
  assert.equal(PET_CREDENTIAL_SVG_TITLE_MAX_VISIBLE_LINES, 3);
  assert.equal(PET_CREDENTIAL_SVG_BOUNDARY_GLYPH_LIMIT, 45);
  assert.equal(PET_CREDENTIAL_SVG_BOUNDARY_MAX_VISIBLE_LINES, 6);
  assert.equal(
    wrapPetCredentialSvgText(longVet, PET_CREDENTIAL_SVG_BODY_GLYPH_LIMIT).join(" "),
    longVet,
  );
  const wideGlyphs = "W".repeat(65);
  const wideGlyphLines = wrapPetCredentialSvgText(
    wideGlyphs,
    PET_CREDENTIAL_SVG_BODY_GLYPH_LIMIT,
  );
  assert.equal(wideGlyphLines.join(""), wideGlyphs);
  assert.ok(wideGlyphLines.every((line) => line.length <= 16));
  const boundedWideGlyphs = wrapPetCredentialSvgText(
    `START-${"W".repeat(10_000)}-CRITICAL-END`,
    PET_CREDENTIAL_SVG_BODY_GLYPH_LIMIT,
    PET_CREDENTIAL_SVG_BODY_MAX_VISIBLE_LINES,
  );
  assert.equal(boundedWideGlyphs.length, 8);
  assert.match(boundedWideGlyphs[7], /^\.\.\. /);
  assert.match(boundedWideGlyphs[7], /CRITICAL-END$/);

  const credential = buildPetCredential({
    profile: {
      name: "Alexandria's Very Long Emergency Companion Name",
      careFocus: longFocus,
      primaryVet: longVet,
      emergencyContact: "+1 (555) 010-9876 extension 44321",
      insuranceProvider: "Woof Wellness",
      insurancePolicy: "WW-1042-VERY-LONG-TAIL",
    },
    generatedAt: "2026-06-06T18:00:00.000Z",
  });
  const image = getPetCredentialImageView(credential);
  const declaredHeight = Number(/<svg[^>]+height="(\d+)"/.exec(image.svg)?.[1]);

  assert.ok(declaredHeight > 680, "long values should grow the SVG instead of clipping at 680px");
  assert.match(image.svg, /Emergency Center/);
  assert.match(image.svg, /WW-1042-VERY-LON/);
  assert.match(image.svg, /G-TAIL/);
  assert.match(image.svg, /WoofWatcher cloud backup/);
  assert.match(image.svg, /<tspan /);
});

test("bounds SVG identity metadata, file names, and invalid XML controls", () => {
  const hostileName = `A\0B\u0001C\uD800D\uFFFEE\uFFFFF-${"W".repeat(100_000)}-DECISIVE-TAIL`;
  const credential = buildPetCredential({
    profile: {
      name: hostileName,
      breed: hostileName,
      careFocus: hostileName,
      weight: { current: 42, unit: `${"U".repeat(1_000_000)}-TAIL` },
    },
    generatedAt: "2026-06-06T18:00:00.000Z",
  });
  const image = getPetCredentialImageView(credential);
  const ariaLabel = /aria-label="([^"]*)"/.exec(image.svg)?.[1] ?? "";

  assert.ok(image.fileName.length <= 96);
  assert.ok(image.svg.length < 100_000);
  assert.equal(credential.weight, "42 lb");
  assert.ok(credential.message.length < 10_000);
  assert.ok(ariaLabel.length <= 192);
  assert.doesNotMatch(image.svg, /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
  assert.ok(!image.svg.includes("\uD800"));
  assert.ok(!image.svg.includes("\uFFFE"));
  assert.ok(!image.svg.includes("\uFFFF"));
  assert.match(image.svg, /DECISIVE-TAIL/);
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

test("treats historical record dates as recorded facts while renewable credentials can expire", () => {
  const now = new Date("2026-06-06T12:00:00.000Z").getTime();
  const historical = [
    { id: "visit", type: "vet", title: "Wellness visit", due: "2025-01-15" },
    { id: "receipt", type: "receipt", title: "Wellness receipt", due: "2025-01-15" },
    { id: "registration", type: "microchip", title: "Chip registration", due: "2025-01-15" },
    { id: "weigh-in", type: "weight", title: "Clinic weigh-in", due: "2025-01-15" },
    { id: "document", type: "document", title: "Lab document", due: "2025-01-15" },
  ];

  for (const record of historical) {
    const status = getRecordDueStatus(record, now);
    assert.equal(status.status, "reference", `${record.type} dates are not expirations`);
    assert.equal(status.label, "Recorded");
    assert.equal(status.date, "Jan 15, 2025");
  }

  const reminders = deriveRecordReminders(historical, { now });
  assert.ok(historical.every((record) => reminders.every((item) => item.recordId !== record.id)));

  for (const record of [
    { type: "vaccine", title: "Rabies", due: "2025-01-15" },
    { type: "insurance", title: "Policy renewal", due: "2025-01-15" },
    { type: "medication", title: "Prescription refill", due: "2025-01-15" },
  ]) {
    assert.equal(getRecordDueStatus(record, now).status, "expired");
  }
});

test("orders each vault section newest first and reports its newest saved date", () => {
  const vault = summarizeRecordVault([
    { id: "visit-old", type: "vet", title: "Older visit", due: "2024-02-10" },
    { id: "visit-current", type: "vet", title: "Newest visit", due: "2026-02-10" },
  ]);
  const visits = vault.sections.find((section) => section.kind === "vet");

  assert.deepEqual(visits?.records.map((record) => record.id), ["visit-current", "visit-old"]);
  assert.equal(visits?.latest, "2026-02-10");
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

test("quarantines correction-marked due values without dropping the record", () => {
  const now = new Date("2026-02-20T12:00:00.000Z").getTime();
  const corrected = {
    id: "legacy-rabies",
    type: "vaccine",
    title: "Legacy rabies",
    due: "2026-02-31",
    correctionIssues: [
      {
        field: "due",
        rawValue: "2026-02-31",
        message: "Enter a valid record date.",
      },
      {
        field: "future-record-codec",
        rawValue: { version: 3 },
        message: "Owned by a future client.",
      },
    ],
  };

  assert.deepEqual(getRecordDueStatus(corrected, now), {
    status: "reference",
    label: "Reference",
  });
  assert.ok(
    deriveRecordReminders([corrected], { now }).every(
      (reminder) => reminder.recordId !== corrected.id,
    ),
  );

  const vault = summarizeRecordVault([corrected]);
  assert.equal(vault.total, 1, "quarantine must not delete an owner's record");
  assert.equal(vault.priorityRecords[0]?.id, corrected.id);
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
