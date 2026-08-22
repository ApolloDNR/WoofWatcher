const values = new Map<string, string>();

export default {
  async getItem(key: string): Promise<string | null> {
    return values.get(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    values.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    values.delete(key);
  },
  async getAllKeys(): Promise<string[]> {
    return [...values.keys()];
  },
  async multiRemove(keys: string[]): Promise<void> {
    for (const key of keys) values.delete(key);
  },
};

export function useWoofAuth() {
  return {
    isLoaded: true,
    userId: "renderer-user",
    sessionId: "renderer-session",
  };
}
