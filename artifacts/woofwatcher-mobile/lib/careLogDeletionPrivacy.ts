export interface CareLogDeletionWithoutSharedAuditResult<TResult> {
  mutationResult: TResult;
  sharedAuditEntry: null;
}

/**
 * Runs the delete without accepting either cached entry contents or an audit
 * writer. The current mutation result cannot prove the row's authoritative
 * visibility at deletion time: provider 404 is normalized as success and a
 * creator can delete a row that another device made private. Until the server
 * returns authoritative deleted-row visibility, every client delete must
 * therefore publish no shared audit entry.
 */
export async function runCareLogDeletionWithoutSharedAudit<TResult>(input: {
  deleteEntry: () => Promise<TResult> | TResult;
}): Promise<CareLogDeletionWithoutSharedAuditResult<TResult>> {
  const mutationResult = await input.deleteEntry();
  return { mutationResult, sharedAuditEntry: null };
}
