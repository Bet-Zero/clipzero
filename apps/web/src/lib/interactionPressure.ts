"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Time window in which jumps are counted toward pressure. */
const PRESSURE_WINDOW_MS = 2000;

/** Number of jump-weight units within the window that triggers high pressure. */
const PRESSURE_THRESHOLD = 4;

/**
 * How long to hold pressure after the last triggering event.
 * Self-clearing after this period if no further events arrive.
 */
const PRESSURE_DECAY_MS = 2000;

// ---------------------------------------------------------------------------
// Module-level state (singleton — shared across all browser instances,
// which are always mutually exclusive in the rendered tree)
// ---------------------------------------------------------------------------

/** Timestamps of recent navigation events, weighted by event type. */
const eventTimestamps: number[] = [];

/** Registered React state setters from useInteractionPressure subscribers. */
const listeners = new Set<(v: boolean) => void>();

let decayTimer: ReturnType<typeof setTimeout> | null = null;
let currentPressure = false;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function notify(value: boolean): void {
  if (currentPressure === value) return;
  currentPressure = value;
  for (const l of listeners) l(value);
}

function pruneOld(): void {
  const cutoff = Date.now() - PRESSURE_WINDOW_MS;
  let i = 0;
  while (i < eventTimestamps.length && eventTimestamps[i] < cutoff) i++;
  if (i > 0) eventTimestamps.splice(0, i);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record a clip navigation event.
 *
 * Use `weight = 1` for single-step navigation (prev/next, arrow keys,
 * explicit rail click).
 *
 * Use `weight = 2` for context-changing events (filter change, team switch,
 * mode change, date change) — these are treated as two jump-equivalents so
 * that a few rapid context changes also trip the pressure signal.
 *
 * When 4+ weight units accumulate within 2 seconds, `isHighPressure` becomes
 * true and auto-prefetch is suppressed. The signal self-clears 2 seconds
 * after the last triggering event.
 */
export function recordClipNavigation(weight = 1): void {
  const now = Date.now();
  for (let i = 0; i < weight; i++) eventTimestamps.push(now);
  pruneOld();

  if (eventTimestamps.length >= PRESSURE_THRESHOLD) {
    notify(true);
    // Reset the decay timer — pressure persists while events keep arriving.
    if (decayTimer) clearTimeout(decayTimer);
    decayTimer = setTimeout(() => {
      decayTimer = null;
      pruneOld();
      if (eventTimestamps.length < PRESSURE_THRESHOLD) {
        notify(false);
      }
    }, PRESSURE_DECAY_MS);
  }
}

/**
 * React hook — returns true when the interaction-pressure signal is active.
 *
 * Components use this to suppress automatic prefetch during aggressive
 * skipping or rapid context changes, reducing unnecessary upstream load.
 *
 * The signal is temporary: it self-clears ~2 seconds after the last
 * triggering event, at which point normal prefetch behavior resumes.
 */
export function useInteractionPressure(): boolean {
  const [isHighPressure, setIsHighPressure] = useState(currentPressure);

  useEffect(() => {
    listeners.add(setIsHighPressure);
    return () => {
      listeners.delete(setIsHighPressure);
    };
  }, []);

  return isHighPressure;
}
