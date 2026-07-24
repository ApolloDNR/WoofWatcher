type AuthActionOptions = {
  setLoading: (value: boolean) => void;
  setError: (message: string | undefined) => void;
  thrownMessage: string;
  action: () => Promise<string | undefined>;
  onFinally?: () => void;
};

export const SIGN_IN_CREDENTIAL_ERROR =
  "Could not sign in. Check your details and try again.";
export const SIGN_UP_CREDENTIAL_ERROR =
  "Could not start account setup. Check your details and try again.";

/**
 * Intentionally ignores provider detail. Unknown-account and wrong-password
 * responses must be indistinguishable so the sign-in form cannot be used to
 * enumerate registered households.
 */
export function signInCredentialError(_error: unknown): string {
  return SIGN_IN_CREDENTIAL_ERROR;
}

/**
 * Account-exists, invalid-email, and password-policy responses intentionally
 * share one message. Detailed provider copy on this first step would let the
 * public form reveal which household email addresses already exist.
 */
export function signUpCredentialError(_error: unknown): string {
  return SIGN_UP_CREDENTIAL_ERROR;
}

export function ownerSafeProviderError(
  error: unknown,
  fallback: string,
): string {
  if (!error || typeof error !== "object") return fallback;
  const longMessage = (error as { longMessage?: unknown }).longMessage;
  if (typeof longMessage !== "string") return fallback;
  const normalized = longMessage.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, 240) : fallback;
}

export async function executeAuthAction({
  setLoading,
  setError,
  thrownMessage,
  action,
  onFinally,
}: AuthActionOptions): Promise<boolean> {
  setError(undefined);
  setLoading(true);
  try {
    const returnedError = await action();
    if (returnedError) {
      setError(returnedError);
      return false;
    }
    return true;
  } catch {
    setError(thrownMessage);
    return false;
  } finally {
    try {
      setLoading(false);
    } finally {
      onFinally?.();
    }
  }
}
