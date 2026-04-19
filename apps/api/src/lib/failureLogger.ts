// ---------------------------------------------------------------------------
// Structured Failure Event Logger
// ---------------------------------------------------------------------------
// Central logging function for clip/video failure evidence.
// All instrumented paths should use this instead of ad-hoc logger calls.
// After logging, the event is classified and recorded into rolling windows.
// ---------------------------------------------------------------------------

import { classifyEvent } from "./failureClassifier";
import type {
  ClassifiedEvent,
  FailureEvidence,
  RawEventKind,
} from "./failureTypes";
import { recordEvent, getWindowContext } from "./failureWindows";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Recent classified events ring buffer (for /debug/failures/recent)
// ---------------------------------------------------------------------------
const MAX_RECENT_EVENTS = 200;

interface RecentClassifiedEvent {
  eventKind: RawEventKind;
  evidence: FailureEvidence;
  classified: ClassifiedEvent;
  recordedAt: string;
}

const recentEvents: RecentClassifiedEvent[] = [];

/**
 * Log a structured failure event. Emits a single JSON log line, classifies
 * the event, and records it into rolling windows for pattern tracking.
 */
export function logFailureEvent(
  eventKind: RawEventKind,
  evidence: FailureEvidence,
): void {
  // 1. Record into rolling windows first so the classifier has up-to-date context.
  recordEvent(evidence);

  // 2. Build window context for classification.
  const clipKey = evidence.gameId
    ? `${evidence.gameId}:${evidence.actionNumber ?? evidence.videoActionNumber ?? "?"}`
    : undefined;
  const window = getWindowContext(30, clipKey);

  // 3. Classify the event.
  const classified = classifyEvent(eventKind, evidence, window);

  // 4. Structured log with classification attached.
  logger.info("failure_event", {
    eventKind,
    diagnosis: classified.diagnosis,
    confidence: classified.confidence,
    ...evidence,
  });

  // 5. Store in ring buffer for debug endpoint.
  recentEvents.push({
    eventKind,
    evidence,
    classified,
    recordedAt: new Date().toISOString(),
  });
  while (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.shift();
  }
}

/** Return recent classified events (for the debug endpoint). */
export function getRecentClassifiedEvents(): readonly RecentClassifiedEvent[] {
  return recentEvents;
}

/** Reset recent events — for testing only. */
export function _resetRecentEventsForTesting(): void {
  recentEvents.length = 0;
}
