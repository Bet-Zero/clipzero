"use client";

// ---------------------------------------------------------------------------
// TTL constants
// ---------------------------------------------------------------------------

/** Cache TTL for clip-set page responses (offset-based pagination). */
export const CLIP_PAGE_TTL_MS = 20_000;

/**
 * Cache TTL for metadata responses (player game logs, matchup game lists).
 * These change infrequently and are more expensive to re-fetch.
 */
export const METADATA_TTL_MS = 45_000;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface CacheEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Module-level state (singleton)
// ---------------------------------------------------------------------------

/** Successful responses keyed by request URL. */
const responseCache = new Map<string, CacheEntry>();

/** In-flight promises keyed by request URL — used for dedup. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inFlight = new Map<string, Promise<any>>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch JSON from `key` (a URL string) with client-side caching and
 * in-flight request deduplication.
 *
 * - If a valid cached response exists (not expired), it is returned
 *   immediately without calling `fetcher`.
 * - If the same key is already in-flight, the existing promise is returned.
 * - Otherwise `fetcher` is called, its result is cached on success, and the
 *   in-flight entry is always cleared on completion.
 *
 * The `fetcher` is responsible for the actual HTTP call, including any
 * AbortController signal handling. Generation-ID guards in the calling
 * browser components ensure stale cached responses are not applied.
 *
 * @param key    The request URL (used as cache key).
 * @param fetcher  Async function that performs the fetch and returns parsed JSON.
 * @param ttlMs  How long to cache a successful response.
 */
export async function fetchJsonWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
): Promise<T> {
  // Return cached response if still fresh.
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  // Return existing in-flight promise for this key (dedup).
  const existing = inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  // Start a new fetch and register it as in-flight.
  const promise = fetcher().then(
    (value) => {
      // Cache the successful response.
      responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });
      inFlight.delete(key);
      return value;
    },
    (err: unknown) => {
      // On failure (including AbortError), clear in-flight so a fresh
      // attempt can be made later. Do not cache failures.
      inFlight.delete(key);
      throw err;
    },
  );

  inFlight.set(key, promise);
  return promise;
}

/**
 * Evict a specific cache entry by key.
 *
 * Use this when you know a response is stale (e.g., a clip-set has been
 * updated or a context change makes the cached page unreliable).
 */
export function evictCacheKey(key: string): void {
  responseCache.delete(key);
  inFlight.delete(key);
}
