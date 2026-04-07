import type { RequestHandler } from "express";

type RateLimitOptions = {
  name: string;
  windowMs: number;
  max: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${options.name}:${req.ip ?? "unknown"}`;
    const current = buckets.get(key);

    let bucket: Bucket;
    if (!current || current.resetAt <= now) {
      bucket = {
        count: 0,
        resetAt: now + options.windowMs,
      };
    } else {
      bucket = current;
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
