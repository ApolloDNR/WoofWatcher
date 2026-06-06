const WINDOW_MS = 60_000;

export interface RateLimitConfig {
  maxPerWindow: number;
  globalMaxPerWindow: number;
}

export function makeRateLimiter({ maxPerWindow, globalMaxPerWindow }: RateLimitConfig) {
  const hits = new Map<string, number[]>();
  let globalHits: number[] = [];

  return function rateLimited(ip: string): boolean {
    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    globalHits = globalHits.filter((t) => t > cutoff);
    const recent = (hits.get(ip) ?? []).filter((t) => t > cutoff);
    if (recent.length >= maxPerWindow || globalHits.length >= globalMaxPerWindow) {
      hits.set(ip, recent);
      return true;
    }
    recent.push(now);
    globalHits.push(now);
    hits.set(ip, recent);
    // Evict fully-expired entries to prevent unbounded map growth.
    if (hits.size > 500) {
      for (const [k, v] of hits) if (v.every((t) => t <= cutoff)) hits.delete(k);
    }
    return false;
  };
}
