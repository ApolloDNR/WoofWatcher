const AUTHENTICATED_HOME_WELCOME_DISMISSED_PREFIX =
  "woofwatcher.homeWelcomeDismissed.v2.scope";
const LOCAL_HOME_WELCOME_DISMISSED_KEY = "woofwatcher.homeWelcomeDismissed.v1";

export interface HomeWelcomePreferenceScope {
  ownerUserId: string | null;
  householdId: string | null;
  activePetId: string;
}

export interface HomeWelcomePreferenceStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface HomeWelcomePreference {
  readonly key: string;
  hydrate(): Promise<boolean>;
  dismiss(): Promise<void>;
}

export interface HydratedHomeWelcomeDismissal {
  key: string;
  dismissed: boolean;
}

export function selectHomeWelcomeDismissal(
  preference: Pick<HomeWelcomePreference, "key"> | null,
  hydrated: HydratedHomeWelcomeDismissal | null,
): boolean | null {
  if (!preference || !hydrated || preference.key !== hydrated.key) return null;
  return hydrated.dismissed;
}

const pendingWritesByStorage = new WeakMap<
  HomeWelcomePreferenceStorage,
  Map<string, Promise<void>>
>();

function getPendingWrites(
  storage: HomeWelcomePreferenceStorage,
): Map<string, Promise<void>> {
  const existing = pendingWritesByStorage.get(storage);
  if (existing) return existing;
  const created = new Map<string, Promise<void>>();
  pendingWritesByStorage.set(storage, created);
  return created;
}

function enqueueDismissal(
  storage: HomeWelcomePreferenceStorage,
  key: string,
): Promise<void> {
  const pendingWrites = getPendingWrites(storage);
  const previous = pendingWrites.get(key) ?? Promise.resolve();
  const operation = previous
    .catch(() => undefined)
    .then(() => storage.setItem(key, "true"));
  pendingWrites.set(key, operation);
  void operation.then(
    () => {
      if (pendingWrites.get(key) === operation) pendingWrites.delete(key);
    },
    () => {
      if (pendingWrites.get(key) === operation) pendingWrites.delete(key);
    },
  );
  return operation;
}

function encodeScopeSegment(value: string): string {
  return encodeURIComponent(value).replace(/\./g, "%2E");
}

function resolveStorageKey(
  scope: HomeWelcomePreferenceScope | null,
): string | null {
  if (!scope) return null;
  const ownerUserId = scope.ownerUserId?.trim() || null;
  const householdId = scope.householdId?.trim() || null;
  const activePetId = scope.activePetId?.trim();
  if (!activePetId) return null;
  if (ownerUserId === null && householdId === null) {
    return LOCAL_HOME_WELCOME_DISMISSED_KEY;
  }
  if (!ownerUserId || !householdId) return null;
  return `${AUTHENTICATED_HOME_WELCOME_DISMISSED_PREFIX}.account.${encodeScopeSegment(ownerUserId)}.household.${encodeScopeSegment(householdId)}.pet.${encodeScopeSegment(activePetId)}`;
}

export function createHomeWelcomePreference(
  storage: HomeWelcomePreferenceStorage,
  scope: HomeWelcomePreferenceScope | null,
): HomeWelcomePreference | null {
  const key = resolveStorageKey(scope);
  if (!key) return null;
  return {
    key,
    async hydrate() {
      await getPendingWrites(storage)
        .get(key)
        ?.catch(() => undefined);
      return (await storage.getItem(key)) === "true";
    },
    dismiss: () => enqueueDismissal(storage, key),
  };
}
