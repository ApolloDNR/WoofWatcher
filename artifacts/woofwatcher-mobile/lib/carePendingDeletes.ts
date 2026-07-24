import {
  getCarePendingDeleteStorageKey,
  type CareStorageScope,
} from "./careStorageScope.ts";

const MAX_PENDING_DELETE_KEYS = 1_000;
const MAX_PENDING_DELETE_KEY_LENGTH = 128;

export interface CarePendingDeleteStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

export async function commitCarePendingDeleteMutationIfCurrent(
  input: {
    mutate: () => Promise<unknown>;
    isCurrent: () => boolean;
    commit: () => void;
  },
): Promise<boolean> {
  await input.mutate();
  if (!input.isCurrent()) return false;
  input.commit();
  return true;
}

function validateKeys(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("Pending care-entry deletes are invalid.");
  }
  if (value.length > MAX_PENDING_DELETE_KEYS) {
    throw new Error("Pending care-entry delete capacity was exceeded.");
  }
  const result: string[] = [];
  const seen = new Set<string>();
  for (const key of value) {
    if (
      typeof key !== "string" ||
      key.length === 0 ||
      key.length > MAX_PENDING_DELETE_KEY_LENGTH ||
      seen.has(key)
    ) {
      throw new Error("Pending care-entry deletes are invalid.");
    }
    seen.add(key);
    result.push(key);
  }
  return result;
}

export function parseCarePendingDeleteKeys(raw: string | null): string[] {
  if (raw === null) return [];
  if (raw.length === 0) {
    throw new Error("Pending care-entry deletes are invalid.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Pending care-entry deletes are invalid.");
  }
  return validateKeys(parsed);
}

export function createCarePendingDeleteStore(
  storage: CarePendingDeleteStorage,
) {
  const cache = new Map<string, string[]>();
  const tails = new Map<string, Promise<unknown>>();

  const enqueue = <T>(
    storageKey: string,
    operation: () => Promise<T>,
  ): Promise<T> => {
    const tail = tails.get(storageKey) ?? Promise.resolve();
    const queued = tail.then(operation, operation);
    const settled = queued.catch(() => undefined);
    tails.set(storageKey, settled);
    void settled.finally(() => {
      if (tails.get(storageKey) === settled) {
        tails.delete(storageKey);
      }
    });
    return queued;
  };

  const load = async (storageKey: string): Promise<string[]> => {
    const cached = cache.get(storageKey);
    if (cached) return [...cached];
    const parsed = parseCarePendingDeleteKeys(
      await storage.getItem(storageKey),
    );
    cache.set(storageKey, parsed);
    return [...parsed];
  };

  const write = async (
    storageKey: string,
    keys: readonly string[],
  ): Promise<string[]> => {
    const validated = validateKeys(keys);
    await storage.setItem(storageKey, JSON.stringify(validated));
    cache.set(storageKey, validated);
    return [...validated];
  };

  return {
    async waitForWrites(): Promise<void> {
      while (tails.size > 0) {
        await Promise.all(
          [...tails.values()].map((pending) =>
            pending.catch(() => undefined),
          ),
        );
      }
    },
    forget(scope?: CareStorageScope): void {
      if (!scope) {
        cache.clear();
        return;
      }
      cache.delete(getCarePendingDeleteStorageKey(scope));
    },
    read(scope: CareStorageScope): Promise<string[]> {
      const storageKey = getCarePendingDeleteStorageKey(scope);
      return enqueue(storageKey, () => load(storageKey));
    },
    replace(
      scope: CareStorageScope,
      keys: readonly string[],
    ): Promise<string[]> {
      const storageKey = getCarePendingDeleteStorageKey(scope);
      return enqueue(storageKey, () => write(storageKey, keys));
    },
    add(scope: CareStorageScope, key: string): Promise<string[]> {
      const storageKey = getCarePendingDeleteStorageKey(scope);
      return enqueue(storageKey, async () => {
        const current = await load(storageKey);
        if (current.includes(key)) return current;
        if (current.length >= MAX_PENDING_DELETE_KEYS) {
          throw new Error(
            "Pending care-entry delete capacity was exceeded.",
          );
        }
        return write(storageKey, [...current, key]);
      });
    },
    remove(
      scope: CareStorageScope,
      ...keys: string[]
    ): Promise<string[]> {
      const storageKey = getCarePendingDeleteStorageKey(scope);
      return enqueue(storageKey, async () => {
        const current = await load(storageKey);
        const removed = new Set(keys);
        const next = current.filter((key) => !removed.has(key));
        return next.length === current.length
          ? current
          : write(storageKey, next);
      });
    },
  };
}
