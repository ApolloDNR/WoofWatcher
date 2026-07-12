export interface PaymentsProviderProofItem {
  label: string;
  requiredEvidence: string;
}

export type PaymentsProviderProofStatus = "ready" | "blocked";

export interface PaymentsProviderProofManifestInput {
  productCatalogApproved?: boolean;
  billingPathApproved?: boolean;
  sandboxReceiptsApproved?: boolean;
  entitlementMappingApproved?: boolean;
  refundSupportApproved?: boolean;
  checkoutGateApproved?: boolean;
  sandboxReceiptEvidence?: readonly PaymentsSandboxReceiptEvidence[];
}

export type PaymentsSandboxReceiptPlatform = "ios" | "android";

export type PaymentsSandboxReceiptStore = "app-store" | "google-play";

export interface PaymentsSandboxReceiptEvidence {
  platform: PaymentsSandboxReceiptPlatform;
  store: PaymentsSandboxReceiptStore;
  fileName?: string | null;
  uri?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  productId?: string | null;
  transactionId?: string | null;
  includesPurchase?: boolean | null;
  includesRenewal?: boolean | null;
  includesCancellation?: boolean | null;
  includesRefund?: boolean | null;
  includesExpiration?: boolean | null;
  restorePurchaseConfirmed?: boolean | null;
}

export interface PaymentsProviderProofManifestRow {
  label: string;
  value: string;
  detail: string;
  status: PaymentsProviderProofStatus;
}

export interface PaymentsProviderProofManifest {
  status: PaymentsProviderProofStatus;
  rows: PaymentsProviderProofManifestRow[];
  blockers: string[];
}

export const PAYMENTS_PROVIDER_PROOF_ITEMS: readonly PaymentsProviderProofItem[] = [
  {
    label: "Product catalog",
    requiredEvidence:
      "Plus and Family product ids, public price, currency, trial or intro offer decision, and exact paid-tier packaging approved by Apollo.",
  },
  {
    label: "Billing path decision",
    requiredEvidence:
      "Approved App Store, Google Play, and Stripe or web checkout decision, including which platforms may show checkout and which must defer to store billing.",
  },
  {
    label: "Sandbox receipt test",
    requiredEvidence:
      "Sandbox purchase, renewal, cancel, refund, and expired receipt proof for iOS App Store and Android Google Play, with platform/store naming, JSON MIME, byte size, product id, transaction id, restore proof, and no local-preview purchase state counted as paid.",
  },
  {
    label: "Entitlement mapping",
    requiredEvidence:
      "Plus and Family feature gates, receipt-to-entitlement mapping, restore purchases behavior for iOS App Store and Android Google Play, cancellation/expiration downgrade, and household role access rules.",
  },
  {
    label: "Refund and support policy",
    requiredEvidence:
      "Public refund, support, tax, and subscription terms copy approved for Premium, Privacy, store listing, and support handoff surfaces.",
  },
  {
    label: "Checkout gate and restore behavior",
    requiredEvidence:
      "checkout stays disabled until product ids, billing path, iOS App Store and Android Google Play sandbox receipts, restore purchases, refund/support copy, and Apollo approval are attached.",
  },
];

export const PAYMENTS_PROVIDER_PROOF_SUMMARY =
  "WoofWatcher Plus payments proof packet: Plus and Family product ids, billing path decision, sandbox receipt test, entitlement mapping, refund and support policy, and checkout gate proof before paid checkout can be enabled.";

function row(
  label: string,
  ready: boolean,
  readyValue: string,
  blockedValue: string,
  detail: string,
): PaymentsProviderProofManifestRow {
  return {
    label,
    value: ready ? readyValue : blockedValue,
    detail,
    status: ready ? "ready" : "blocked",
  };
}

interface SandboxReceiptRequirement {
  platform: PaymentsSandboxReceiptPlatform;
  store: PaymentsSandboxReceiptStore;
  receiptReadyLabel: string;
  receiptPendingLabel: string;
  restoreReadyLabel: string;
  restorePendingLabel: string;
}

const PAYMENTS_SANDBOX_RECEIPT_REQUIREMENTS: readonly SandboxReceiptRequirement[] = [
  {
    platform: "ios",
    store: "app-store",
    receiptReadyLabel: "iOS App Store sandbox receipt proof ready",
    receiptPendingLabel: "iOS App Store sandbox receipt proof pending",
    restoreReadyLabel: "iOS App Store restore purchase proof ready",
    restorePendingLabel: "iOS App Store restore purchase proof pending",
  },
  {
    platform: "android",
    store: "google-play",
    receiptReadyLabel: "Android Google Play sandbox receipt proof ready",
    receiptPendingLabel: "Android Google Play sandbox receipt proof pending",
    restoreReadyLabel: "Android Google Play restore purchase proof ready",
    restorePendingLabel: "Android Google Play restore purchase proof pending",
  },
];

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: unknown): string {
  return clean(value).toLowerCase();
}

function hasPositiveByteSize(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasJsonMime(value: unknown): boolean {
  const mime = normalize(value);
  return mime === "application/json" || mime.endsWith("+json");
}

function sandboxReceiptEvidenceMatches(
  evidence: PaymentsSandboxReceiptEvidence,
  requirement: SandboxReceiptRequirement,
): boolean {
  const locator = `${normalize(evidence.fileName)} ${normalize(evidence.uri)} ${normalize(evidence.store)}`;
  return (
    evidence.platform === requirement.platform &&
    evidence.store === requirement.store &&
    locator.includes(requirement.platform) &&
    locator.includes(requirement.store) &&
    hasJsonMime(evidence.mimeType) &&
    hasPositiveByteSize(evidence.byteSize) &&
    clean(evidence.productId).length > 0 &&
    clean(evidence.transactionId).length > 0 &&
    evidence.includesPurchase === true &&
    evidence.includesRenewal === true &&
    evidence.includesCancellation === true &&
    evidence.includesRefund === true &&
    evidence.includesExpiration === true
  );
}

function summarizeSandboxReceiptEvidence(evidence: readonly PaymentsSandboxReceiptEvidence[] | undefined) {
  const rows = PAYMENTS_SANDBOX_RECEIPT_REQUIREMENTS.map((requirement) => {
    const matchingEvidence = evidence?.find((item) => sandboxReceiptEvidenceMatches(item, requirement));
    const receiptReady = Boolean(matchingEvidence);
    const restoreReady = matchingEvidence?.restorePurchaseConfirmed === true;
    return {
      requirement,
      receiptReady,
      restoreReady,
      receiptLabel: receiptReady ? requirement.receiptReadyLabel : requirement.receiptPendingLabel,
      restoreLabel: restoreReady ? requirement.restoreReadyLabel : requirement.restorePendingLabel,
    };
  });
  const receiptReadyCount = rows.filter((item) => item.receiptReady).length;
  const restoreReadyCount = rows.filter((item) => item.restoreReady).length;
  return {
    rows,
    receiptsReady: receiptReadyCount === PAYMENTS_SANDBOX_RECEIPT_REQUIREMENTS.length,
    restoreReady: restoreReadyCount === PAYMENTS_SANDBOX_RECEIPT_REQUIREMENTS.length,
    receiptValue: `${receiptReadyCount}/${PAYMENTS_SANDBOX_RECEIPT_REQUIREMENTS.length} sandbox receipt proofs ready`,
    restoreValue: `${restoreReadyCount}/${PAYMENTS_SANDBOX_RECEIPT_REQUIREMENTS.length} restore proofs ready`,
  };
}

export function buildPaymentsProviderProofManifest(
  input: PaymentsProviderProofManifestInput = {},
): PaymentsProviderProofManifest {
  const productCatalogApproved = Boolean(input.productCatalogApproved);
  const billingPathApproved = Boolean(input.billingPathApproved);
  const sandboxReceiptsApproved = Boolean(input.sandboxReceiptsApproved);
  const entitlementMappingApproved = Boolean(input.entitlementMappingApproved);
  const refundSupportApproved = Boolean(input.refundSupportApproved);
  const checkoutGateApproved = Boolean(input.checkoutGateApproved);
  const sandboxReceiptProof = summarizeSandboxReceiptEvidence(input.sandboxReceiptEvidence);
  const rows = [
    row(
      "Product catalog",
      productCatalogApproved,
      "Products approved",
      "Products pending",
      "Plus and Family product ids, public price, currency, trial or intro offer decision, and paid-tier packaging must be approved by Apollo.",
    ),
    row(
      "Billing path decision",
      billingPathApproved,
      "Billing path approved",
      "Billing path pending",
      "App Store, Google Play, and Stripe or web checkout policy must name which platforms may show checkout and which defer to store billing.",
    ),
    row(
      "Sandbox receipts",
      sandboxReceiptsApproved && sandboxReceiptProof.receiptsReady,
      sandboxReceiptProof.receiptValue,
      sandboxReceiptProof.receiptValue,
      `Sandbox purchase, renewal, cancel, refund, and expired receipt proof is required for iOS App Store and Android Google Play before paid checkout can open; local preview state never counts as paid. ${sandboxReceiptProof.rows.map((item) => item.receiptLabel).join("; ")}.`,
    ),
    row(
      "Entitlements and restore",
      entitlementMappingApproved && sandboxReceiptProof.restoreReady,
      sandboxReceiptProof.restoreValue,
      sandboxReceiptProof.restoreValue,
      `Plus and Family feature gates, receipt-to-entitlement mapping, restore purchases, cancellation/expiration downgrade, and household role access rules must be proven. ${sandboxReceiptProof.rows.map((item) => item.restoreLabel).join("; ")}.`,
    ),
    row(
      "Refund and support policy",
      refundSupportApproved,
      "Policy approved",
      "Policy pending",
      "Refund and support policy, tax/subscription terms, Premium copy, Privacy copy, store listing copy, and support handoff must be approved.",
    ),
    row(
      "Checkout gate",
      checkoutGateApproved && sandboxReceiptProof.receiptsReady && sandboxReceiptProof.restoreReady,
      "Checkout gate approved",
      "Checkout disabled",
      "Checkout stays disabled until product ids, billing path, iOS App Store and Android Google Play sandbox receipts, restore purchases, refund/support copy, and Apollo approval are attached.",
    ),
  ];

  const blockers = rows
    .filter((item) => item.status === "blocked")
    .map((item) => `${item.label}: ${item.detail}`);
  const status = blockers.length === 0 ? "ready" : "blocked";

  return {
    status,
    rows,
    blockers,
  };
}
