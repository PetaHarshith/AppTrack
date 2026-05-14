/**
 * In-memory cache for the dashboard /stats endpoint.
 *
 * In production on Vercel serverless, each invocation may be a cold function,
 * so cache hits across requests are not guaranteed. We still keep the cache
 * because:
 *   1) It costs ~nothing (a Map).
 *   2) Warm functions reuse it across consecutive requests from the same user.
 *   3) Local dev still benefits from the full TTL.
 *
 * Invalidation calls remain useful — they prevent stale reads during a warm
 * function's life.
 */

export const STATS_CACHE_TTL_MS = 30_000;

type Entry = { expiresAt: number; payload: unknown };

export const statsCache = new Map<number, Entry>();

export const invalidateStatsCache = (userId: number): void => {
    statsCache.delete(userId);
};
