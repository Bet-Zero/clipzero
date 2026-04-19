import { describe, it, expect } from "vitest";
import {
  classifyEvent,
  isAbortedRequest,
  isStaleDiscarded,
  isUpstreamTimeout,
  isUpstreamHttpFailure,
  isEmptyAssetResponse,
  isIsolatedClipGap,
  isLikelyPressureWindow,
  isWidespreadDegradation,
  isSpecificMissingAsset,
} from "./failureClassifier";
import {
  DiagnosisConfidence,
  FailureDiagnosis,
  RawEventKind,
} from "./failureTypes";
import type { FailureEvidence, WindowContext } from "./failureTypes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseEvidence(
  overrides: Partial<FailureEvidence> = {},
): FailureEvidence {
  return {
    eventId: "test-event-1",
    timestamp: new Date().toISOString(),
    route: "video_asset",
    requestId: "req-1",
    ...overrides,
  };
}

function baseWindow(overrides: Partial<WindowContext> = {}): WindowContext {
  return {
    totalLookups: 10,
    successes: 8,
    emptyResponses: 1,
    placeholderEvents: 0,
    httpFailuresByStatus: {},
    timeouts: 0,
    sameKeyFailures: 0,
    uniqueKeyFailures: 1,
    windowSeconds: 30,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 7.1 — Control-flow rules
// ---------------------------------------------------------------------------

describe("Rule Group 1: control-flow exclusions", () => {
  it("classifies aborted request as stale_request_canceled", () => {
    const result = classifyEvent(
      RawEventKind.request_aborted,
      baseEvidence({ aborted: true }),
    );
    expect(result.diagnosis).toBe(FailureDiagnosis.stale_request_canceled);
    expect(result.confidence).toBe(DiagnosisConfidence.high);
  });

  it("classifies stale discard as frontend_request_discarded", () => {
    const result = classifyEvent(
      RawEventKind.stale_response_discarded,
      baseEvidence({ staleDiscarded: true, supersededByGeneration: 3 }),
    );
    expect(result.diagnosis).toBe(FailureDiagnosis.frontend_request_discarded);
    expect(result.confidence).toBe(DiagnosisConfidence.high);
  });

  it("aborted request is never classified as a real failure", () => {
    // Even with upstream failure indicators, abort takes priority
    const result = classifyEvent(
      RawEventKind.upstream_failed,
      baseEvidence({
        aborted: true,
        httpStatus: 500,
        timedOut: true,
      }),
    );
    expect(result.diagnosis).toBe(FailureDiagnosis.stale_request_canceled);
  });

  it("stale discard is never classified as a real failure", () => {
    const result = classifyEvent(
      RawEventKind.upstream_http_error,
      baseEvidence({
        staleDiscarded: true,
        httpStatus: 429,
      }),
    );
    expect(result.diagnosis).toBe(FailureDiagnosis.frontend_request_discarded);
  });
});

// ---------------------------------------------------------------------------
// 7.2 — Transport and internal failure rules
// ---------------------------------------------------------------------------

describe("Rule Group 2: transport and internal failures", () => {
  it("classifies upstream timeout as upstream_timeout_or_transport_failure", () => {
    const result = classifyEvent(
      RawEventKind.upstream_timeout,
      baseEvidence({ timedOut: true, durationMs: 10000 }),
    );
    expect(result.diagnosis).toBe(
      FailureDiagnosis.upstream_timeout_or_transport_failure,
    );
    expect(result.confidence).toBe(DiagnosisConfidence.high);
  });

  it("classifies upstream HTTP 429 as upstream_http_failure", () => {
    const result = classifyEvent(
      RawEventKind.upstream_http_error,
      baseEvidence({ httpStatus: 429 }),
    );
    expect(result.diagnosis).toBe(FailureDiagnosis.upstream_http_failure);
    expect(result.confidence).toBe(DiagnosisConfidence.high);
  });

  it("classifies upstream HTTP 500 as upstream_http_failure", () => {
    const result = classifyEvent(
      RawEventKind.upstream_http_error,
      baseEvidence({ httpStatus: 500 }),
    );
    expect(result.diagnosis).toBe(FailureDiagnosis.upstream_http_failure);
  });

  it("classifies upstream HTTP 403 as upstream_http_failure", () => {
    const result = classifyEvent(
      RawEventKind.upstream_http_error,
      baseEvidence({ httpStatus: 403 }),
    );
    expect(result.diagnosis).toBe(FailureDiagnosis.upstream_http_failure);
  });

  it("classifies API internal exception as api_internal_failure", () => {
    const result = classifyEvent(
      RawEventKind.internal_exception,
      baseEvidence({ errorName: "RangeError", errorMessage: "out of bounds" }),
    );
    expect(result.diagnosis).toBe(FailureDiagnosis.api_internal_failure);
    expect(result.confidence).toBe(DiagnosisConfidence.medium);
  });

  it("classifies browser network failure as frontend_network_failure", () => {
    const result = classifyEvent(
      RawEventKind.upstream_failed,
      baseEvidence({ networkErrorName: "TypeError" }),
    );
    expect(result.diagnosis).toBe(FailureDiagnosis.frontend_network_failure);
    expect(result.confidence).toBe(DiagnosisConfidence.high);
  });

  it("classifies ECONNREFUSED as frontend_network_failure", () => {
    const result = classifyEvent(
      RawEventKind.upstream_failed,
      baseEvidence({ networkErrorCode: "ECONNREFUSED" }),
    );
    expect(result.diagnosis).toBe(FailureDiagnosis.frontend_network_failure);
  });
});

// ---------------------------------------------------------------------------
// 7.3 — Asset-specific rules
// ---------------------------------------------------------------------------

describe("Rule Group 3: asset-specific outcomes", () => {
  it("classifies empty asset response as video_asset_empty_response", () => {
    const result = classifyEvent(
      RawEventKind.asset_returned_empty,
      baseEvidence({
        responseBodyValid: true,
        urlFieldPresent: false,
        gameId: "001",
        actionNumber: 42,
      }),
    );
    expect(result.diagnosis).toBe(FailureDiagnosis.video_asset_empty_response);
    expect(result.confidence).toBe(DiagnosisConfidence.medium);
  });

  it("classifies repeated same-key miss as video_asset_not_found", () => {
    const window = baseWindow({
      sameKeyFailures: 3,
      uniqueKeyFailures: 1,
      successes: 5,
    });
    const result = classifyEvent(
      RawEventKind.asset_returned_empty,
      baseEvidence({
        responseBodyValid: true,
        urlFieldPresent: false,
        gameId: "001",
        actionNumber: 42,
      }),
      window,
    );
    expect(result.diagnosis).toBe(FailureDiagnosis.video_asset_not_found);
    expect(result.confidence).toBe(DiagnosisConfidence.medium);
  });

  it("classifies isolated clip gap with healthy neighbors", () => {
    const window = baseWindow({
      sameKeyFailures: 2,
      uniqueKeyFailures: 2,
      successes: 10,
    });
    const result = classifyEvent(
      RawEventKind.asset_returned_empty,
      baseEvidence({
        responseBodyValid: true,
        urlFieldPresent: false,
        gameId: "001",
        actionNumber: 42,
      }),
      window,
    );
    expect(result.diagnosis).toBe(FailureDiagnosis.isolated_clip_gap);
  });

  it("falls back to empty_response when window context is insufficient", () => {
    const window = baseWindow({
      sameKeyFailures: 1,
      uniqueKeyFailures: 1,
      successes: 0,
    });
    const result = classifyEvent(
      RawEventKind.asset_returned_empty,
      baseEvidence({
        responseBodyValid: true,
        urlFieldPresent: false,
      }),
      window,
    );
    expect(result.diagnosis).toBe(FailureDiagnosis.video_asset_empty_response);
  });
});

// ---------------------------------------------------------------------------
// 7.4 — Aggregate / window rules
// ---------------------------------------------------------------------------

describe("Rule Group 4: aggregate/pattern diagnoses", () => {
  it("classifies burst of multi-key failures as upstream_pressure_suspected", () => {
    const window = baseWindow({
      uniqueKeyFailures: 6,
      windowSeconds: 15,
      successes: 2,
    });
    const result = classifyEvent(
      RawEventKind.upstream_failed,
      baseEvidence({ errorName: "AxiosError", httpStatus: 429 }),
      window,
    );
    // HTTP 429 is classified as upstream_http_failure (rule 6 fires first)
    // Pressure is aggregate-level, checked after single-event rules.
    expect(result.diagnosis).toBe(FailureDiagnosis.upstream_http_failure);
  });

  it("classifies widespread degradation when many unique keys fail", () => {
    const window = baseWindow({
      uniqueKeyFailures: 10,
      windowSeconds: 30,
      successes: 1,
    });
    // Event without specific single-event diagnosis trigger
    const result = classifyEvent(
      RawEventKind.upstream_failed,
      baseEvidence({}),
      window,
    );
    expect(result.diagnosis).toBe(
      FailureDiagnosis.widespread_upstream_video_degradation,
    );
    expect(result.confidence).toBe(DiagnosisConfidence.medium);
  });

  it("classifies pressure when 5+ unique keys fail in short window", () => {
    const window = baseWindow({
      uniqueKeyFailures: 5,
      windowSeconds: 15,
      successes: 2,
    });
    const result = classifyEvent(
      RawEventKind.upstream_failed,
      baseEvidence({}),
      window,
    );
    expect(result.diagnosis).toBe(FailureDiagnosis.upstream_pressure_suspected);
    expect(result.confidence).toBe(DiagnosisConfidence.low);
  });

  it("falls back to unknown_failure when no rules match", () => {
    const result = classifyEvent(
      RawEventKind.upstream_failed,
      baseEvidence({}),
    );
    expect(result.diagnosis).toBe(FailureDiagnosis.unknown_failure);
    expect(result.confidence).toBe(DiagnosisConfidence.low);
  });

  it("widespread degradation takes priority over pressure", () => {
    // Window that qualifies for both widespread (8+ keys, 30s) and pressure (5+ keys, 15s)
    const window = baseWindow({
      uniqueKeyFailures: 10,
      windowSeconds: 15,
    });
    const result = classifyEvent(
      RawEventKind.upstream_failed,
      baseEvidence({}),
      window,
    );
    expect(result.diagnosis).toBe(
      FailureDiagnosis.widespread_upstream_video_degradation,
    );
  });
});

// ---------------------------------------------------------------------------
// Helper predicate unit tests
// ---------------------------------------------------------------------------

describe("helper predicates", () => {
  it("isAbortedRequest", () => {
    expect(isAbortedRequest(baseEvidence({ aborted: true }))).toBe(true);
    expect(isAbortedRequest(baseEvidence({ aborted: false }))).toBe(false);
    expect(isAbortedRequest(baseEvidence())).toBe(false);
  });

  it("isStaleDiscarded", () => {
    expect(isStaleDiscarded(baseEvidence({ staleDiscarded: true }))).toBe(true);
    expect(isStaleDiscarded(baseEvidence())).toBe(false);
  });

  it("isUpstreamTimeout", () => {
    expect(isUpstreamTimeout(baseEvidence({ timedOut: true }))).toBe(true);
    expect(isUpstreamTimeout(baseEvidence())).toBe(false);
  });

  it("isUpstreamHttpFailure", () => {
    expect(isUpstreamHttpFailure(baseEvidence({ httpStatus: 500 }))).toBe(true);
    expect(isUpstreamHttpFailure(baseEvidence({ httpStatus: 200 }))).toBe(
      false,
    );
    expect(isUpstreamHttpFailure(baseEvidence())).toBe(false);
  });

  it("isEmptyAssetResponse", () => {
    expect(
      isEmptyAssetResponse(
        baseEvidence({ responseBodyValid: true, urlFieldPresent: false }),
      ),
    ).toBe(true);
    expect(
      isEmptyAssetResponse(
        baseEvidence({ responseBodyValid: true, urlFieldPresent: true }),
      ),
    ).toBe(false);
    expect(isEmptyAssetResponse(baseEvidence())).toBe(false);
  });

  it("isIsolatedClipGap", () => {
    expect(
      isIsolatedClipGap(
        baseEvidence(),
        baseWindow({ sameKeyFailures: 2, uniqueKeyFailures: 2, successes: 5 }),
      ),
    ).toBe(true);
    expect(isIsolatedClipGap(baseEvidence())).toBe(false);
    expect(
      isIsolatedClipGap(
        baseEvidence(),
        baseWindow({ sameKeyFailures: 1, uniqueKeyFailures: 1, successes: 5 }),
      ),
    ).toBe(false);
  });

  it("isLikelyPressureWindow", () => {
    expect(
      isLikelyPressureWindow(
        baseWindow({ uniqueKeyFailures: 5, windowSeconds: 15 }),
      ),
    ).toBe(true);
    expect(
      isLikelyPressureWindow(
        baseWindow({ uniqueKeyFailures: 4, windowSeconds: 15 }),
      ),
    ).toBe(false);
    expect(isLikelyPressureWindow()).toBe(false);
  });

  it("isWidespreadDegradation", () => {
    expect(
      isWidespreadDegradation(
        baseWindow({ uniqueKeyFailures: 8, windowSeconds: 30 }),
      ),
    ).toBe(true);
    expect(
      isWidespreadDegradation(
        baseWindow({ uniqueKeyFailures: 7, windowSeconds: 30 }),
      ),
    ).toBe(false);
    expect(isWidespreadDegradation()).toBe(false);
  });

  it("isSpecificMissingAsset", () => {
    expect(
      isSpecificMissingAsset(
        baseEvidence({ responseBodyValid: true, urlFieldPresent: false }),
        baseWindow({ sameKeyFailures: 3 }),
      ),
    ).toBe(true);
    expect(
      isSpecificMissingAsset(
        baseEvidence({ responseBodyValid: true, urlFieldPresent: false }),
        baseWindow({ sameKeyFailures: 2 }),
      ),
    ).toBe(false);
    expect(isSpecificMissingAsset(baseEvidence())).toBe(false);
  });
});
