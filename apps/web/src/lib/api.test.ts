import { describe, it, expect, afterEach } from "vitest";
import {
  getApiBase,
  getApiLabel,
  getApiUnavailableMessage,
  buildApiUrl,
} from "./api";

describe("getApiBase", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns default localhost when env var is not set", () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    expect(getApiBase()).toBe("http://localhost:4000");
  });

  it("returns env var value when set", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    expect(getApiBase()).toBe("https://api.example.com");
  });
});

describe("getApiLabel", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns host from the API base URL", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    expect(getApiLabel()).toBe("api.example.com");
  });

  it("includes port in the label", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:4000";
    expect(getApiLabel()).toBe("localhost:4000");
  });

  it("returns raw base string if URL parsing fails", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "not-a-url";
    expect(getApiLabel()).toBe("not-a-url");
  });
});

describe("getApiUnavailableMessage", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("includes the API label in the message", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:4000";
    const msg = getApiUnavailableMessage();
    expect(msg).toContain("localhost:4000");
    expect(msg).toContain("API unavailable");
  });
});

describe("buildApiUrl", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("builds URL without search params", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:4000";
    expect(buildApiUrl("/games")).toBe("http://localhost:4000/games");
  });

  it("builds URL with search params", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:4000";
    const params = new URLSearchParams({ date: "2024-01-15" });
    expect(buildApiUrl("/games", params)).toBe(
      "http://localhost:4000/games?date=2024-01-15",
    );
  });

  it("builds URL with empty search params (no query string)", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:4000";
    const result = buildApiUrl("/clips", new URLSearchParams());
    // Empty params should produce a URL without '?'
    expect(result).toBe("http://localhost:4000/clips");
  });

  it("builds URL with multiple search params", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:4000";
    const params = new URLSearchParams();
    params.set("gameId", "123");
    params.set("limit", "20");
    const url = buildApiUrl("/clips/game", params);
    expect(url).toContain("gameId=123");
    expect(url).toContain("limit=20");
  });
});
