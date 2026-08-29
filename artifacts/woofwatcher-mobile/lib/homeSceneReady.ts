export function isHomeSceneReady(
  careLoaded: boolean,
  welcomeDismissed: boolean | null,
  storageWarning: "save-failed" | "read-failed" | "reset" | "newer-version" | null = null,
  welcomePreferenceReadFailed = false,
): boolean {
  return (
    (welcomeDismissed !== null || welcomePreferenceReadFailed) &&
    (careLoaded || storageWarning === "read-failed" || storageWarning === "newer-version")
  );
}

export function resolveHomeWelcomeDismissed(
  raw: string | null,
  deferWelcomeForSession: boolean,
): boolean {
  return deferWelcomeForSession || raw === "true";
}

export function applyHomeWelcomePreferenceHydration(
  raw: string | null,
  deferWelcomeForSession: boolean,
  welcomeDismissedRef: { current: boolean | null },
  setWelcomeDismissed: (value: boolean) => void,
): boolean {
  const nextWelcomeDismissed = resolveHomeWelcomeDismissed(
    raw,
    deferWelcomeForSession,
  );
  welcomeDismissedRef.current = nextWelcomeDismissed;
  setWelcomeDismissed(nextWelcomeDismissed);
  return nextWelcomeDismissed;
}

export function shouldDeferHomeWelcomeAfterReadFailure(
  welcomeDismissed: boolean | null,
): boolean {
  return welcomeDismissed !== false;
}
