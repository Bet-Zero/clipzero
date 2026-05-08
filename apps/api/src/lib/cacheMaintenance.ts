import {
  getPersistentCacheReadOptions,
  PERSISTENT_CACHE_POLICY,
} from "./cachePolicy";
import {
  deletePersistentValue,
  listPersistentEntries,
} from "./persistentCache";

export interface CacheSweepResult {
  cacheName: string;
  scannedEntries: number;
  removedEntries: number;
  removedLegacyEntries: number;
  removedExpiredEntries: number;
  removedKeys: string[];
}

export async function sweepPersistentCache(
  cacheName: string,
): Promise<CacheSweepResult> {
  const entries = await listPersistentEntries(
    cacheName,
    getPersistentCacheReadOptions(cacheName),
  );

  const legacyEntries = entries.filter((entry) => !entry.isVersioned);
  const expiredEntries = entries.filter(
    (entry) => entry.isVersioned && entry.isExpired,
  );
  const keysToRemove = [...legacyEntries, ...expiredEntries].map(
    (entry) => entry.key,
  );

  for (const key of keysToRemove) {
    await deletePersistentValue(cacheName, key);
  }

  return {
    cacheName,
    scannedEntries: entries.length,
    removedEntries: keysToRemove.length,
    removedLegacyEntries: legacyEntries.length,
    removedExpiredEntries: expiredEntries.length,
    removedKeys: keysToRemove,
  };
}

export async function sweepAllPersistentCaches(): Promise<CacheSweepResult[]> {
  const cacheNames = Object.keys(PERSISTENT_CACHE_POLICY).sort();
  const results: CacheSweepResult[] = [];

  for (const cacheName of cacheNames) {
    results.push(await sweepPersistentCache(cacheName));
  }

  return results;
}
