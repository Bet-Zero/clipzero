// ---------------------------------------------------------------------------
// Structured Failure Event Logger
// ---------------------------------------------------------------------------
// Central logging function for clip/video failure evidence.
// All instrumented paths should use this instead of ad-hoc logger calls.
// ---------------------------------------------------------------------------

import { logger } from "./logger";
import type { FailureEvidence, RawEventKind } from "./failureTypes";

/**
 * Log a structured failure event. Emits a single JSON log line with all
 * available evidence fields so downstream classification can operate on
 * consistent data.
 */
export function logFailureEvent(
  eventKind: RawEventKind,
  evidence: FailureEvidence,
): void {
  logger.info("failure_event", {
    eventKind,
    ...evidence,
  });
}
