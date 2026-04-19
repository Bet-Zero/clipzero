// ---------------------------------------------------------------------------
// Failure Diagnosis Types (frontend mirror)
// ---------------------------------------------------------------------------
// Mirrored subset of apps/api/src/lib/failureTypes.ts for frontend use.
// Values MUST stay identical to the API definitions.
// See docs/plans/failure-diagnosis-plan.md for design rationale.
// ---------------------------------------------------------------------------

/** Named failure categories — identical values to API definitions. */
export const FailureDiagnosis = {
  stale_request_canceled: "stale_request_canceled",
  frontend_request_discarded: "frontend_request_discarded",
  frontend_network_failure: "frontend_network_failure",
  api_internal_failure: "api_internal_failure",
  upstream_timeout_or_transport_failure:
    "upstream_timeout_or_transport_failure",
  upstream_http_failure: "upstream_http_failure",
  video_asset_not_found: "video_asset_not_found",
  video_asset_placeholder_suspected: "video_asset_placeholder_suspected",
  video_asset_empty_response: "video_asset_empty_response",
  upstream_pressure_suspected: "upstream_pressure_suspected",
  widespread_upstream_video_degradation:
    "widespread_upstream_video_degradation",
  isolated_clip_gap: "isolated_clip_gap",
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
