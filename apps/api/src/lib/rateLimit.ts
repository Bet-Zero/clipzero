import type { RequestHandler } from "express";

type RateLimitOptions = {
  name: string;
  windowMs: number;
  max: number;
};

type Bucket = {
  count: number;
  resetAt: number;
  lastAccessed: number;
  windowMs: number;
};

const buckets = new Map<string, Bucket>();
const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;
const BUCKET_CLEANUP_INTERVAL_MS = FIVE_MINUTES_IN_MS;

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastAccessed > bucket.windowMs) {
      buckets.delete(key);
    }
  }
}, BUCKET_CLEANUP_INTERVAL_MS);

cleanupInterval.unref?.();

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    const forwardedFor = req.headers["x-forwarded-for"];
    const forwardedIp =
      typeof forwardedFor === "string"
        ? forwardedFor.split(",")[0]?.trim()
        : undefined;
    const clientIp = req.ip ?? forwardedIp ?? req.socket.remoteAddress;

    if (!clientIp) {
      res.status(400).json({
        error: "Unable to determine client IP address",
        details: "Rate limiting requires a resolvable client address",
      });
      return;
    }

    const key = `${options.name}:${clientIp}`;
    const current = buckets.get(key);

    let bucket: Bucket;
    if (!current || current.resetAt <= now) {
      bucket = {
        count: 0,
        resetAt: now + options.windowMs,
        lastAccessed: now,
        windowMs: options.windowMs,
      };
    } else {
      bucket = current;
      bucket.lastAccessed = now;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.resetAt - now) / 1000),
    );
    const remaining = Math.max(0, options.max - bucket.count);

    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.setHeader("X-RateLimit-Limit", String(options.max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader(
      "X-RateLimit-Reset",
      new Date(bucket.resetAt).toISOString(),
    );

    if (bucket.count > options.max) {
      res.status(429).json({
        error: "Too many requests",
        details: `Rate limit exceeded for ${options.name}`,
        retryAfterSeconds,
      });
      return;
    }

    next();
  };
}
