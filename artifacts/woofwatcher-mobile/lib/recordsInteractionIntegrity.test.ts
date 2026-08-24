import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildCarePass,
  createCarePassArtifact,
  getCarePassArtifactPrintView,
} from "../../../lib/care-domain/src/care-pass.ts";
import { buildCarePassPdfArtifactSource } from "./reportGeneratedBinaryArtifact.ts";

const RECORDS_SCREEN_PATH = join(
  process.cwd(),
  "artifacts",
  "woofwatcher-mobile",
  "components",
  "health",
  "RecordsScreen.tsx",
);

function recordsSource(): string {
  return readFileSync(RECORDS_SCREEN_PATH, "utf8");
}

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source boundary: ${start}`);
  assert.notEqual(endIndex, -1, `missing source boundary: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("Records admits every text and file share through one awaited exclusive gate", () => {
  const records = recordsSource();
  const shareActions = sourceBetween(
    records,
    "const shareReport =",
    "const openRecordsFileProofMission =",
  );

  assert.match(records, /const recordsShareGate = recordsShareGateRef\.current/);
  assert.match(records, /const \[recordsShareBusy, setRecordsShareBusy\] = useState\(false\)/);
  assert.match(
    records,
    /const runRecordsShare = async[\s\S]*await recordsShareGate\.run/,
  );
  for (const action of [
    "shareReport",
    "shareCredential",
    "sharePrintableCredential",
    "shareCredentialImageSource",
    "shareCredentialPngArtifact",
    "shareCarePass",
    "shareReportArtifact",
    "sharePrintableReportArtifact",
    "shareGeneratedCarePassPdfArtifact",
  ]) {
    const actionSource = sourceBetween(
      records,
      `const ${action} =`,
      action === "shareGeneratedCarePassPdfArtifact"
        ? "const openRecordsFileProofMission ="
        : `const ${
            [
              "shareReport",
              "shareCredential",
              "sharePrintableCredential",
              "shareCredentialImageSource",
              "shareCredentialPngArtifact",
              "shareCarePass",
              "shareReportArtifact",
              "sharePrintableReportArtifact",
              "shareGeneratedCarePassPdfArtifact",
            ][
              [
                "shareReport",
                "shareCredential",
                "sharePrintableCredential",
                "shareCredentialImageSource",
                "shareCredentialPngArtifact",
                "shareCarePass",
                "shareReportArtifact",
                "sharePrintableReportArtifact",
                "shareGeneratedCarePassPdfArtifact",
              ].indexOf(action) + 1
            ]
          } =`,
    );
    assert.match(actionSource, /await runRecordsShare|runRecordsShare\(async/);
  }
  assert.doesNotMatch(shareActions, /void shareTextPayload/);
  assert.match(records, /"Preparing share… Keep WoofWatcher open\."/);
});

test("Care Pass Save and share confirms durable persistence before sharing or history success", () => {
  const records = recordsSource();
  const carePassSave = sourceBetween(
    records,
    "const shareCarePass =",
    "const shareReportArtifact =",
  );

  assert.match(carePassSave, /runDurableCarePassSaveShare\(\{/);
  assert.match(carePassSave, /persist: persistCurrentCareSnapshot/);
  assert.match(carePassSave, /rollback:/);
  assert.match(carePassSave, /persistRollback: persistCurrentCareSnapshot/);
  assert.match(carePassSave, /await runRecordsShare/);
  assert.match(records, /pendingCarePassArtifactId/);
  assert.match(records, /carePassSaveShareNotice/);
  assert.match(records, /carePassSaveShareBusy \? "Saving & sharing/);
});

test("Report presets disclose current-data regeneration in visible, accessibility, and share copy", () => {
  const records = recordsSource();
  const history = sourceBetween(
    records,
    "title=\"Saved Report Presets\"",
    "{/* Progress report */}",
  );

  assert.match(history, /not historical snapshots/i);
  assert.match(history, /current household-visible data/i);
  assert.match(history, /current-data preset/i);
  assert.match(history, /accessibilityLabel=\{`Share current/);
  assert.match(records, /REPORT_PRESET_REGENERATION_NOTE/);
  assert.match(
    records,
    /message: `\$\{currentPass\.message\}\\n\\n\$\{REPORT_PRESET_REGENERATION_NOTE\}`[\s\S]{0,220}title: "Report preset disclosure"[\s\S]{0,120}lines: \[REPORT_PRESET_REGENERATION_NOTE\]/,
  );
});

test("the preset disclosure survives text, printable HTML, and generated PDF sources", () => {
  const note =
    "Report preset note: regenerated from current household-visible WoofWatcher data; not a historical snapshot.";
  const currentPass = buildCarePass({
    audience: "vet",
    profile: { name: "Phoenix" },
    entries: [],
    now: new Date("2026-08-23T12:00:00.000Z").getTime(),
  });
  const artifact = createCarePassArtifact({
    ...currentPass,
    message: `${currentPass.message}\n\n${note}`,
    sections: [
      ...currentPass.sections,
      { title: "Report preset disclosure", lines: [note] },
    ],
  });
  const printable = getCarePassArtifactPrintView(artifact);
  const pdf = buildCarePassPdfArtifactSource({
    fileName: printable.fileName,
    title: artifact.title,
    summary: artifact.summary,
    message: artifact.message,
  });

  assert.match(artifact.message, /regenerated from current household-visible/);
  assert.match(printable.html, /Report preset disclosure/);
  assert.match(printable.html, /not a historical snapshot/);
  const pdfText = Buffer.from(pdf.contentBase64, "base64").toString("latin1");
  assert.match(pdfText, /household-visible WoofWatcher data; not a/);
  assert.match(pdfText, /historical snapshot/);
});

test("Records native controls expose explicit role, labels, and selected or disabled state", () => {
  const records = recordsSource();

  for (const label of [
    "Add a document to Record Vault",
    "Clear medication search",
    "Share the current progress report",
    "Edit diet on file",
    "Add first record",
    "Close Care Pass preview",
    "Attach a photo or receipt",
    "Cancel record editor",
  ]) {
    const labelIndex = records.indexOf(`accessibilityLabel="${label}"`);
    assert.notEqual(labelIndex, -1, `missing accessibility label: ${label}`);
    const controlSource = records.slice(Math.max(0, labelIndex - 180), labelIndex + 300);
    assert.match(controlSource, /accessibilityRole="button"/, `${label} role`);
    assert.match(controlSource, /accessibilityState=/, `${label} state`);
  }
  assert.match(
    records,
    /accessibilityLabel=\{`Filter medication history: \$\{option\.label\}`\}[\s\S]{0,180}accessibilityState=\{\{ selected: active \}\}/,
  );
  assert.match(
    records,
    /accessibilityLabel=\{`Show \$\{p\.label\} progress report`\}[\s\S]{0,180}accessibilityState=\{\{ selected: active \}\}/,
  );
  assert.match(
    records,
    /accessibilityLabel=\{`Use \$\{option\.label\} record type`\}[\s\S]{0,220}selected: active[\s\S]{0,80}disabled:/,
  );
  assert.match(
    records,
    /accessibilityLabel=\{recordEditId \? "Save record changes" : "Save new record"\}/,
  );
  assert.match(
    records,
    /accessibilityLabel="Save Care Pass and share current data"[\s\S]{0,180}busy: carePassSaveShareBusy/,
  );
});
