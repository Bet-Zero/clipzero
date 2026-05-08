import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadModules(cacheDir: string) {
  process.env.CLIPZERO_CACHE_DIR = cacheDir;
  vi.resetModules();
  const persistentCache = await import("./persistentCache");
  const cacheMaintenance = await import("./cacheMaintenance");
  return { persistentCache, cacheMaintenance };
}

describe("cacheMaintenance", () => {
  const originalEnv = { ...process.env };
  let cacheDir: string;

  beforeEach(async () => {
    cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), "clipzero-cache-"));
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    await fs.rm(cacheDir, { recursive: true, force: true });
  });

  it("removes legacy and expired entries while leaving valid entries intact", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    const { persistentCache, cacheMaintenance } = await loadModules(cacheDir);

    await persistentCache.setPersistentValue("games-by-date", "legacy", {
      count: 0,
      games: [],
    });

    nowSpy.mockReturnValue(1_000);
    await persistentCache.setPersistentValue(
      "games-by-date",
      "expired",
      { count: 2, games: ["a", "b"] },
      { version: 1 },
    );

    nowSpy.mockReturnValue(13 * 60 * 60 * 1000);
    await persistentCache.setPersistentValue(
      "games-by-date",
      "valid",
      { count: 1, games: ["fresh"] },
      { version: 1 },
    );

    nowSpy.mockReturnValue(15 * 60 * 60 * 1000);

    const result = await cacheMaintenance.sweepPersistentCache("games-by-date");

    expect(result).toMatchObject({
      cacheName: "games-by-date",
      scannedEntries: 3,
      removedEntries: 2,
      removedLegacyEntries: 1,
      removedExpiredEntries: 1,
    });
    expect(result.removedKeys.sort()).toEqual(["expired", "legacy"]);

    await expect(
      persistentCache.getPersistentValue("games-by-date", "legacy", {
        version: 1,
      }),
    ).resolves.toBeNull();
    await expect(
      persistentCache.getPersistentValue("games-by-date", "expired", {
        version: 1,
      }),
    ).resolves.toBeNull();
    await expect(
      persistentCache.getPersistentValue("games-by-date", "valid", {
        version: 1,
        maxAgeMs: 12 * 60 * 60 * 1000,
      }),
    ).resolves.toEqual({ count: 1, games: ["fresh"] });
  });
});