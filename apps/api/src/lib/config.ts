import path from "path";

function readIntEnv(name: string, fallback: number, min = 1): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.floor(parsed);
}

function readBoolEnv(name: string): boolean {
  const raw = process.env[name];
  return raw === "1" || raw === "true";
}

function readOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function resolveCacheDir(value: string | undefined): string {
  if (!value) {
    return path.resolve(process.cwd(), "apps/api/.cache");
  }

  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

export const apiConfig = {
  port: readIntEnv("PORT", 4000),
  cacheDir: resolveCacheDir(process.env.CLIPZERO_CACHE_DIR),
  disabled:
    readBoolEnv("CLIPZERO_DISABLE_ACCESS") ||
    readBoolEnv("CLIPZERO_API_DISABLED"),
  allowedOrigins: readOrigins(process.env.CLIPZERO_ALLOWED_ORIGINS),
  rateLimit: {
    windowMs: readIntEnv("CLIPZERO_RATE_LIMIT_WINDOW_MS", 60_000),
    max: readIntEnv("CLIPZERO_RATE_LIMIT_MAX", 120),
    heavyWindowMs: readIntEnv("CLIPZERO_HEAVY_RATE_LIMIT_WINDOW_MS", 60_000),
    heavyMax: readIntEnv("CLIPZERO_HEAVY_RATE_LIMIT_MAX", 40),
    playersWindowMs: readIntEnv(
      "CLIPZERO_PLAYERS_RATE_LIMIT_WINDOW_MS",
      60_000,
    ),
    playersMax: readIntEnv("CLIPZERO_PLAYERS_RATE_LIMIT_MAX", 60),
  },
};
