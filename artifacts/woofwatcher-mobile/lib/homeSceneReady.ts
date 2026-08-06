export function isHomeSceneReady(
  careLoaded: boolean,
  welcomeDismissed: boolean | null,
  storageWarning: "save-failed" | "read-failed" | "reset" | "newer-version" | null = null,
): boolean {
  return (
    welcomeDismissed !== null &&
    (careLoaded || storageWarning === "read-failed" || storageWarning === "newer-version")
  );
}
