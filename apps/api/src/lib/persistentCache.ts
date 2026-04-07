import fs from "fs/promises";
import path from "path";
import { apiConfig } from "./config";
import { logger, serializeError } from "./logger";

const loadedCaches = new Map<string, Record<string, unknown>>();
const pendingWrites = new Map<string, Promise<void>>();

function cacheFile(cacheName: string): string {
  return path.join(apiConfig.cacheDir, `${cacheName}.json`);
}

async function ensureCacheDir() {
  await fs.mkdir(apiConfig.cacheDir, { recursive: true });
}

async function loadCache(cacheName: string): Promise<Record<string, unknown>> {
  const existing = loadedCaches.get(cacheName);
  if (existing) return existing;

  await ensureCacheDir();

  try {
    const raw = await fs.readFile(cacheFile(cacheName), "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    loadedCaches.set(cacheName, parsed);
    return parsed;
  } catch {
    const empty: Record<string, unknown> = {};
    loadedCaches.set(cacheName, empty);
    return empty;
  }
}

async function writeCache(
  cacheName: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const filePath = cacheFile(cacheName);
  const tempPath = `${filePath}.tmp`;
  const snapshot = JSON.stringify(payload, null, 2);

  const previousWrite = pendingWrites.get(cacheName) ?? Promise.resolve();
  const nextWrite = previousWrite
    .catch((error) => {
      logger.warn("persistent_cache_previous_write_failed", {
        cacheName,
        ...serializeError(error),
      });
    })
    .then(async () => {
      await ensureCacheDir();
      await fs.writeFile(tempPath, snapshot, "utf-8");
      await fs.rename(tempPath, filePath);
    });

  pendingWrites.set(cacheName, nextWrite);
  await nextWrite;
}

export async function getPersistentValue<T>(
  cacheName: string,
  key: string,
): Promise<T | null> {
  const cache = await loadCache(cacheName);
  return (cache[key] as T | undefined) ?? null;
}

export async function setPersistentValue<T>(
  cacheName: string,
  key: string,
  value: T,
): Promise<void> {
  const cache = await loadCache(cacheName);
  cache[key] = value as unknown;
  await writeCache(cacheName, cache);
}
