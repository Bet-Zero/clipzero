// ---------------------------------------------------------------------------
// Rolling Window Failure Tracker
// ---------------------------------------------------------------------------
// In-memory rolling window tracker for clip/video failure events.
// Enables pattern-based diagnosis by the classifier (Phase 4).
// See docs/plans/failure-diagnosis-plan.md for design rationale.
// ---------------------------------------------------------------------------

import type { FailureEvidence, WindowContext } from "./failureTypes";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Configurable window durations in seconds. */
export const WINDOW_DURATIONS_S = [10, 30, 120] as const;

/** Maximum events to keep before forced pruning. */
const MAX_EVENTS = 2000;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface TrackedEvent {
  timestamp: number; // Date.now() ms
  clipKey: string; // gameId:actionNumber — unique per clip
  success: boolean;
  empty: boolean;
  placeholder: boolean;
  httpStatus?: number;
  timedOut: boolean;
}

// ---------------------------------------------------------------------------
// Module state (singleton)
// ---------------------------------------------------------------------------

const events: TrackedEvent[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clipKeyFrom(evidence: FailureEvidence): string {
  const game = evidence.gameId ?? "?";
  const action = evidence.actionNumber ?? evidence.videoActionNumber ?? "?";
  return `${game}:${action}`;
}

function pruneOldEvents(): void {
  const cutoff =
    Date.now() - WINDOW_DURATIONS_S[WINDOW_DURATIONS_S.length - 1]! * 1000;
  // Remove events older than the largest window.
  while (events.length > 0 && events[0]!.timestamp < cutoff) {
    events.shift();
  }
  // Safety cap: if we somehow accumulate too many events, drop oldest.
  while (events.length > MAX_EVENTS) {
    events.shift();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record a clip/video event into the rolling window tracker.
 *
 * Should be called from the structured event logger after every
 * asset-related fetch outcome.
 */
export function recordEvent(evidence: FailureEvidence): void {
  const isSuccess =
    evidence.urlFieldPresent === true && evidence.responseBodyValid === true;
  const isEmpty =
    evidence.responseBodyValid === true && evidence.urlFieldPresent === false;

  // Consider this a placeholder event when probe evidence is attached
  // (the probe verifies the CDN is serving a catch-all placeholder MP4).
  const isPlaceholder = Boolean(
    evidence.probeEtag !== undefined || evidence.probeStatusCode !== undefined,
  );

  events.push({
    timestamp: Date.now(),
    clipKey: clipKeyFrom(evidence),
    success: isSuccess,
    empty: isEmpty,
    placeholder: isPlaceholder,
    httpStatus: evidence.httpStatus,
    timedOut: evidence.timedOut === true,
  });

  pruneOldEvents();
}

/**
 * Get a WindowContext summary for the classifier.
 *
 * @param windowSeconds  Which window duration to summarize (default: 30s).
 * @param clipKey        Optional clip key — if provided, `sameKeyFailures`
 *                       counts failures for that specific key. Otherwise 0.
 */
export function getWindowContext(
  windowSeconds: number = 30,
  clipKey?: string,
): WindowContext {
  const cutoff = Date.now() - windowSeconds * 1000;
  const windowEvents = events.filter((e) => e.timestamp >= cutoff);

  let totalLookups = 0;
  let successes = 0;
  let emptyResponses = 0;
  let placeholderEvents = 0;
  let timeouts = 0;
  let sameKeyFailures = 0;
  const httpFailuresByStatus: Record<number, number> = {};
  const failedKeys = new Set<string>();

  for (const e of windowEvents) {
    totalLookups++;

    if (e.success) {
      successes++;
    }

    if (e.empty) {
      emptyResponses++;
    }

    if (e.placeholder) {
      placeholderEvents++;
    }

    if (e.timedOut) {
      timeouts++;
    }

    if (e.httpStatus !== undefined && e.httpStatus >= 400) {
      httpFailuresByStatus[e.httpStatus] =
        (httpFailuresByStatus[e.httpStatus] ?? 0) + 1;
    }

    // Track failures (non-success events)
    if (!e.success) {
      failedKeys.add(e.clipKey);
      if (clipKey && e.clipKey === clipKey) {
        sameKeyFailures++;
      }
    }
  }

  return {
    totalLookups,
    successes,
    emptyResponses,
    placeholderEvents,
    httpFailuresByStatus,
    timeouts,
    sameKeyFailures,
    uniqueKeyFailures: failedKeys.size,
    windowSeconds,
  };
}

/**
 * Reset all tracked events. Intended for testing only.
 */
export function _resetForTesting(): void {
  events.length = 0;
}
