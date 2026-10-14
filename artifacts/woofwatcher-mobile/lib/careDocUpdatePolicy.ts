export interface CareDocUpdateOptions {
  blockedMessage?: string;
  /**
   * Accept a deliberate unchanged document without advancing its revision or
   * sending a provider write. This is for callbacks that revalidate current
   * state inside the write boundary.
   */
  skipUnchangedWrite?: boolean;
}

export function shouldSkipCareDocWrite<T>(
  previous: T,
  next: T,
  options?: CareDocUpdateOptions,
): boolean {
  return options?.skipUnchangedWrite === true && Object.is(previous, next);
}
