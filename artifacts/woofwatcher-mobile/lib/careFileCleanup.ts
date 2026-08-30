export type CareFileCleanupAfterSnapshotResult<T> =
  | { status: "snapshot-not-confirmed" }
  | { status: "cleanup-ran"; cleanup: T };

/**
 * Physical care files must outlive the metadata that references them. This
 * gate makes the ordering explicit: confirm the current care snapshot in the
 * primary device store first, then and only then release superseded files.
 */
export async function runCareFileCleanupAfterDurableSnapshot<T>({
  persistSnapshot,
  cleanup,
}: {
  persistSnapshot(): Promise<boolean>;
  cleanup(): Promise<T>;
}): Promise<CareFileCleanupAfterSnapshotResult<T>> {
  if (!(await persistSnapshot())) {
    return { status: "snapshot-not-confirmed" };
  }
  return { status: "cleanup-ran", cleanup: await cleanup() };
}
