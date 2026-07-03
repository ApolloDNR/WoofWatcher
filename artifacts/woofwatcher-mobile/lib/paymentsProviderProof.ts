export interface PaymentsProviderProofItem {
  label: string;
  requiredEvidence: string;
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
