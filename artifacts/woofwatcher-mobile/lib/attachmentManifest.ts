export type AttachmentManifestKind =
  | "care-log-proof"
  | "record-document"
  | "adventure-memory"
  | "report-artifact"
  | "qa-screenshot";

export type AttachmentStorageState = "local-only" | "upload-ready" | "provider-saved";
export type AttachmentManifestStatus = "empty" | "provider-required" | "upload-ready" | "synced";

export interface AttachmentManifestInput {
  entries?: readonly unknown[] | null;
  records?: readonly unknown[] | null;
  adventureMemories?: readonly unknown[] | null;
  reportArtifacts?: readonly unknown[] | null;
  qaScreenshotEvidence?: readonly unknown[] | null;
}

export interface AttachmentManifestOptions {
  storageProviderConfigured?: boolean;
  storageProviderEvidence?: AttachmentStorageProviderEvidence | null;
}

export interface AttachmentStorageProviderEvidence {
  fileName?: string | null;
  uri?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  bucketNames?: readonly string[] | null;
  signedUploadPolicy?: string | null;
  signedDownloadPolicy?: string | null;
  householdScopePolicy?: string | null;
  retentionPolicy?: string | null;
  exportPolicy?: string | null;
  deletionPolicy?: string | null;
  qaEvidenceStoragePolicy?: string | null;
  apolloApprovalOwner?: string | null;
  signedAccessApproved?: boolean | null;
  householdScopeApproved?: boolean | null;
  retentionExportDeletionApproved?: boolean | null;
  qaEvidenceStorageApproved?: boolean | null;
  apolloApproved?: boolean | null;
}

export interface AttachmentManifestItem {
  id: string;
  kind: AttachmentManifestKind;
  sourceId: string;
  label: string;
  fileName: string;
  uri: string | null;
  storageState: AttachmentStorageState;
}

export interface AttachmentLaunchQueue {
  total: number;
  localOnly: number;
  uploadReady: number;
  providerSaved: number;
  labels: string[];
  detail: string;
}

export interface AttachmentManifest {
  total: number;
  localOnly: number;
  uploadReady: number;
  providerSaved: number;
  status: AttachmentManifestStatus;
  countsByKind: Partial<Record<AttachmentManifestKind, number>>;
  items: AttachmentManifestItem[];
  launchQueue: AttachmentLaunchQueue;
}

export interface AttachmentReviewRow {
  kind: AttachmentManifestKind;
  label: string;
  count: number;
  localOnly: number;
  uploadReady: number;
  providerSaved: number;
  status: AttachmentManifestStatus;
  statusLabel: string;
  detail: string;
  actionLabel: string;
  sampleFileNames: string[];
}

const KIND_LABELS: Record<AttachmentManifestKind, string> = {
  "care-log-proof": "care-log proof",
  "record-document": "record document",
  "adventure-memory": "adventure memory",
  "report-artifact": "report artifact",
  "qa-screenshot": "qa screenshot",
};

const REVIEW_KIND_ORDER: AttachmentManifestKind[] = [
  "care-log-proof",
  "record-document",
  "adventure-memory",
  "report-artifact",
  "qa-screenshot",
];

const REVIEW_LABELS: Record<AttachmentManifestKind, string> = {
  "care-log-proof": "Care proof photos",
  "record-document": "Record documents",
  "adventure-memory": "Adventure memories",
  "report-artifact": "Care Pass reports",
  "qa-screenshot": "QA screenshots",
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function safeArray(value: readonly unknown[] | null | undefined): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function fileLabel(value: number): string {
  return `${value} local ${value === 1 ? "file" : "files"}`;
}

function hasText(value: unknown): boolean {
  return clean(value).length > 0;
}

function normalize(value: unknown): string {
  return clean(value).toLowerCase();
}

function hasProofMime(value: unknown): boolean {
  const mime = normalize(value);
  return mime === "application/json" || mime === "application/pdf" || mime === "text/markdown" || mime === "text/plain";
}

function hasPositiveByteSize(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasEnoughBuckets(value: unknown): boolean {
  return Array.isArray(value) && value.map(clean).filter(Boolean).length >= 3;
}

export function isAttachmentStorageProviderProofReady(options: AttachmentManifestOptions = {}): boolean {
  const evidence = options.storageProviderEvidence;
  if (!options.storageProviderConfigured || !evidence) return false;

  const locator = `${normalize(evidence.fileName)} ${normalize(evidence.uri)}`;
  const namesStorageProof = locator.includes("attachment") && locator.includes("storage") && locator.includes("proof");

  return Boolean(
    namesStorageProof &&
      hasProofMime(evidence.mimeType) &&
      hasPositiveByteSize(evidence.byteSize) &&
      hasEnoughBuckets(evidence.bucketNames) &&
      hasText(evidence.signedUploadPolicy) &&
      hasText(evidence.signedDownloadPolicy) &&
      hasText(evidence.householdScopePolicy) &&
      hasText(evidence.retentionPolicy) &&
      hasText(evidence.exportPolicy) &&
      hasText(evidence.deletionPolicy) &&
      hasText(evidence.qaEvidenceStoragePolicy) &&
      hasText(evidence.apolloApprovalOwner) &&
      evidence.signedAccessApproved === true &&
      evidence.householdScopeApproved === true &&
      evidence.retentionExportDeletionApproved === true &&
      evidence.qaEvidenceStorageApproved === true &&
      evidence.apolloApproved === true,
  );
}

function storageStateFor(explicitStatus: string, storageProviderReady: boolean): AttachmentStorageState {
  const normalized = explicitStatus.toLowerCase();
  if (
    normalized === "provider-saved" ||
    normalized === "provider-photo" ||
    normalized === "cloud-saved" ||
    normalized === "remote-saved"
  ) {
    return "provider-saved";
  }

  return storageProviderReady ? "upload-ready" : "local-only";
}

function pushItem(
  items: AttachmentManifestItem[],
  input: {
    kind: AttachmentManifestKind;
    sourceId: string;
    label: string;
    fileName: string;
    uri?: string;
    explicitStatus?: string;
  },
  storageProviderReady: boolean,
): void {
  const sourceId = clean(input.sourceId);
  const label = clean(input.label);
  const fileName = clean(input.fileName);
  const uri = clean(input.uri);

  if (!sourceId || (!uri && !fileName)) return;

  items.push({
    id: `${input.kind}:${sourceId}:${fileName || uri}`,
    kind: input.kind,
    sourceId,
    label: label || fileName || KIND_LABELS[input.kind],
    fileName: fileName || `${sourceId}-${input.kind}`,
    uri: uri || null,
    storageState: storageStateFor(clean(input.explicitStatus), storageProviderReady),
  });
}

function collectCareLogProofs(
  items: AttachmentManifestItem[],
  entries: readonly unknown[],
  storageProviderReady: boolean,
): void {
  for (const entryValue of entries) {
    const entry = asRecord(entryValue);
    const details = asRecord(entry.details);
    const uri = clean(details.photoProofAttachmentUri);
    const fileName = clean(details.photoProofAttachmentName);
    if (!uri && !fileName) continue;

    pushItem(
      items,
      {
        kind: "care-log-proof",
        sourceId: clean(entry.id) || clean(entry.occurredAt),
        label: clean(entry.title) || clean(entry.type) || "Care proof",
        fileName: fileName || "care-proof-photo",
        uri,
        explicitStatus: clean(details.photoProofStorageStatus),
      },
      storageProviderReady,
    );
  }
}

function collectRecordDocuments(
  items: AttachmentManifestItem[],
  records: readonly unknown[],
  storageProviderReady: boolean,
): void {
  for (const recordValue of records) {
    const record = asRecord(recordValue);
    const uri = clean(record.attachmentUri);
    const fileName = clean(record.attachmentName);
    if (!uri && !fileName) continue;

    pushItem(
      items,
      {
        kind: "record-document",
        sourceId: clean(record.id) || clean(record.title),
        label: clean(record.title) || "Record attachment",
        fileName: fileName || clean(record.title) || "record-attachment",
        uri,
        explicitStatus: clean(record.attachmentStorageStatus),
      },
      storageProviderReady,
    );
  }
}

function collectAdventureMemories(
  items: AttachmentManifestItem[],
  memories: readonly unknown[],
  storageProviderReady: boolean,
): void {
  for (const memoryValue of memories) {
    const memory = asRecord(memoryValue);
    const uri = clean(memory.photoUri);
    const mediaStatus = clean(memory.mediaStatus);
    if (!uri && mediaStatus !== "local-photo" && mediaStatus !== "provider-photo") continue;

    pushItem(
      items,
      {
        kind: "adventure-memory",
        sourceId: clean(memory.id) || clean(memory.title),
        label: clean(memory.title) || "Adventure memory",
        fileName: clean(memory.photoName) || clean(memory.title) || "adventure-memory-photo",
        uri,
        explicitStatus: mediaStatus || clean(memory.storageStatus),
      },
      storageProviderReady,
    );
  }
}

function collectReportArtifacts(
  items: AttachmentManifestItem[],
  artifacts: readonly unknown[],
  storageProviderReady: boolean,
): void {
  for (const artifactValue of artifacts) {
    const artifact = asRecord(artifactValue);
    const printFileName = clean(artifact.printFileName);
    const printHtml = clean(artifact.printHtml);
    if (!printFileName && !printHtml) continue;

    pushItem(
      items,
      {
        kind: "report-artifact",
        sourceId: clean(artifact.id) || clean(artifact.title),
        label: clean(artifact.title) || "Care Pass report",
        fileName: printFileName || `${clean(artifact.title) || "care-pass-report"}.html`,
        explicitStatus: clean(artifact.storageStatus),
      },
      storageProviderReady,
    );
  }
}

function collectQaScreenshots(
  items: AttachmentManifestItem[],
  evidence: readonly unknown[],
  storageProviderReady: boolean,
): void {
  for (const evidenceValue of evidence) {
    const item = asRecord(evidenceValue);
    const uri = clean(item.uri);
    const fileName = clean(item.fileName);
    if (!uri && !fileName) continue;

    pushItem(
      items,
      {
        kind: "qa-screenshot",
        sourceId: `${clean(item.targetPlatform) || "unknown"}-${clean(item.capturedAtIso) || fileName || uri}`,
        label: fileName || "QA screenshot",
        fileName: fileName || "qa-screenshot.png",
        uri,
        explicitStatus: clean(item.storageStatus),
      },
      storageProviderReady,
    );
  }
}

function countByKind(items: readonly AttachmentManifestItem[]): Partial<Record<AttachmentManifestKind, number>> {
  return items.reduce<Partial<Record<AttachmentManifestKind, number>>>((counts, item) => {
    counts[item.kind] = (counts[item.kind] ?? 0) + 1;
    return counts;
  }, {});
}

function firstSeenLabels(items: readonly AttachmentManifestItem[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];

  for (const item of items) {
    const label = KIND_LABELS[item.kind];
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }

  return labels;
}

function manifestStatus(total: number, localOnly: number, uploadReady: number): AttachmentManifestStatus {
  if (total === 0) return "empty";
  if (localOnly > 0) return "provider-required";
  if (uploadReady > 0) return "upload-ready";
  return "synced";
}

function queueDetail(total: number, labels: readonly string[]): string {
  if (total === 0) return "No proof photos, record uploads, memories, reports, or QA screenshots are waiting for storage.";
  return `${fileLabel(total)} across ${labels.join(", ")}. Keep them local until storage, signed access, retention, export, and deletion rules are approved.`;
}

function reviewStatusLabel(status: AttachmentManifestStatus): string {
  if (status === "provider-required") return "Waiting for storage rules";
  if (status === "upload-ready") return "Ready for provider upload";
  if (status === "synced") return "Provider saved";
  return "No files waiting";
}

function reviewActionLabel(status: AttachmentManifestStatus): string {
  if (status === "provider-required") return "Keep local";
  if (status === "upload-ready") return "Verify migration";
  if (status === "synced") return "Audit export";
  return "No action";
}

function reviewDetail(kind: AttachmentManifestKind, count: number, status: AttachmentManifestStatus): string {
  const label = KIND_LABELS[kind];
  const files = plural(count, "file");

  if (status === "upload-ready") {
    return `${files} of ${label} are ready to migrate into provider storage. Verify object ids, signed access, retention, export, and deletion receipts before release.`;
  }

  if (status === "synced") {
    return `${files} of ${label} are saved with the provider. Keep them included in owner export and deletion audit trails.`;
  }

  return `${files} of ${label} stay local until storage, signed access, retention, export, and deletion rules are approved.`;
}

function plural(value: number, singular: string, pluralLabel = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : pluralLabel}`;
}

export function deriveAttachmentManifest(
  input: AttachmentManifestInput,
  options: AttachmentManifestOptions = {},
): AttachmentManifest {
  const storageProviderReady = isAttachmentStorageProviderProofReady(options);
  const items: AttachmentManifestItem[] = [];

  collectCareLogProofs(items, safeArray(input.entries), storageProviderReady);
  collectRecordDocuments(items, safeArray(input.records), storageProviderReady);
  collectAdventureMemories(items, safeArray(input.adventureMemories), storageProviderReady);
  collectReportArtifacts(items, safeArray(input.reportArtifacts), storageProviderReady);
  collectQaScreenshots(items, safeArray(input.qaScreenshotEvidence), storageProviderReady);

  const total = items.length;
  const localOnly = items.filter((item) => item.storageState === "local-only").length;
  const uploadReady = items.filter((item) => item.storageState === "upload-ready").length;
  const providerSaved = items.filter((item) => item.storageState === "provider-saved").length;
  const labels = firstSeenLabels(items);

  return {
    total,
    localOnly,
    uploadReady,
    providerSaved,
    status: manifestStatus(total, localOnly, uploadReady),
    countsByKind: countByKind(items),
    items,
    launchQueue: {
      total,
      localOnly,
      uploadReady,
      providerSaved,
      labels,
      detail: queueDetail(total, labels),
    },
  };
}

export function formatAttachmentManifestSummary(manifest: AttachmentManifest): string {
  if (manifest.total === 0) return "No local files are waiting for storage.";
  if (manifest.status === "provider-required") {
    return `${fileLabel(manifest.localOnly)} waiting for approved storage rules.`;
  }
  if (manifest.status === "upload-ready") {
    return `${fileLabel(manifest.uploadReady)} ready for provider upload.`;
  }
  return `${manifest.providerSaved} ${manifest.providerSaved === 1 ? "file is" : "files are"} stored with the provider.`;
}

export function buildAttachmentReviewRows(manifest: AttachmentManifest): AttachmentReviewRow[] {
  return REVIEW_KIND_ORDER.flatMap((kind) => {
    const items = manifest.items.filter((item) => item.kind === kind);
    if (!items.length) return [];

    const localOnly = items.filter((item) => item.storageState === "local-only").length;
    const uploadReady = items.filter((item) => item.storageState === "upload-ready").length;
    const providerSaved = items.filter((item) => item.storageState === "provider-saved").length;
    const status = manifestStatus(items.length, localOnly, uploadReady);

    return [
      {
        kind,
        label: REVIEW_LABELS[kind],
        count: items.length,
        localOnly,
        uploadReady,
        providerSaved,
        status,
        statusLabel: reviewStatusLabel(status),
        detail: reviewDetail(kind, items.length, status),
        actionLabel: reviewActionLabel(status),
        sampleFileNames: items.slice(0, 3).map((item) => item.fileName),
      },
    ];
  });
}
