export function isHomeSceneReady(
  careLoaded: boolean,
  welcomeDismissed: boolean | null,
): boolean {
  return careLoaded && welcomeDismissed !== null;
}
