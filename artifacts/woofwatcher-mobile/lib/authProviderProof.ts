export interface AuthProviderProofItem {
  label: string;
  requiredEvidence: string;
}

export const AUTH_PROVIDER_PROOF_ITEMS: readonly AuthProviderProofItem[] = [
  {
    label: "Clerk production app",
    requiredEvidence:
      "Clerk production app id, publishable key environment, secret storage location, and confirmation that local placeholder keys are not used for release.",
  },
  {
    label: "Redirect and deep-link URLs",
    requiredEvidence:
      "Approved redirect/deep-link URL list covering Expo scheme, iOS and Android bundle identifiers, production web URL, and post-auth return paths.",
  },
  {
    label: "OAuth sign-in test",
    requiredEvidence:
      "native screenshot or screen recording of OAuth sign-in completing on iOS and Android with no local-preview fallback, blank screen, or unapproved provider copy.",
  },
  {
    label: "Session and token policy",
    requiredEvidence:
      "Session lifetime, token refresh, sign-out behavior, revoked-session handling, and secure storage policy approved for the beta and production builds.",
  },
  {
    label: "Household membership policy",
    requiredEvidence:
      "active household resolution, invite acceptance, join/create household permissions, and role enforcement notes proving auth cannot cross household boundaries.",
  },
];

export const AUTH_PROVIDER_PROOF_SUMMARY =
  "Production auth provider proof packet: Clerk production app id, redirect/deep-link URL list, OAuth sign-in test, session policy, and household membership policy before provider-backed account sync or household creation can be claimed.";
