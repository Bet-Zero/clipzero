import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import { createRateLimiter } from "./rateLimit";

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    ip: "127.0.0.1",
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
    ...overrides,
  } as unknown as Request;
}

function mockResponse(): Response & {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
} {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as unknown,
    setHeader(name: string, value: string) {
      res.headers[name] = value;
      return res;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
  };
  return res as unknown as Response & {
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
  };
}

describe("createRateLimiter", () => {
  it("calls next() when under the limit", () => {
    const limiter = createRateLimiter({
      name: "test-under",
      windowMs: 60_000,
      max: 10,
    });
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn();

    limiter(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("sets rate limit headers", () => {
    const limiter = createRateLimiter({
      name: "test-headers",
      windowMs: 60_000,
      max: 10,
    });
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn();

    limiter(req, res, next);
    expect(res.headers["X-RateLimit-Limit"]).toBe("10");
    expect(res.headers["X-RateLimit-Remaining"]).toBeDefined();
    expect(res.headers["X-RateLimit-Reset"]).toBeDefined();
    expect(res.headers["Retry-After"]).toBeDefined();
  });

  it("returns 429 when rate limit is exceeded", () => {
    const limiter = createRateLimiter({
      name: "test-exceed",
      windowMs: 60_000,
      max: 2,
    });

    // First two requests should pass
    for (let i = 0; i < 2; i++) {
      const req = mockRequest();
      const res = mockResponse();
      const next = vi.fn();
      limiter(req, res, next);
      expect(next).toHaveBeenCalled();
    }

    // Third request should be rate limited
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn();
    limiter(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: "Too many requests",
      }),
    );
  });

  it("returns 400 when client IP cannot be determined", () => {
    const limiter = createRateLimiter({
      name: "test-no-ip",
      windowMs: 60_000,
      max: 10,
    });
    const req = mockRequest({
      ip: undefined,
      headers: {},
      socket: { remoteAddress: undefined } as any,
    });
    const res = mockResponse();
    const next = vi.fn();

    limiter(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it("uses x-forwarded-for header when ip is not available", () => {
    const limiter = createRateLimiter({
      name: "test-forwarded",
      windowMs: 60_000,
      max: 10,
    });
    const req = mockRequest({
      ip: undefined,
      headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2" },
      socket: { remoteAddress: undefined } as any,
    });
    const res = mockResponse();
    const next = vi.fn();

    limiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("remaining count decreases with each request", () => {
    const limiter = createRateLimiter({
      name: "test-remaining",
      windowMs: 60_000,
      max: 5,
    });

    const responses: Array<ReturnType<typeof mockResponse>> = [];

    for (let i = 0; i < 3; i++) {
      const req = mockRequest({ ip: "10.99.99.99" });
      const res = mockResponse();
      const next = vi.fn();
      limiter(req, res, next);
      responses.push(res);
    }

    expect(responses[0]!.headers["X-RateLimit-Remaining"]).toBe("4");
    expect(responses[1]!.headers["X-RateLimit-Remaining"]).toBe("3");
    expect(responses[2]!.headers["X-RateLimit-Remaining"]).toBe("2");
  });

  it("isolates rate limits between different IPs", () => {
    const limiter = createRateLimiter({
      name: "test-isolate",
      windowMs: 60_000,
      max: 1,
    });

    // IP 1 uses its one allowed request
    const req1 = mockRequest({ ip: "192.168.1.1" });
    const res1 = mockResponse();
    const next1 = vi.fn();
    limiter(req1, res1, next1);
    expect(next1).toHaveBeenCalled();

    // IP 1 is now rate limited
    const req1b = mockRequest({ ip: "192.168.1.1" });
    const res1b = mockResponse();
    const next1b = vi.fn();
    limiter(req1b, res1b, next1b);
    expect(next1b).not.toHaveBeenCalled();

    // IP 2 still has its own allowance
    const req2 = mockRequest({ ip: "192.168.1.2" });
    const res2 = mockResponse();
    const next2 = vi.fn();
    limiter(req2, res2, next2);
    expect(next2).toHaveBeenCalled();
  });
});
