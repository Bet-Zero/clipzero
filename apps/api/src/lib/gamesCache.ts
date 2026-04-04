import fs from "fs/promises";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), "apps/api/.cache");
const CACHE_FILE = path.join(CACHE_DIR, "games-by-date.json");

type GamesPayload = {
  count: number;
  games: unknown[];
};

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

export async function readGamesCache(): Promise<Record<string, GamesPayload>> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getCachedGames(
  key: string,
): Promise<GamesPayload | null> {
  const cache = await readGamesCache();
  return cache[key] ?? null;
}

export async function setCachedGames(
  key: string,
  payload: GamesPayload,
): Promise<void> {
  await ensureCacheDir();
  const cache = await readGamesCache();
  cache[key] = payload;
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
}
