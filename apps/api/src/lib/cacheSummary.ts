import {
  getPersistentCacheReadOptions,
  PERSISTENT_CACHE_POLICY,
} from "./cachePolicy";
import { listPersistentEntries } from "./persistentCache";

export interface CacheSummaryItem {
  cacheName: string;
  totalEntries: number;
  validEntries: number;
  legacyEntries: number;
  expiredEntries: number;
}

export interface CacheSummary {
  generatedAt: string;
  totalEntries: number;
  validEntries: number;
  legacyEntries: number;
  expiredEntries: number;
  caches: CacheSummaryItem[];
}

export async function buildPersistentCacheSummary(): Promise<CacheSummary> {
  const cacheNames = Object.keys(PERSISTENT_CACHE_POLICY).sort();
  const caches = await Promise.all(
    cacheNames.map(async (cacheName) => {
      const entries = await listPersistentEntries(
        cacheName,
        getPersistentCacheReadOptions(cacheName),
      );

      const legacyEntries = entries.filter(
        (entry) => !entry.isVersioned,
      ).length;
      const expiredEntries = entries.filter(
        (entry) => entry.isVersioned && entry.isExpired,
      ).length;
      const totalEntries = entries.length;
      const validEntries = totalEntries - legacyEntries - expiredEntries;

      return {
        cacheName,
        totalEntries,
        validEntries,
        legacyEntries,
        expiredEntries,
      } satisfies CacheSummaryItem;
    }),
  );

  return {
    generatedAt: new Date().toISOString(),
    totalEntries: caches.reduce((sum, cache) => sum + cache.totalEntries, 0),
    validEntries: caches.reduce((sum, cache) => sum + cache.validEntries, 0),
    legacyEntries: caches.reduce((sum, cache) => sum + cache.legacyEntries, 0),
    expiredEntries: caches.reduce(
      (sum, cache) => sum + cache.expiredEntries,
      0,
    ),
    caches,
  };
}
