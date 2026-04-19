// ---------------------------------------------------------------------------
// Frontend Failure Event Logger
// ---------------------------------------------------------------------------
// Lightweight structured logger for frontend-side failure events.
// Logs to console with structured JSON; can later be extended to send
// events to an API debug endpoint.
// ---------------------------------------------------------------------------

import type { FailureDiagnosis, UserIntentType } from "./failureTypes";

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
