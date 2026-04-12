import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We test the config module by manipulating environment variables
// before importing; since apiConfig is evaluated at import time,
// we use vi.resetModules() + dynamic import for each test.

async function loadConfig() {
  vi.resetModules();
  return import("./config");
}

describe("config", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env between tests
    process.env = { ...originalEnv };
  });

  // ── readIntEnv (tested via apiConfig.port) ─────────────────────────

  describe("readIntEnv (via port)", () => {
    it("uses fallback when env var is not set", async () => {
      delete process.env.PORT;
      const { apiConfig } = await loadConfig();
      expect(apiConfig.port).toBe(4000);
    });

    it("parses a valid integer from env", async () => {
      process.env.PORT = "8080";
      const { apiConfig } = await loadConfig();
      expect(apiConfig.port).toBe(8080);
    });

    it("uses fallback for non-numeric string", async () => {
      process.env.PORT = "abc";
      const { apiConfig } = await loadConfig();
      expect(apiConfig.port).toBe(4000);
    });

    it("uses fallback for negative value (below min)", async () => {
      process.env.PORT = "-1";
      const { apiConfig } = await loadConfig();
      expect(apiConfig.port).toBe(4000);
    });

    it("uses fallback for zero (below min=1)", async () => {
      process.env.PORT = "0";
      const { apiConfig } = await loadConfig();
      expect(apiConfig.port).toBe(4000);
    });

    it("floors floating point values", async () => {
      process.env.PORT = "3000.9";
      const { apiConfig } = await loadConfig();
      expect(apiConfig.port).toBe(3000);
    });

    it("uses fallback for Infinity", async () => {
      process.env.PORT = "Infinity";
      const { apiConfig } = await loadConfig();
      expect(apiConfig.port).toBe(4000);
    });

    it("uses fallback for NaN", async () => {
      process.env.PORT = "NaN";
      const { apiConfig } = await loadConfig();
      expect(apiConfig.port).toBe(4000);
    });
  });

  // ── readBoolEnv (tested via disabled) ──────────────────────────────

  describe("readBoolEnv (via disabled)", () => {
    it("returns false when env var is not set", async () => {
      delete process.env.CLIPZERO_DISABLE_ACCESS;
      delete process.env.CLIPZERO_API_DISABLED;
      const { apiConfig } = await loadConfig();
      expect(apiConfig.disabled).toBe(false);
    });

    it("returns true for '1'", async () => {
      process.env.CLIPZERO_DISABLE_ACCESS = "1";
      const { apiConfig } = await loadConfig();
      expect(apiConfig.disabled).toBe(true);
    });

    it("returns true for 'true'", async () => {
      process.env.CLIPZERO_API_DISABLED = "true";
      const { apiConfig } = await loadConfig();
      expect(apiConfig.disabled).toBe(true);
    });

    it("returns false for 'false'", async () => {
      process.env.CLIPZERO_DISABLE_ACCESS = "false";
      delete process.env.CLIPZERO_API_DISABLED;
      const { apiConfig } = await loadConfig();
      expect(apiConfig.disabled).toBe(false);
    });

    it("returns false for '0'", async () => {
      process.env.CLIPZERO_DISABLE_ACCESS = "0";
      delete process.env.CLIPZERO_API_DISABLED;
      const { apiConfig } = await loadConfig();
      expect(apiConfig.disabled).toBe(false);
    });
  });

  // ── readOrigins (tested via allowedOrigins) ────────────────────────

  describe("readOrigins (via allowedOrigins)", () => {
    it("returns empty array when env var is not set", async () => {
      delete process.env.CLIPZERO_ALLOWED_ORIGINS;
      const { apiConfig } = await loadConfig();
      expect(apiConfig.allowedOrigins).toEqual([]);
    });

    it("parses comma-separated origins", async () => {
      process.env.CLIPZERO_ALLOWED_ORIGINS =
        "http://localhost:3000,https://example.com";
      const { apiConfig } = await loadConfig();
      expect(apiConfig.allowedOrigins).toEqual([
        "http://localhost:3000",
        "https://example.com",
      ]);
    });

    it("trims whitespace around origins", async () => {
      process.env.CLIPZERO_ALLOWED_ORIGINS = " http://a.com , http://b.com ";
      const { apiConfig } = await loadConfig();
      expect(apiConfig.allowedOrigins).toEqual([
        "http://a.com",
        "http://b.com",
      ]);
    });

    it("filters out empty segments", async () => {
      process.env.CLIPZERO_ALLOWED_ORIGINS = "http://a.com,,http://b.com,";
      const { apiConfig } = await loadConfig();
      expect(apiConfig.allowedOrigins).toEqual([
        "http://a.com",
        "http://b.com",
      ]);
    });

    it("returns empty array for empty string", async () => {
      process.env.CLIPZERO_ALLOWED_ORIGINS = "";
      const { apiConfig } = await loadConfig();
      expect(apiConfig.allowedOrigins).toEqual([]);
    });
  });

  // ── resolveCacheDir (tested via cacheDir) ──────────────────────────

  describe("resolveCacheDir (via cacheDir)", () => {
    it("defaults to .cache in cwd when env var is not set", async () => {
      delete process.env.CLIPZERO_CACHE_DIR;
      const { apiConfig } = await loadConfig();
      expect(apiConfig.cacheDir).toMatch(/\.cache$/);
    });

    it("uses absolute path as-is", async () => {
      process.env.CLIPZERO_CACHE_DIR = "/tmp/my-cache";
      const { apiConfig } = await loadConfig();
      expect(apiConfig.cacheDir).toBe("/tmp/my-cache");
    });

    it("resolves relative path against cwd", async () => {
      process.env.CLIPZERO_CACHE_DIR = "my-cache";
      const { apiConfig } = await loadConfig();
      expect(apiConfig.cacheDir).toContain("my-cache");
      // Should be an absolute path
      expect(apiConfig.cacheDir.startsWith("/")).toBe(true);
    });
  });

  // ── rateLimit config ───────────────────────────────────────────────

  describe("rateLimit defaults", () => {
    it("provides default rate limit values", async () => {
      delete process.env.CLIPZERO_RATE_LIMIT_WINDOW_MS;
      delete process.env.CLIPZERO_RATE_LIMIT_MAX;
      delete process.env.CLIPZERO_HEAVY_RATE_LIMIT_WINDOW_MS;
      delete process.env.CLIPZERO_HEAVY_RATE_LIMIT_MAX;
      delete process.env.CLIPZERO_PLAYERS_RATE_LIMIT_WINDOW_MS;
      delete process.env.CLIPZERO_PLAYERS_RATE_LIMIT_MAX;
      const { apiConfig } = await loadConfig();
      expect(apiConfig.rateLimit.windowMs).toBe(60_000);
      expect(apiConfig.rateLimit.max).toBe(120);
      expect(apiConfig.rateLimit.heavyWindowMs).toBe(60_000);
      expect(apiConfig.rateLimit.heavyMax).toBe(40);
      expect(apiConfig.rateLimit.playersWindowMs).toBe(60_000);
      expect(apiConfig.rateLimit.playersMax).toBe(60);
    });
  });
});
