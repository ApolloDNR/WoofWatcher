export interface HouseholdIdentityProviderUser {
  id: string;
  emailAddresses: readonly {
    emailAddress: string;
    verification: { status: string } | null;
  }[];
}

export type FreshVerifiedHouseholdJoinIdentity =
  | {
      state: "verified";
      userId: string;
      verifiedEmails: readonly string[];
    }
  | {
      state: "provider-unavailable";
      userId: string;
    };

/**
 * Loads request-fresh authentication identity. Cached profile email is not an
 * authorization source: only addresses the provider currently marks verified
 * are returned to the join transaction.
 */
export async function loadFreshVerifiedHouseholdJoinIdentity(input: {
  userId: string;
  getUser(
    userId: string,
  ): Promise<HouseholdIdentityProviderUser | null | undefined>;
}): Promise<FreshVerifiedHouseholdJoinIdentity> {
  try {
    const user = await input.getUser(input.userId);
    if (!user || user.id !== input.userId) {
      return { state: "provider-unavailable", userId: input.userId };
    }

    const verifiedEmails = new Map<string, string>();
    for (const address of user.emailAddresses) {
      if (
        address.verification?.status !== "verified" ||
        !address.emailAddress
      ) {
        continue;
      }
      const caseFolded = address.emailAddress.toLowerCase();
      if (!verifiedEmails.has(caseFolded)) {
        verifiedEmails.set(caseFolded, address.emailAddress);
      }
    }

    return {
      state: "verified",
      userId: user.id,
      verifiedEmails: [...verifiedEmails.values()],
    };
  } catch {
    return { state: "provider-unavailable", userId: input.userId };
  }
}
