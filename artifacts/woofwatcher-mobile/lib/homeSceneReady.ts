export function isHomeSceneReady(
  careLoaded: boolean,
  welcomeDismissed: boolean | null,
  storageWarning: "save-failed" | "read-failed" | "reset" | null = null,
): boolean {
  return (
    welcomeDismissed !== null &&
    (careLoaded || storageWarning === "read-failed")
  );
}
