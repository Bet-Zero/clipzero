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
      persistentCache.setPersistentValue("video-assets", "one", { value: 1 }),
      persistentCache.setPersistentValue("video-assets", "two", { value: 2 }),
    ]);

    expect(
      await persistentCache.getPersistentValue("video-assets", "one"),
    ).toEqual({ value: 1 });
    expect(
      await persistentCache.getPersistentValue("video-assets", "two"),
    ).toEqual({ value: 2 });

    const raw = JSON.parse(
      await fs.readFile(path.join(cacheDir, "video-assets.json"), "utf-8"),
    ) as Record<string, unknown>;
    expect(raw).toEqual({
      one: { value: 1 },
      two: { value: 2 },
    });
  });

  it("removes the temp file when a rename fails", async () => {
    const renameError = new Error("rename failed");
    const renameSpy = vi
      .spyOn(fs, "rename")
      .mockRejectedValueOnce(renameError);
    const persistentCache = await loadPersistentCacheModule(cacheDir);

    await expect(
      persistentCache.setPersistentValue("video-assets", "one", { value: 1 }),
    ).rejects.toThrow("rename failed");

    expect(renameSpy).toHaveBeenCalledOnce();
    await expect(
      fs.access(path.join(cacheDir, "video-assets.json.tmp")),
    ).rejects.toThrow();
  });
});
