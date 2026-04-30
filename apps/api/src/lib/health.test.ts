import { describe, expect, it } from "vitest";
import { buildHealthResponse } from "./health";

describe("buildHealthResponse", () => {
  it("returns a healthy 200 response when the API is enabled", () => {
    expect(
      buildHealthResponse(false, true, "2026-04-21T00:00:00.000Z"),
    ).toEqual({
      statusCode: 200,
      payload: {
        ok: true,
        disabled: false,
        videoCdnAvailable: true,
        timestamp: "2026-04-21T00:00:00.000Z",
      },
    });
  });

  it("returns a 503 response when the API is disabled", () => {
    expect(
      buildHealthResponse(true, false, "2026-04-21T00:00:00.000Z"),
    ).toEqual({
      statusCode: 503,
      payload: {
        ok: false,
        disabled: true,
        videoCdnAvailable: false,
        timestamp: "2026-04-21T00:00:00.000Z",
      },
    });
  });

  it("includes runtime diagnostics when provided", () => {
    expect(
      buildHealthResponse(false, true, "2026-04-21T00:00:00.000Z", undefined, {
        packageVersion: "1.0.0",
        gitSha: "abc1234",
        buildTimestamp: "2026-04-20T23:59:59.000Z",
        entrypoint: "/srv/apps/api/dist/index.js",
      }),
    ).toEqual({
      statusCode: 200,
      payload: {
        ok: true,
        disabled: false,
        videoCdnAvailable: true,
        timestamp: "2026-04-21T00:00:00.000Z",
        runtime: {
          packageVersion: "1.0.0",
          gitSha: "abc1234",
          buildTimestamp: "2026-04-20T23:59:59.000Z",
          entrypoint: "/srv/apps/api/dist/index.js",
        },
      },
    });
  });
});
