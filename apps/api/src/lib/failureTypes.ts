// ---------------------------------------------------------------------------
// Failure Diagnosis Types
// ---------------------------------------------------------------------------
// Shared vocabulary for classifying clip/video failures across the system.
// See docs/plans/failure-diagnosis-plan.md for design rationale.
// ---------------------------------------------------------------------------

/** Named failure categories — the primary output of the diagnosis system. */
export const FailureDiagnosis = {
  /** Request intentionally aborted because user moved on. */
  stale_request_canceled: "stale_request_canceled",
  /** Result arrived but was discarded because a newer generation won. */
  frontend_request_discarded: "frontend_request_discarded",
  /** Browser could not reach the API (fetch threw, tunnel down, etc.). */
  frontend_network_failure: "frontend_network_failure",
  /** API failed internally before/during processing. */
  api_internal_failure: "api_internal_failure",
  /** Upstream request failed due to timeout or transport error. */
  upstream_timeout_or_transport_failure:
    "upstream_timeout_or_transport_failure",
  /** Upstream responded with a non-success HTTP status. */
  upstream_http_failure: "upstream_http_failure",
  /** Play exists but video asset lookup produced no usable URL. */
  video_asset_not_found: "video_asset_not_found",
  /** Video URL existed but behavior suggests placeholder content. */
  video_asset_placeholder_suspected: "video_asset_placeholder_suspected",
  /** Asset endpoint returned valid structure but no usable video data. */
  video_asset_empty_response: "video_asset_empty_response",
  /** Pattern evidence suggests bursty demand / throttling-like behavior. */
  upstream_pressure_suspected: "upstream_pressure_suspected",
  /** Broad window of failures suggests upstream video system is unhealthy. */
  widespread_upstream_video_degradation:
    "widespread_upstream_video_degradation",
  /** Small number of specific plays fail while neighbors succeed. */
  isolated_clip_gap: "isolated_clip_gap",
  /** Not enough evidence to classify further. */
  unknown_failure: "unknown_failure",
} as const;

export type FailureDiagnosis =
  (typeof FailureDiagnosis)[keyof typeof FailureDiagnosis];

/** Confidence level attached to a diagnosis. */
export const DiagnosisConfidence = {
  high: "high",
  medium: "medium",
  low: "low",
} as const;

export type DiagnosisConfidence =
  (typeof DiagnosisConfidence)[keyof typeof DiagnosisConfidence];

/** Kind of raw event captured during a clip-related request. */
export const RawEventKind = {
  fetch_started: "fetch_started",
  upstream_failed: "upstream_failed",
  asset_returned_empty: "asset_returned_empty",
  asset_returned_url: "asset_returned_url",
  request_aborted: "request_aborted",
  stale_response_discarded: "stale_response_discarded",
  upstream_timeout: "upstream_timeout",
  upstream_http_error: "upstream_http_error",
  internal_exception: "internal_exception",
  cache_hit: "cache_hit",
} as const;

export type RawEventKind = (typeof RawEventKind)[keyof typeof RawEventKind];

/** What the user was doing when the request was triggered. */
export const UserIntentType = {
  initial_load: "initial_load",
  filter_change: "filter_change",
  mode_change: "mode_change",
  date_change: "date_change",
  load_more: "load_more",
  autoplay_prefetch: "autoplay_prefetch",
  manual_skip_pressure: "manual_skip_pressure",
} as const;

export type UserIntentType =
  (typeof UserIntentType)[keyof typeof UserIntentType];

// ---------------------------------------------------------------------------
// Evidence model
// ---------------------------------------------------------------------------

/** Structured evidence captured for a single clip-related event. */
export interface FailureEvidence {
  // --- Common request context ---
  eventId: string;
  timestamp: string;
  route: string;
  mode?: string;
  requestId: string;
  userIntentType?: UserIntentType;

  // --- Clip identity context ---
  gameId?: string;
  actionNumber?: number;
  videoActionNumber?: number;
  personId?: number;
  season?: string;
  playType?: string;
  filterKey?: string;
  offset?: number;

  // --- Upstream request facts ---
  upstreamEndpoint?: string;
  attemptCount?: number;
  startTime?: string;
  durationMs?: number;
  httpStatus?: number;
  timedOut?: boolean;
  networkErrorCode?: string;
  networkErrorName?: string;
  responseBodyValid?: boolean;
  urlFieldPresent?: boolean;
  thumbnailFieldPresent?: boolean;

  // --- Cache / dedupe context ---
  memoryCacheHit?: boolean;
  persistentCacheHit?: boolean;
  inFlightDedupeHit?: boolean;
  freshUpstreamFetch?: boolean;

  // --- Local control-flow context ---
  aborted?: boolean;
  staleDiscarded?: boolean;
  supersededByGeneration?: number;
  retryPerformed?: boolean;
  retryLaterSucceeded?: boolean;

  // --- Error details ---
  errorName?: string;
  errorMessage?: string;

  // --- Probe evidence (NBA video CDN health probe) ---
  probeStatusCode?: number;
  probeEtag?: string | null;
  probeContentLength?: number | null;
  probeTimestamp?: string;
  probeError?: string;
}

/** Result of classifying a raw event. */
export interface ClassifiedEvent {
  rawEventKind: RawEventKind;
  diagnosis: FailureDiagnosis;
  confidence: DiagnosisConfidence;
  evidenceSummary: string[];
}

/** Rolling-window context provided to the classifier for pattern-based rules. */
export interface WindowContext {
  /** Total asset lookups in the window. */
  totalLookups: number;
  /** Successful asset lookups in the window. */
  successes: number;
  /** Empty-response events in the window. */
  emptyResponses: number;
  /** Placeholder-suspected events in the window. */
  placeholderEvents: number;
  /** HTTP failures by status code in the window. */
  httpFailuresByStatus: Record<number, number>;
  /** Timeout count in the window. */
  timeouts: number;
  /** Failures for the same clip key in the window. */
  sameKeyFailures: number;
  /** Count of unique clip keys that failed in the window. */
  uniqueKeyFailures: number;
  /** Window duration in seconds. */
  windowSeconds: number;
}
