"use client";

import { useEffect, useState } from "react";
import type { Clip } from "@/lib/types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Time window over which failures are counted toward stress mode. */
const STRESS_WINDOW_MS = 10_000;

/** Number of failure events within the window that triggers stress mode. */
const STRESS_THRESHOLD = 3;

/**
 * How long to hold stress mode after the last triggering event.
 * Self-clearing after this period if no further failures arrive.
 */
const STRESS_DURATION_MS = 20_000;

/** How many clips in a batch may be missing video URLs before it counts as a
 * partial failure event. Only relevant when the CDN is reportedly available. */
const MISSING_VIDEO_CLIP_THRESHOLD = 2;

/** Normal load-more cooldown between consecutive page fetches (ms). */
export const LOAD_MORE_COOLDOWN_NORMAL_MS = 300;

/** Load-more cooldown when in stress mode — 2× normal to reduce pressure. */
export const LOAD_MORE_COOLDOWN_STRESS_MS = 600;

// ---------------------------------------------------------------------------
// Module-level state (singleton)
// ---------------------------------------------------------------------------

const failureTimestamps: number[] = [];
const listeners = new Set<(v: boolean) => void>();
let stressDecayTimer: ReturnType<typeof setTimeout> | null = null;
let currentStress = false;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function pruneOld(): void {
  const cutoff = Date.now() - STRESS_WINDOW_MS;
  let i = 0;
  while (i < failureTimestamps.length && failureTimestamps[i] < cutoff) i++;
  if (i > 0) failureTimestamps.splice(0, i);
}

function setStress(value: boolean): void {
  if (currentStress === value) return;
  currentStress = value;
  for (const l of listeners) l(value);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record one upstream failure event (HTTP error, network error on a clip
 * page fetch). After STRESS_THRESHOLD events in STRESS_WINDOW_MS, stress
 * mode activates and the app becomes more conservative about prefetch and
 * load-more cadence.
 */
export function recordFetchFailure(): void {
  const now = Date.now();
  failureTimestamps.push(now);
  pruneOld();

  if (failureTimestamps.length >= STRESS_THRESHOLD) {
    setStress(true);
    if (stressDecayTimer) clearTimeout(stressDecayTimer);
    stressDecayTimer = setTimeout(() => {
      stressDecayTimer = null;
      pruneOld();
      if (failureTimestamps.length < STRESS_THRESHOLD) {
        setStress(false);
      }
    }, STRESS_DURATION_MS);
  }
}

/**
 * Check a freshly received clip batch for partial video-URL failures.
 *
 * If MISSING_VIDEO_CLIP_THRESHOLD or more clips are missing video URLs while
 * the CDN is reportedly available, count it as one failure event. Repeated
 * partial failures accumulate toward stress mode.
 *
 * When `videoCdnAvailable` is false, all clips are expected to have missing
 * URLs (the whole CDN is down) and this is not counted as a stress signal.
 */
export function checkClipBatchForStress(
  clips: Clip[],
  videoCdnAvailable: boolean,
): void {
  if (!videoCdnAvailable) return;
  const missingCount = clips.filter((c) => !c.videoUrl).length;
  if (missingCount >= MISSING_VIDEO_CLIP_THRESHOLD) {
    recordFetchFailure();
  }
}

/**
 * Returns the appropriate load-more cooldown for the current system state.
 * Call this at load-more decision time (not as a hook) since it reads
 * module-level state directly.
 *
 * Normal: 300ms — sufficient smoothing without noticeable delay.
 * Stressed: 600ms — reduces upstream request cadence when things are failing.
 */
export function loadMoreCooldownMs(): number {
  return currentStress
    ? LOAD_MORE_COOLDOWN_STRESS_MS
    : LOAD_MORE_COOLDOWN_NORMAL_MS;
}

/**
 * React hook — returns true when the system is in stress mode.
 *
 * In stress mode the browsers:
 * - suspend auto-prefetch (combined with isHighPressure from interactionPressure)
 * - apply a wider load-more cooldown via `loadMoreCooldownMs()`
 * - stop chasing clips aggressively
 *
 * Stress mode auto-clears ~20 seconds after the last failure event.
 */
export function useStressMode(): boolean {
  const [isStressed, setIsStressed] = useState(currentStress);

  useEffect(() => {
    listeners.add(setIsStressed);
    return () => {
      listeners.delete(setIsStressed);
    };
  }, []);

  return isStressed;
}
