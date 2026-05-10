import { afterEach, describe, expect, it, vi } from "vitest";
import {
  beginFilterTransition,
  clearFilterTransition,
  isFilterTransitionPending,
  resetFilterTransitionsForTests,
} from "./filterTransition";

afterEach(() => {
  resetFilterTransitionsForTests();
  vi.useRealTimers();
});

describe("filterTransition", () => {
  it("marks a scope pending at intent-time and clears it", () => {
    expect(isFilterTransitionPending("player")).toBe(false);

    beginFilterTransition("player");
    expect(isFilterTransitionPending("player")).toBe(true);

    clearFilterTransition("player");
    expect(isFilterTransitionPending("player")).toBe(false);
  });

  it("keeps mode scopes independent", () => {
    beginFilterTransition("game");

    expect(isFilterTransitionPending("game")).toBe(true);
    expect(isFilterTransitionPending("player")).toBe(false);
    expect(isFilterTransitionPending("matchup")).toBe(false);
  });

  it("auto-clears stale pending state with fallback timer", () => {
    vi.useFakeTimers();
    beginFilterTransition("matchup");

    expect(isFilterTransitionPending("matchup")).toBe(true);

    vi.advanceTimersByTime(10_001);

    expect(isFilterTransitionPending("matchup")).toBe(false);
  });
});
