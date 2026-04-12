import { describe, it, expect, afterEach } from "vitest";
import {
  ACCESS_COOKIE_NAME,
  isAccessGateEnabled,
  isAccessDisabled,
  getAccessToken,
  sanitizeNextPath,
} from "./access";

describe("ACCESS_COOKIE_NAME", () => {
  it("is 'clipzero_access'", () => {
    expect(ACCESS_COOKIE_NAME).toBe("clipzero_access");
  });
});

describe("isAccessGateEnabled", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns false when neither env var is set", () => {
    delete process.env.CLIPZERO_APP_PASSWORD;
    delete process.env.CLIPZERO_ACCESS_TOKEN;
    expect(isAccessGateEnabled()).toBe(false);
  });

  it("returns false when only password is set", () => {
    process.env.CLIPZERO_APP_PASSWORD = "pass";
    delete process.env.CLIPZERO_ACCESS_TOKEN;
    expect(isAccessGateEnabled()).toBe(false);
  });

  it("returns false when only token is set", () => {
    delete process.env.CLIPZERO_APP_PASSWORD;
    process.env.CLIPZERO_ACCESS_TOKEN = "token";
    expect(isAccessGateEnabled()).toBe(false);
  });

  it("returns true when both are set", () => {
    process.env.CLIPZERO_APP_PASSWORD = "pass";
    process.env.CLIPZERO_ACCESS_TOKEN = "token";
    expect(isAccessGateEnabled()).toBe(true);
  });

  it("returns false when password is whitespace only", () => {
    process.env.CLIPZERO_APP_PASSWORD = "   ";
    process.env.CLIPZERO_ACCESS_TOKEN = "token";
    expect(isAccessGateEnabled()).toBe(false);
  });

  it("returns false when token is whitespace only", () => {
    process.env.CLIPZERO_APP_PASSWORD = "pass";
    process.env.CLIPZERO_ACCESS_TOKEN = "   ";
    expect(isAccessGateEnabled()).toBe(false);
  });
});

describe("isAccessDisabled", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns false when env var is not set", () => {
    delete process.env.CLIPZERO_DISABLE_ACCESS;
    expect(isAccessDisabled()).toBe(false);
  });

  it("returns true for '1'", () => {
    process.env.CLIPZERO_DISABLE_ACCESS = "1";
    expect(isAccessDisabled()).toBe(true);
  });

  it("returns true for 'true'", () => {
    process.env.CLIPZERO_DISABLE_ACCESS = "true";
    expect(isAccessDisabled()).toBe(true);
  });

  it("returns false for 'false'", () => {
    process.env.CLIPZERO_DISABLE_ACCESS = "false";
    expect(isAccessDisabled()).toBe(false);
  });

  it("returns false for '0'", () => {
    process.env.CLIPZERO_DISABLE_ACCESS = "0";
    expect(isAccessDisabled()).toBe(false);
  });
});

describe("getAccessToken", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns empty string when not set", () => {
    delete process.env.CLIPZERO_ACCESS_TOKEN;
    expect(getAccessToken()).toBe("");
  });

  it("returns trimmed token value", () => {
    process.env.CLIPZERO_ACCESS_TOKEN = "  my-token  ";
    expect(getAccessToken()).toBe("my-token");
  });

  it("returns exact token value", () => {
    process.env.CLIPZERO_ACCESS_TOKEN = "abc123";
    expect(getAccessToken()).toBe("abc123");
  });
});

describe("sanitizeNextPath", () => {
  it("returns '/' for null", () => {
    expect(sanitizeNextPath(null)).toBe("/");
  });

  it("returns '/' for undefined", () => {
    expect(sanitizeNextPath(undefined)).toBe("/");
  });

  it("returns '/' for empty string", () => {
    expect(sanitizeNextPath("")).toBe("/");
  });

  it("returns '/' for path not starting with /", () => {
    expect(sanitizeNextPath("foo")).toBe("/");
  });

  it("returns '/' for double-slash (open redirect prevention)", () => {
    expect(sanitizeNextPath("//evil.com")).toBe("/");
  });

  it("passes through valid paths starting with /", () => {
    expect(sanitizeNextPath("/dashboard")).toBe("/dashboard");
  });

  it("passes through paths with query strings", () => {
    expect(sanitizeNextPath("/page?foo=bar")).toBe("/page?foo=bar");
  });

  it("passes through root path", () => {
    expect(sanitizeNextPath("/")).toBe("/");
  });
});
