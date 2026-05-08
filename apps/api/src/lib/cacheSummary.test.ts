import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadModules(cacheDir: string) {
  process.env.CLIPZERO_CACHE_DIR = cacheDir;
  vi.resetModules();
  const persistentCache = await import("./persistentCache");
  const cacheSummary = await import("./cacheSummary");
  return { persistentCache, cacheSummary };
}

describe("buildPersistentCacheSummary", () => {
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

  it("reports valid, legacy, and expired entries by cache", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    const { persistentCache, cacheSummary } = await loadModules(cacheDir);

    await persistentCache.setPersistentValue("games-by-date", "legacy", {
      count: 1,
      games: [],
    });

    nowSpy.mockReturnValue(1_000);
    await persistentCache.setPersistentValue(
      "games-by-date",
      "stale",
      { count: 2, games: ["a", "b"] },
      { version: 1 },
    );

    nowSpy.mockReturnValue(2_000);
    await persistentCache.setPersistentValue(
      "player-directory",
      "2025-26",
      [
        {
          personId: 1,
          displayName: "Player",
          teamId: 1,
          teamTricode: "ABC",
          position: "G",
        },
      ],
      { version: 1 },
    );

    nowSpy.mockReturnValue(15 * 60 * 60 * 1000);

    const summary = await cacheSummary.buildPersistentCacheSummary();

    expect(summary.totalEntries).toBe(3);
    expect(summary.validEntries).toBe(1);
    expect(summary.legacyEntries).toBe(1);
    expect(summary.expiredEntries).toBe(1);
    expect(summary.caches).toContainEqual(
      expect.objectContaining({
        cacheName: "games-by-date",
        totalEntries: 2,
        legacyEntries: 1,
        expiredEntries: 1,
        validEntries: 0,
      }),
    );
    expect(summary.caches).toContainEqual(
      expect.objectContaining({
        cacheName: "player-directory",
        totalEntries: 1,
        validEntries: 1,
      }),
    );
  });
});
