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
      "Sandbox purchase, renewal, cancel, refund, and expired receipt proof for each enabled billing path, with no local-preview purchase state counted as paid.",
  },
  {
    label: "Entitlement mapping",
    requiredEvidence:
      "Plus and Family feature gates, receipt-to-entitlement mapping, restore purchases behavior, cancellation/expiration downgrade, and household role access rules.",
  },
  {
    label: "Refund and support policy",
    requiredEvidence:
      "Public refund, support, tax, and subscription terms copy approved for Premium, Privacy, store listing, and support handoff surfaces.",
  },
  {
    label: "Checkout gate and restore behavior",
    requiredEvidence:
      "checkout stays disabled until product ids, billing path, sandbox receipts, restore purchases, refund/support copy, and Apollo approval are attached.",
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

export function buildPaymentsProviderProofManifest(
  input: PaymentsProviderProofManifestInput = {},
): PaymentsProviderProofManifest {
  const productCatalogApproved = Boolean(input.productCatalogApproved);
  const billingPathApproved = Boolean(input.billingPathApproved);
  const sandboxReceiptsApproved = Boolean(input.sandboxReceiptsApproved);
  const entitlementMappingApproved = Boolean(input.entitlementMappingApproved);
  const refundSupportApproved = Boolean(input.refundSupportApproved);
  const checkoutGateApproved = Boolean(input.checkoutGateApproved);
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
      sandboxReceiptsApproved,
      "Receipts approved",
      "Receipts pending",
      "Sandbox purchase, renewal, cancel, refund, and expired receipt proof is required for every enabled billing path; local preview state never counts as paid.",
    ),
    row(
      "Entitlements and restore",
      entitlementMappingApproved,
      "Entitlements approved",
      "Entitlements pending",
      "Plus and Family feature gates, receipt-to-entitlement mapping, restore purchases, cancellation/expiration downgrade, and household role access rules must be proven.",
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
      checkoutGateApproved,
      "Checkout gate approved",
      "Checkout disabled",
      "Checkout stays disabled until product ids, billing path, sandbox receipts, restore purchases, refund/support copy, and Apollo approval are attached.",
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
