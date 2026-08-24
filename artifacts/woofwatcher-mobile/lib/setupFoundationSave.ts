export type SetupFoundationSaveResult =
  | { status: "complete" }
  | { status: "care-rejected" }
  | { status: "care-persistence-failed" }
  | { status: "twin-persistence-failed" };

export interface SetupFoundationSaveOptions {
  updateCare(): boolean;
  persistCare(): Promise<boolean>;
  persistTwin?: () => Promise<void>;
}

/**
 * Persists Setup in claim order: care must be durably confirmed before the
 * optional twin save can be described as complete. Partial outcomes remain
 * explicit so the screen never turns an avatar failure into a success sheet.
 */
export async function persistSetupFoundation({
  updateCare,
  persistCare,
  persistTwin,
}: SetupFoundationSaveOptions): Promise<SetupFoundationSaveResult> {
  if (!updateCare()) return { status: "care-rejected" };

  try {
    if (!(await persistCare())) {
      return { status: "care-persistence-failed" };
    }
  } catch {
    return { status: "care-persistence-failed" };
  }

  if (persistTwin) {
    try {
      await persistTwin();
    } catch {
      return { status: "twin-persistence-failed" };
    }
  }

  return { status: "complete" };
}
