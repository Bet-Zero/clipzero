import {
  getPersistentCacheReadOptions,
  getPersistentCacheStaleReadOptions,
  getPersistentCacheWriteOptions,
} from "./cachePolicy";
import { getPersistentValue, setPersistentValue } from "./persistentCache";

type GamesPayload = {
  count: number;
  games: unknown[];
};

export async function getCachedGames(
  key: string,
): Promise<GamesPayload | null> {
  return getPersistentValue<GamesPayload>(
    "games-by-date",
    key,
    getPersistentCacheReadOptions("games-by-date"),
  );
}

/**
 * Read cached games ignoring the freshness window. Only for the
 * stale-if-error path when upstream cannot be reached.
 */
export async function getStaleCachedGames(
  key: string,
): Promise<GamesPayload | null> {
  return getPersistentValue<GamesPayload>(
    "games-by-date",
    key,
    getPersistentCacheStaleReadOptions("games-by-date"),
  );
}

export async function setCachedGames(
  key: string,
  payload: GamesPayload,
): Promise<void> {
  await setPersistentValue(
    "games-by-date",
    key,
    payload,
    getPersistentCacheWriteOptions("games-by-date"),
  );
}
