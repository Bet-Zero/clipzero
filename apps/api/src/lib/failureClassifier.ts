// ---------------------------------------------------------------------------
// Failure Classifier
// ---------------------------------------------------------------------------
// Turns raw failure events into likely diagnoses using explicit, readable rules.
// See docs/plans/failure-diagnosis-plan.md for design rationale.
// ---------------------------------------------------------------------------

import {
  DiagnosisConfidence,
  FailureDiagnosis,
  type ClassifiedEvent,
  type FailureEvidence,
  type RawEventKind,
  type WindowContext,
} from "./failureTypes";

// ---------------------------------------------------------------------------
// Helper predicates (exported for testing)
// ---------------------------------------------------------------------------

/** True when the request was intentionally aborted (e.g. user navigated away). */
export function isAbortedRequest(evidence: FailureEvidence): boolean {
  return evidence.aborted === true;
}

/** True when a response arrived but was discarded because a newer generation won. */
export function isStaleDiscarded(evidence: FailureEvidence): boolean {
  return evidence.staleDiscarded === true;
}

/** True when the upstream request timed out. */
export function isUpstreamTimeout(evidence: FailureEvidence): boolean {
  return evidence.timedOut === true;
}

/** True when there was an upstream HTTP failure (non-success status). */
export function isUpstreamHttpFailure(evidence: FailureEvidence): boolean {
  return evidence.httpStatus !== undefined && evidence.httpStatus >= 400;
}

/** True when the asset endpoint returned a valid structure but no usable video URL. */
export function isEmptyAssetResponse(evidence: FailureEvidence): boolean {
  return (
    evidence.responseBodyValid === true && evidence.urlFieldPresent === false
  );
}

/**
 * True when the same clip key has failed repeatedly in the current window
 * while neighboring keys succeed — suggests the specific play lacks an asset.
 */
export function isIsolatedClipGap(
  evidence: FailureEvidence,
  window?: WindowContext,
): boolean {
  if (!window) return false;
  return (
    window.sameKeyFailures >= 2 &&
    window.uniqueKeyFailures <= 3 &&
    window.successes > 0
  );
}

/**
 * True when the recent window shows a burst of failures across many keys —
 * suggesting upstream is under pressure or throttling.
 */
export function isLikelyPressureWindow(window?: WindowContext): boolean {
  if (!window) return false;
  return window.uniqueKeyFailures >= 5 && window.windowSeconds <= 15;
}

/**
 * True when a large number of unique keys are failing over a broader window —
 * suggesting widespread upstream degradation.
 */
export function isWidespreadDegradation(window?: WindowContext): boolean {
  if (!window) return false;
  return window.uniqueKeyFailures >= 8 && window.windowSeconds <= 30;
}

/**
 * True when a specific play repeatedly returns no asset and the pattern
 * is consistent with a genuinely missing video asset rather than transient failure.
 */
export function isSpecificMissingAsset(
  evidence: FailureEvidence,
  window?: WindowContext,
): boolean {
  if (!window) return false;
  return window.sameKeyFailures >= 3 && isEmptyAssetResponse(evidence);
}

// ---------------------------------------------------------------------------
// Main classifier
// ---------------------------------------------------------------------------

/**
 * Classify a raw failure event into a likely diagnosis.
 *
 * Rules are evaluated in priority order:
 * 1. Control-flow exclusions (aborts, stale discards) — short-circuit
 * 2. Transport and internal failures (network, timeout, HTTP)
 * 3. Asset-specific outcomes (empty, placeholder, missing)
 * 4. Aggregate/pattern diagnoses (pressure, widespread degradation)
 * 5. Unknown fallback
 */
export function classifyEvent(
  eventKind: RawEventKind,
  evidence: FailureEvidence,
  window?: WindowContext,
): ClassifiedEvent {
  // ----- Rule Group 1: Control-flow exclusions -----

  // Rule 1: Aborted request → stale_request_canceled
  if (isAbortedRequest(evidence)) {
    return {
      rawEventKind: eventKind,
      diagnosis: FailureDiagnosis.stale_request_canceled,
      confidence: DiagnosisConfidence.high,
      evidenceSummary: ["Request was aborted via AbortController"],
    };
  }

  // Rule 2: Stale generation discard → frontend_request_discarded
  if (isStaleDiscarded(evidence)) {
    return {
      rawEventKind: eventKind,
      diagnosis: FailureDiagnosis.frontend_request_discarded,
      confidence: DiagnosisConfidence.high,
      evidenceSummary: [
        `Response discarded — superseded by generation ${evidence.supersededByGeneration ?? "unknown"}`,
      ],
    };
  }

  // ----- Rule Group 2: Transport and internal failures -----

  // Rule 3: Frontend network failure (browser → API never connected)
  if (
    evidence.networkErrorName === "TypeError" ||
    evidence.networkErrorCode === "ECONNREFUSED"
  ) {
    return {
      rawEventKind: eventKind,
      diagnosis: FailureDiagnosis.frontend_network_failure,
      confidence: DiagnosisConfidence.high,
      evidenceSummary: [
        `Network error: ${evidence.networkErrorName ?? evidence.networkErrorCode ?? "unknown"}`,
      ],
    };
  }

  // Rule 4: API internal exception
  if (evidence.errorName && !evidence.httpStatus && !evidence.timedOut) {
    return {
      rawEventKind: eventKind,
      diagnosis: FailureDiagnosis.api_internal_failure,
      confidence: DiagnosisConfidence.medium,
      evidenceSummary: [
        `Internal error: ${evidence.errorName}: ${evidence.errorMessage ?? ""}`,
      ],
    };
  }

  // Rule 5: Upstream timeout
  if (isUpstreamTimeout(evidence)) {
    return {
      rawEventKind: eventKind,
      diagnosis: FailureDiagnosis.upstream_timeout_or_transport_failure,
      confidence: DiagnosisConfidence.high,
      evidenceSummary: [
        `Upstream timed out after ${evidence.durationMs ?? "?"}ms`,
      ],
    };
  }

  // Rule 6: Upstream HTTP failure
  if (isUpstreamHttpFailure(evidence)) {
    return {
      rawEventKind: eventKind,
      diagnosis: FailureDiagnosis.upstream_http_failure,
      confidence: DiagnosisConfidence.high,
      evidenceSummary: [`Upstream returned HTTP ${evidence.httpStatus}`],
    };
  }

  // ----- Rule Group 3: Asset-specific outcomes -----

  // Rule 10: Placeholder suspected — check before empty/missing since
  // placeholder content may have a URL but it serves wrong content.
  if (
    evidence.urlFieldPresent === true &&
    evidence.responseBodyValid === true
  ) {
    // We reach this when a URL was returned but other signals indicate
    // it's placeholder content. For now this requires external placeholder
    // detection to have set a marker — future enhancement.
    // Fall through to other rules.
  }

  // If probe evidence exists (we probed the NBA CDN and observed the
  // placeholder behavior), prefer the placeholder diagnosis first.
  if (
    evidence.probeEtag !== undefined ||
    evidence.probeStatusCode !== undefined
  ) {
    return {
      rawEventKind: eventKind,
      diagnosis: FailureDiagnosis.video_asset_placeholder_suspected,
      confidence: DiagnosisConfidence.high,
      evidenceSummary: [
        `Probe evidence: status=${evidence.probeStatusCode ?? "?"} etag=${evidence.probeEtag ?? "?"}`,
      ],
    };
  }

  // Rule 7: Empty asset response
  if (isEmptyAssetResponse(evidence)) {
    // Check rule 8/9 with window context first

    // Rule 9: Repeated no-asset for the same play → video_asset_not_found
    if (isSpecificMissingAsset(evidence, window)) {
      return {
        rawEventKind: eventKind,
        diagnosis: FailureDiagnosis.video_asset_not_found,
        confidence: DiagnosisConfidence.medium,
        evidenceSummary: [
          `Same clip key failed ${window!.sameKeyFailures} times — likely no asset exists`,
        ],
      };
    }

    // Rule 8: Isolated clip gap — small number of specific plays fail
    if (isIsolatedClipGap(evidence, window)) {
      return {
        rawEventKind: eventKind,
        diagnosis: FailureDiagnosis.isolated_clip_gap,
        confidence: DiagnosisConfidence.medium,
        evidenceSummary: [
          `${window!.sameKeyFailures} failures for this key, ${window!.uniqueKeyFailures} unique keys failed, but ${window!.successes} successes nearby`,
        ],
      };
    }

    // Plain empty response without enough window context to say more
    return {
      rawEventKind: eventKind,
      diagnosis: FailureDiagnosis.video_asset_empty_response,
      confidence: DiagnosisConfidence.medium,
      evidenceSummary: [
        "Asset endpoint returned valid structure but no usable video URL",
      ],
    };
  }

  // ----- Rule Group 4: Aggregate / pattern diagnoses -----

  // Rule 12: Widespread degradation — many unique keys failing broadly
  if (isWidespreadDegradation(window)) {
    return {
      rawEventKind: eventKind,
      diagnosis: FailureDiagnosis.widespread_upstream_video_degradation,
      confidence: DiagnosisConfidence.medium,
      evidenceSummary: [
        `${window!.uniqueKeyFailures} unique keys failed in ${window!.windowSeconds}s window`,
      ],
    };
  }

  // Rule 11: Burst pressure — many keys failing in a short window
  if (isLikelyPressureWindow(window)) {
    return {
      rawEventKind: eventKind,
      diagnosis: FailureDiagnosis.upstream_pressure_suspected,
      confidence: DiagnosisConfidence.low,
      evidenceSummary: [
        `${window!.uniqueKeyFailures} unique keys failed in ${window!.windowSeconds}s — suggests upstream pressure`,
      ],
    };
  }

  // ----- Rule 14: Unknown fallback -----
  return {
    rawEventKind: eventKind,
    diagnosis: FailureDiagnosis.unknown_failure,
    confidence: DiagnosisConfidence.low,
    evidenceSummary: [
      "Insufficient evidence to classify — defaulting to unknown",
    ],
  };
}
