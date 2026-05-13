import { describe, it, expect, afterEach } from "vitest";
import {
  getApiBase,
  getApiLabel,
  getApiUnavailableMessage,
  getGameClipsUnavailableCopy,
  buildApiUrl,
  readApiErrorDetail,
  sanitizeApiErrorDetail,
} from "./api";

describe("getApiBase", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns default API rewrite path when env var is not set", () => {
    delete process.env.INTERNAL_API_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    expect(getApiBase()).toBe("/api");
  });

  it("returns the server env var value when set", () => {
    process.env.INTERNAL_API_URL = "https://api.example.com";
    expect(getApiBase()).toBe("https://api.example.com");
  });
});

describe("getApiLabel", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns host from the API base URL", () => {
    process.env.INTERNAL_API_URL = "https://api.example.com";
    expect(getApiLabel()).toBe("api.example.com");
  });

  it("includes port in the label", () => {
    process.env.INTERNAL_API_URL = "http://localhost:4000";
    expect(getApiLabel()).toBe("localhost:4000");
  });

  it("returns raw base string if URL parsing fails", () => {
    process.env.INTERNAL_API_URL = "not-a-url";
    expect(getApiLabel()).toBe("not-a-url");
  });
});

describe("getApiUnavailableMessage", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("includes the API label in the message", () => {
    process.env.INTERNAL_API_URL = "http://localhost:4000";
    const msg = getApiUnavailableMessage();
    expect(msg).toContain("localhost:4000");
    expect(msg).toContain("API unavailable");
  });
});

describe("getGameClipsUnavailableCopy", () => {
  it("returns friendly game-level copy", () => {
    expect(getGameClipsUnavailableCopy()).toEqual({
      title: "Clips unavailable for this game",
      description:
        "The API is online, but NBA data for this selected game could not be loaded. Try another game or check back later.",
      matchup: undefined,
    });
  });

  it("preserves matchup context when available", () => {
    expect(getGameClipsUnavailableCopy("NYK @ BOS").matchup).toBe(
      "NYK @ BOS",
    );
  });
});

describe("sanitizeApiErrorDetail", () => {
  it("normalizes plain-text error details", () => {
    expect(sanitizeApiErrorDetail("  Failed\n\n to fetch game clips  ")).toBe(
      "Failed to fetch game clips",
    );
  });

  it("drops html-like payloads", () => {
    expect(sanitizeApiErrorDetail("<!doctype html><html><body>Denied</body></html>")).toBeUndefined();
  });
});

describe("readApiErrorDetail", () => {
  it("reads the JSON error body when available", async () => {
    const response = new Response(
      JSON.stringify({ error: "Failed to fetch game clips" }),
      {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "content-type": "application/json" },
      },
    );

    await expect(readApiErrorDetail(response)).resolves.toBe(
      "Failed to fetch game clips",
    );
  });

  it("falls back to text when the body is not JSON", async () => {
    const response = new Response("Failed to fetch game clips", {
      status: 500,
      statusText: "Internal Server Error",
      headers: { "content-type": "text/plain" },
    });

    await expect(readApiErrorDetail(response)).resolves.toBe(
      "Failed to fetch game clips",
    );
  });

  it("falls back to the status text for html error pages", async () => {
    const response = new Response("<!doctype html><html><body>Denied</body></html>", {
      status: 502,
      statusText: "Bad Gateway",
      headers: { "content-type": "text/html" },
    });

    await expect(readApiErrorDetail(response)).resolves.toBe("Bad Gateway");
  });
});

describe("buildApiUrl", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("builds URL without search params", () => {
    process.env.INTERNAL_API_URL = "http://localhost:4000";
    expect(buildApiUrl("/games")).toBe("http://localhost:4000/games");
  });

  it("builds URL with search params", () => {
    process.env.INTERNAL_API_URL = "http://localhost:4000";
    const params = new URLSearchParams({ date: "2024-01-15" });
    expect(buildApiUrl("/games", params)).toBe(
      "http://localhost:4000/games?date=2024-01-15",
    );
  });

  it("builds URL with empty search params (no query string)", () => {
    process.env.INTERNAL_API_URL = "http://localhost:4000";
    const result = buildApiUrl("/clips", new URLSearchParams());
    // Empty params should produce a URL without '?'
    expect(result).toBe("http://localhost:4000/clips");
  });

  it("builds URL with multiple search params", () => {
    process.env.INTERNAL_API_URL = "http://localhost:4000";
    const params = new URLSearchParams();
    params.set("gameId", "123");
    params.set("limit", "20");
    const url = buildApiUrl("/clips/game", params);
    expect(url).toContain("gameId=123");
    expect(url).toContain("limit=20");
  });
});
