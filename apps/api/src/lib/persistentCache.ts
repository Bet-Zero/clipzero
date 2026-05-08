import fs from "fs/promises";
import path from "path";
import { apiConfig } from "./config";
import { logger, serializeError } from "./logger";

const PERSISTENT_CACHE_MARKER = "clipzero-persistent-cache";

const loadedCaches = new Map<string, Record<string, unknown>>();
const inFlightLoads = new Map<string, Promise<Record<string, unknown>>>();
const pendingWrites = new Map<string, Promise<void>>();

export type PersistentCacheReadOptions = {
  version?: number;
  maxAgeMs?: number;
};

export type PersistentCacheWriteOptions = {
  version?: number;
};

export type PersistentCacheEntryInfo = {
  key: string;
  isVersioned: boolean;
  version: number | null;
  storedAt: string | null;
  isExpired: boolean;
};

type PersistentCacheEnvelope<T> = {
  __clipzero: {
    marker: string;
    version: number;
    storedAt: string;
  };
  value: T;
};

function cacheFile(cacheName: string): string {
  return path.join(apiConfig.cacheDir, `${cacheName}.json`);
}

async function ensureCacheDir() {
  await fs.mkdir(apiConfig.cacheDir, { recursive: true });
}

async function loadCache(cacheName: string): Promise<Record<string, unknown>> {
  const existing = loadedCaches.get(cacheName);
  if (existing) return existing;

  const inFlight = inFlightLoads.get(cacheName);
  if (inFlight) return inFlight;

  const loadPromise = (async () => {
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
    } finally {
      inFlightLoads.delete(cacheName);
    }
  })();

  inFlightLoads.set(cacheName, loadPromise);
  return loadPromise;
}

async function writeCache(cacheName: string): Promise<void> {
  const previousWrite = pendingWrites.get(cacheName) ?? Promise.resolve();
  const nextWrite = previousWrite
    .catch((error) => {
      logger.warn("persistent_cache_previous_write_failed", {
        cacheName,
        ...serializeError(error),
      });
    })
    .then(async () => {
      const filePath = cacheFile(cacheName);
      const tempPath = `${filePath}.tmp`;
      const snapshot = JSON.stringify(await loadCache(cacheName), null, 2);

      await ensureCacheDir();

      try {
        await fs.writeFile(tempPath, snapshot, "utf-8");
        await fs.rename(tempPath, filePath);
      } catch (error) {
        await fs.rm(tempPath, { force: true }).catch(() => undefined);
        throw error;
      }
    });

  pendingWrites.set(cacheName, nextWrite);
  try {
    await nextWrite;
  } finally {
    if (pendingWrites.get(cacheName) === nextWrite) {
      pendingWrites.delete(cacheName);
    }
  }
}

function isPersistentCacheEnvelope<T>(
  value: unknown,
): value is PersistentCacheEnvelope<T> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const meta = (value as { __clipzero?: unknown }).__clipzero;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return false;
  }

  return (
    (meta as { marker?: unknown }).marker === PERSISTENT_CACHE_MARKER &&
    typeof (meta as { version?: unknown }).version === "number" &&
    typeof (meta as { storedAt?: unknown }).storedAt === "string" &&
    "value" in (value as Record<string, unknown>)
  );
}

function makeEnvelope<T>(
  value: T,
  options?: PersistentCacheWriteOptions,
): T | PersistentCacheEnvelope<T> {
  if (options?.version === undefined) {
    return value;
  }

  return {
    __clipzero: {
      marker: PERSISTENT_CACHE_MARKER,
      version: options.version,
      storedAt: new Date(Date.now()).toISOString(),
    },
    value,
  };
}

function isExpired(storedAt: string, maxAgeMs: number): boolean {
  const storedAtMs = Date.parse(storedAt);
  if (!Number.isFinite(storedAtMs)) return true;
  return Date.now() - storedAtMs > maxAgeMs;
}

function readValueFromEntry<T>(
  entry: unknown,
  options?: PersistentCacheReadOptions,
): T | null {
  if (entry === undefined) return null;

  if (isPersistentCacheEnvelope<T>(entry)) {
    if (
      options?.version !== undefined &&
      entry.__clipzero.version !== options.version
    ) {
      return null;
    }

    if (
      options?.maxAgeMs !== undefined &&
      isExpired(entry.__clipzero.storedAt, options.maxAgeMs)
    ) {
      return null;
    }

    return entry.value;
  }

  if (options?.version !== undefined) {
    return null;
  }

  return entry as T;
}

export async function getPersistentValue<T>(
  cacheName: string,
  key: string,
  options?: PersistentCacheReadOptions,
): Promise<T | null> {
  const cache = await loadCache(cacheName);
  return readValueFromEntry<T>(cache[key], options);
}

export async function setPersistentValue<T>(
  cacheName: string,
  key: string,
  value: T,
  options?: PersistentCacheWriteOptions,
): Promise<void> {
  const cache = await loadCache(cacheName);
  cache[key] = makeEnvelope(value, options) as unknown;
  await writeCache(cacheName);
}

export async function deletePersistentValue(
  cacheName: string,
  key: string,
): Promise<boolean> {
  const cache = await loadCache(cacheName);
  if (!(key in cache)) return false;

  delete cache[key];
  await writeCache(cacheName);
  return true;
}

export async function listPersistentEntries(
  cacheName: string,
  options?: PersistentCacheReadOptions,
): Promise<PersistentCacheEntryInfo[]> {
  const cache = await loadCache(cacheName);

  return Object.entries(cache)
    .map(([key, entry]) => {
      if (isPersistentCacheEnvelope(entry)) {
        return {
          key,
          isVersioned: true,
          version: entry.__clipzero.version,
          storedAt: entry.__clipzero.storedAt,
          isExpired:
            options?.maxAgeMs !== undefined
              ? isExpired(entry.__clipzero.storedAt, options.maxAgeMs)
              : false,
        };
      }

      return {
        key,
        isVersioned: false,
        version: null,
        storedAt: null,
        isExpired: false,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

export async function inspectPersistentValue<T>(
  cacheName: string,
  key: string,
  options?: PersistentCacheReadOptions,
): Promise<{
  value: T | null;
  info: PersistentCacheEntryInfo | null;
}> {
  const cache = await loadCache(cacheName);
  if (!(key in cache)) {
    return { value: null, info: null };
  }

  const entry = cache[key];
  const entries = await listPersistentEntries(cacheName, options);
  const info = entries.find((candidate) => candidate.key === key) ?? null;

  return {
    value: readValueFromEntry<T>(entry, options),
    info,
  };
  await writeCache(cacheName);
}
