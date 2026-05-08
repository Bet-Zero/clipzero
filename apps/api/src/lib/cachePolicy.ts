import type {
  PersistentCacheReadOptions,
  PersistentCacheWriteOptions,
} from "./persistentCache";

type CachePolicy = {
  version: number;
  maxAgeMs?: number;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const PERSISTENT_CACHE_POLICY: Record<string, CachePolicy> = {
  "games-by-date": {
    version: 1,
    maxAgeMs: 12 * HOUR_MS,
  },
  "video-assets": {
    version: 1,
    maxAgeMs: 7 * DAY_MS,
  },
  "play-by-play": {
    version: 1,
    maxAgeMs: 30 * DAY_MS,
  },
  "player-directory": {
    version: 1,
    maxAgeMs: DAY_MS,
  },
  "player-game-logs": {
    version: 1,
    maxAgeMs: 12 * HOUR_MS,
  },
  "team-game-logs": {
    version: 1,
    maxAgeMs: 12 * HOUR_MS,
  },
  "player-season-actions": {
    version: 2,
    maxAgeMs: 6 * HOUR_MS,
  },
};

export function getPersistentCacheReadOptions(
  cacheName: string,
): PersistentCacheReadOptions | undefined {
  const policy = PERSISTENT_CACHE_POLICY[cacheName];
  if (!policy) return undefined;
  return {
    version: policy.version,
    maxAgeMs: policy.maxAgeMs,
  };
}

export function getPersistentCacheWriteOptions(
  cacheName: string,
): PersistentCacheWriteOptions | undefined {
  const policy = PERSISTENT_CACHE_POLICY[cacheName];
  if (!policy) return undefined;
  return { version: policy.version };
}
