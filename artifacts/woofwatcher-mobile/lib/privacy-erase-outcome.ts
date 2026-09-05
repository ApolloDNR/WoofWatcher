export type LocalDataEraseResult = "erased" | "superseded";

export type PrivacyEraseCompletionStage = "done" | "cancelled" | "failed";

export function derivePrivacyEraseStage(
  avatarResult: PromiseSettledResult<LocalDataEraseResult>,
  careResult: PromiseSettledResult<LocalDataEraseResult>,
): PrivacyEraseCompletionStage {
  const results = [avatarResult, careResult];
  if (results.some((result) => result.status === "rejected")) return "failed";
  return results.every(
    (result) => result.status === "fulfilled" && result.value === "erased",
  )
    ? "done"
    : "cancelled";
}
