// ---------------------------------------------------------------------------
// Frontend Failure Event Logger
// ---------------------------------------------------------------------------
// Lightweight structured logger for frontend-side failure events.
// Logs to console with structured JSON; can later be extended to send
// events to an API debug endpoint.
// ---------------------------------------------------------------------------

import { FailureDiagnosis, type UserIntentType } from "./failureTypes";

/** Evidence captured on the frontend for a failure event. */
export interface FrontendFailureEvidence {
  /** Which browser component emitted the event. */
  component: string;
  /** The failure diagnosis category. */
  diagnosis: FailureDiagnosis;
  /** What the user was doing when the request was triggered. */
  intentType?: UserIntentType;
  /** Request URL (API endpoint). */
  url?: string;
  /** HTTP status code from the response, if any. */
  httpStatus?: number;
  /** Error message string, if applicable. */
  errorMessage?: string;
  /** Request generation that produced this event. */
  generation?: number;
  /** Current generation at the time the event is logged. */
  currentGeneration?: number;
  /** Duration in ms from request start to event, if measured. */
  durationMs?: number;
  /** Arbitrary additional context. */
  extra?: Record<string, unknown>;
}

/**
 * Log a structured frontend failure event.
 *
 * Currently writes to `console.debug` so events are visible in browser
 * dev tools without cluttering the normal console. Can be extended to
 * batch-send events to an API debug endpoint.
 */
export function logFrontendFailureEvent(
  evidence: FrontendFailureEvidence,
): void {
  // eslint-disable-next-line no-console
  console.debug("[clipzero:failure]", evidence.diagnosis, evidence);
}

// ---------------------------------------------------------------------------
// User-facing failure messages
// ---------------------------------------------------------------------------
// Maps diagnosis types to simple, non-technical messages for end users.
// Silent diagnoses (e.g. stale cancellations) return null — the UI should
// not show any message for those.
// ---------------------------------------------------------------------------

const userMessages: Partial<Record<FailureDiagnosis, string>> = {
  [FailureDiagnosis.frontend_network_failure]:
    "Could not reach the server. Check your connection and try again.",
  [FailureDiagnosis.api_internal_failure]:
    "Something went wrong on our end. Please try again.",
  [FailureDiagnosis.upstream_timeout_or_transport_failure]:
    "The clip source is not responding. Please try again shortly.",
  [FailureDiagnosis.upstream_http_failure]:
    "The clip source returned an error. Please try again shortly.",
  [FailureDiagnosis.video_asset_not_found]: "This clip is unavailable.",
  [FailureDiagnosis.video_asset_placeholder_suspected]:
    "This clip may not be available yet.",
  [FailureDiagnosis.video_asset_empty_response]: "This clip is unavailable.",
  [FailureDiagnosis.upstream_pressure_suspected]:
    "Clip loading is temporarily unstable. Please wait a moment.",
  [FailureDiagnosis.widespread_upstream_video_degradation]:
    "Clip loading is experiencing widespread issues. Please try again later.",
  [FailureDiagnosis.isolated_clip_gap]: "This clip is unavailable.",
  [FailureDiagnosis.unknown_failure]: "Something went wrong. Please try again.",
};

/** Silent diagnoses — the UI should not display any message for these. */
const silentDiagnoses = new Set<FailureDiagnosis>([
  FailureDiagnosis.stale_request_canceled,
  FailureDiagnosis.frontend_request_discarded,
]);

/**
 * Get a user-facing message for a failure diagnosis.
 * Returns `null` for silent diagnoses (aborts/discards) that should not be shown.
 */
export function getUserFailureMessage(
  diagnosis: FailureDiagnosis,
): string | null {
  if (silentDiagnoses.has(diagnosis)) return null;
  return userMessages[diagnosis] ?? "Something went wrong. Please try again.";
}
