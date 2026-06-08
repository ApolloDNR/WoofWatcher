import { test } from "node:test";
import assert from "node:assert/strict";

import { buildPetCredential, summarizeRecordVault } from "../src/index.ts";

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
