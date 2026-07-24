export interface CareEntriesRef<Entry> {
  current: Entry[];
}

export interface CommitCareEntriesInput<Entry, LifecycleToken> {
  lifecycleToken: LifecycleToken;
  isCurrent: (token: LifecycleToken) => boolean;
  entriesRef: CareEntriesRef<Entry>;
  setEntries: (entries: Entry[]) => void;
  update: (entries: Entry[]) => Entry[];
}

export interface RunCareEntrySideEffectInput<LifecycleToken> {
  lifecycleToken: LifecycleToken;
  isCurrent: (token: LifecycleToken) => boolean;
  run: () => void;
}

export function runCareEntrySideEffectIfCurrent<LifecycleToken>({
  lifecycleToken,
  isCurrent,
  run,
}: RunCareEntrySideEffectInput<LifecycleToken>): boolean {
  if (!isCurrent(lifecycleToken)) return false;
  run();
  return true;
}

export function commitCareEntriesIfCurrent<Entry, LifecycleToken>({
  lifecycleToken,
  isCurrent,
  entriesRef,
  setEntries,
  update,
}: CommitCareEntriesInput<Entry, LifecycleToken>): boolean {
  if (!isCurrent(lifecycleToken)) return false;
  const next = update(entriesRef.current);
  if (!isCurrent(lifecycleToken)) return false;
  entriesRef.current = next;
  setEntries(next);
  return true;
}
