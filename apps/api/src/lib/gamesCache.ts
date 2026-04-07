import {
  getPersistentValue,
  setPersistentValue,
} from "./persistentCache";

type GamesPayload = {
  count: number;
  games: unknown[];
};

export async function getCachedGames(
  key: string,
): Promise<GamesPayload | null> {
  return getPersistentValue<GamesPayload>("games-by-date", key);
}

export async function setCachedGames(
  key: string,
  payload: GamesPayload,
): Promise<void> {
  await setPersistentValue("games-by-date", key, payload);
}
