import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadPersistentCacheModule(cacheDir: string) {
  process.env.CLIPZERO_CACHE_DIR = cacheDir;
  vi.resetModules();
  return import("./persistentCache");
}

describe("persistentCache", () => {
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

  it("persists the latest shared cache state across overlapping writes", async () => {
    const persistentCache = await loadPersistentCacheModule(cacheDir);

    await Promise.all([
      persistentCache.setPersistentValue(
        "video-assets",
        "one",
        { value: 1 },
        { version: 1 },
      ),
      persistentCache.setPersistentValue(
        "video-assets",
        "two",
        { value: 2 },
        { version: 1 },
      ),
    ]);

    expect(
      await persistentCache.getPersistentValue("video-assets", "one", {
        version: 1,
      }),
    ).toEqual({ value: 1 });
    expect(
      await persistentCache.getPersistentValue("video-assets", "two", {
        version: 1,
      }),
    ).toEqual({ value: 2 });

    const raw = JSON.parse(
      await fs.readFile(path.join(cacheDir, "video-assets.json"), "utf-8"),
    ) as Record<string, unknown>;
    expect(raw).toMatchObject({
      one: {
        __clipzero: {
          marker: "clipzero-persistent-cache",
          version: 1,
        },
        value: { value: 1 },
      },
      two: {
        __clipzero: {
          marker: "clipzero-persistent-cache",
          version: 1,
        },
        value: { value: 2 },
      },
    });
  });

  it("removes the temp file when a rename fails", async () => {
    const renameError = new Error("rename failed");
    const renameSpy = vi
      .spyOn(fs, "rename")
      .mockRejectedValueOnce(renameError);
    const persistentCache = await loadPersistentCacheModule(cacheDir);

    await expect(
      persistentCache.setPersistentValue(
        "video-assets",
        "one",
        { value: 1 },
        { version: 1 },
      ),
    ).rejects.toThrow("rename failed");

    expect(renameSpy).toHaveBeenCalledOnce();
    await expect(
      fs.access(path.join(cacheDir, "video-assets.json.tmp")),
    ).rejects.toThrow();
  });

  it("treats legacy entries as invalid when a versioned read is requested", async () => {
    const persistentCache = await loadPersistentCacheModule(cacheDir);

    await persistentCache.setPersistentValue("legacy-cache", "one", {
      value: 1,
    });

    await expect(
      persistentCache.getPersistentValue("legacy-cache", "one", {
        version: 1,
      }),
    ).resolves.toBeNull();
  });

  it("treats expired versioned entries as stale", async () => {
    const persistentCache = await loadPersistentCacheModule(cacheDir);
    const nowSpy = vi.spyOn(Date, "now");

    nowSpy.mockReturnValue(1_000);
    await persistentCache.setPersistentValue(
      "video-assets",
      "one",
      { value: 1 },
      { version: 1 },
    );

    nowSpy.mockReturnValue(10_000);

    await expect(
      persistentCache.getPersistentValue("video-assets", "one", {
        version: 1,
        maxAgeMs: 5_000,
      }),
    ).resolves.toBeNull();
  });

  it("can inspect and delete cached entries", async () => {
    const persistentCache = await loadPersistentCacheModule(cacheDir);

    await persistentCache.setPersistentValue(
      "video-assets",
      "one",
      { value: 1 },
      { version: 1 },
    );

    await expect(
      persistentCache.inspectPersistentValue("video-assets", "one", {
        version: 1,
      }),
    ).resolves.toMatchObject({
      value: { value: 1 },
      info: {
        key: "one",
        isVersioned: true,
        version: 1,
      },
    });

    await expect(
      persistentCache.deletePersistentValue("video-assets", "one"),
    ).resolves.toBe(true);
    await expect(
      persistentCache.getPersistentValue("video-assets", "one", {
        version: 1,
      }),
    ).resolves.toBeNull();
  });
});
