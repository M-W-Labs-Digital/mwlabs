/** Per-process protection. Multi-instance deployments also need an edge rate limit. */
export function createRateLimiter(maximumKeys = 10_000) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  let nextPruneAt = 0;
  return (key: string, limit: number, windowMs: number) => {
    const now = Date.now();
    if (now >= nextPruneAt) {
      for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
      nextPruneAt = now + 60_000;
    }
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      if (!current && buckets.size >= maximumKeys) return false;
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
  };
}
