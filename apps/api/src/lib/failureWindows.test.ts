import { describe, it, expect, beforeEach } from "vitest";
import {
  recordEvent,
  getWindowContext,
  _resetForTesting,
} from "./failureWindows";
import type { FailureEvidence } from "./failureTypes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvidence(
  overrides: Partial<FailureEvidence> = {},
): FailureEvidence {
  return {
    eventId: "test-event",
    timestamp: new Date().toISOString(),
    route: "video_asset",
    requestId: "req-1",
    gameId: "001",
    actionNumber: 1,
    ...overrides,
  };
}

function successEvidence(
  overrides: Partial<FailureEvidence> = {},
): FailureEvidence {
  return makeEvidence({
    responseBodyValid: true,
    urlFieldPresent: true,
    ...overrides,
  });
}

function emptyEvidence(
  overrides: Partial<FailureEvidence> = {},
): FailureEvidence {
  return makeEvidence({
    responseBodyValid: true,
    urlFieldPresent: false,
    ...overrides,
  });
}

function failureEvidence(
  overrides: Partial<FailureEvidence> = {},
): FailureEvidence {
  return makeEvidence({
    httpStatus: 500,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("failureWindows", () => {
  beforeEach(() => {
    _resetForTesting();
  });

  describe("recordEvent + getWindowContext", () => {
    it("starts with empty window context", () => {
      const ctx = getWindowContext(30);
      expect(ctx.totalLookups).toBe(0);
      expect(ctx.successes).toBe(0);
      expect(ctx.emptyResponses).toBe(0);
      expect(ctx.uniqueKeyFailures).toBe(0);
      expect(ctx.windowSeconds).toBe(30);
    });

    it("counts a success event", () => {
      recordEvent(successEvidence());
      const ctx = getWindowContext(30);
      expect(ctx.totalLookups).toBe(1);
      expect(ctx.successes).toBe(1);
      expect(ctx.emptyResponses).toBe(0);
      expect(ctx.uniqueKeyFailures).toBe(0);
    });

    it("counts an empty response event", () => {
      recordEvent(emptyEvidence());
      const ctx = getWindowContext(30);
      expect(ctx.totalLookups).toBe(1);
      expect(ctx.successes).toBe(0);
      expect(ctx.emptyResponses).toBe(1);
      expect(ctx.uniqueKeyFailures).toBe(1);
    });

    it("counts multiple events", () => {
      recordEvent(successEvidence({ actionNumber: 1 }));
      recordEvent(successEvidence({ actionNumber: 2 }));
      recordEvent(emptyEvidence({ actionNumber: 3 }));
      recordEvent(emptyEvidence({ actionNumber: 4 }));
      recordEvent(failureEvidence({ actionNumber: 5 }));

      const ctx = getWindowContext(30);
      expect(ctx.totalLookups).toBe(5);
      expect(ctx.successes).toBe(2);
      expect(ctx.emptyResponses).toBe(2);
    });
  });

  describe("same-key recurrence tracking", () => {
    it("tracks same-key failures", () => {
      recordEvent(emptyEvidence({ gameId: "g1", actionNumber: 42 }));
      recordEvent(emptyEvidence({ gameId: "g1", actionNumber: 42 }));
      recordEvent(emptyEvidence({ gameId: "g1", actionNumber: 42 }));

      const ctx = getWindowContext(30, "g1:42");
      expect(ctx.sameKeyFailures).toBe(3);
    });

    it("does not count successes as same-key failures", () => {
      recordEvent(successEvidence({ gameId: "g1", actionNumber: 42 }));
      recordEvent(emptyEvidence({ gameId: "g1", actionNumber: 42 }));

      const ctx = getWindowContext(30, "g1:42");
      expect(ctx.sameKeyFailures).toBe(1);
    });

    it("returns 0 when no clipKey provided", () => {
      recordEvent(emptyEvidence({ gameId: "g1", actionNumber: 42 }));
      const ctx = getWindowContext(30);
      expect(ctx.sameKeyFailures).toBe(0);
    });
  });

  describe("unique key failure spread", () => {
    it("counts unique keys that failed", () => {
      recordEvent(emptyEvidence({ gameId: "g1", actionNumber: 1 }));
      recordEvent(emptyEvidence({ gameId: "g1", actionNumber: 2 }));
      recordEvent(emptyEvidence({ gameId: "g1", actionNumber: 3 }));
      recordEvent(emptyEvidence({ gameId: "g1", actionNumber: 1 })); // duplicate key

      const ctx = getWindowContext(30);
      expect(ctx.uniqueKeyFailures).toBe(3);
    });

    it("does not count successful keys as failures", () => {
      recordEvent(successEvidence({ gameId: "g1", actionNumber: 1 }));
      recordEvent(successEvidence({ gameId: "g1", actionNumber: 2 }));
      recordEvent(emptyEvidence({ gameId: "g1", actionNumber: 3 }));

      const ctx = getWindowContext(30);
      expect(ctx.uniqueKeyFailures).toBe(1);
    });
  });

  describe("HTTP failure tracking", () => {
    it("tracks HTTP failures by status code", () => {
      recordEvent(failureEvidence({ httpStatus: 429, actionNumber: 1 }));
      recordEvent(failureEvidence({ httpStatus: 429, actionNumber: 2 }));
      recordEvent(failureEvidence({ httpStatus: 500, actionNumber: 3 }));

      const ctx = getWindowContext(30);
      expect(ctx.httpFailuresByStatus[429]).toBe(2);
      expect(ctx.httpFailuresByStatus[500]).toBe(1);
    });
  });

  describe("timeout tracking", () => {
    it("counts timeout events", () => {
      recordEvent(makeEvidence({ timedOut: true, actionNumber: 1 }));
      recordEvent(makeEvidence({ timedOut: true, actionNumber: 2 }));
      recordEvent(makeEvidence({ timedOut: false, actionNumber: 3 }));

      const ctx = getWindowContext(30);
      expect(ctx.timeouts).toBe(2);
    });
  });

  describe("window duration filtering", () => {
    it("returns different window durations", () => {
      recordEvent(emptyEvidence());
      const ctx10 = getWindowContext(10);
      const ctx30 = getWindowContext(30);
      const ctx120 = getWindowContext(120);

      // All should include the recently recorded event
      expect(ctx10.totalLookups).toBe(1);
      expect(ctx30.totalLookups).toBe(1);
      expect(ctx120.totalLookups).toBe(1);
    });
  });

  describe("reset", () => {
    it("clears all events", () => {
      recordEvent(emptyEvidence());
      recordEvent(emptyEvidence());
      _resetForTesting();

      const ctx = getWindowContext(30);
      expect(ctx.totalLookups).toBe(0);
    });
  });
});
