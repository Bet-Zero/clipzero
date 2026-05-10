"use client";

import { useEffect, useState } from "react";

export type FilterTransitionScope = "game" | "player" | "matchup";

const FALLBACK_CLEAR_MS = 10_000;

const pendingByScope = new Map<FilterTransitionScope, boolean>([
  ["game", false],
  ["player", false],
  ["matchup", false],
]);

const listenersByScope = new Map<
  FilterTransitionScope,
  Set<(value: boolean) => void>
>([
  ["game", new Set()],
  ["player", new Set()],
  ["matchup", new Set()],
]);

const fallbackTimerByScope = new Map<
  FilterTransitionScope,
  ReturnType<typeof setTimeout> | null
>([
  ["game", null],
  ["player", null],
  ["matchup", null],
]);

function notify(scope: FilterTransitionScope): void {
  const next = pendingByScope.get(scope) === true;
  const listeners = listenersByScope.get(scope);
  if (!listeners) return;
  for (const listener of listeners) listener(next);
}

function armFallbackClear(scope: FilterTransitionScope): void {
  const prev = fallbackTimerByScope.get(scope);
  if (prev) clearTimeout(prev);
  const timer = setTimeout(() => {
    fallbackTimerByScope.set(scope, null);
    clearFilterTransition(scope);
  }, FALLBACK_CLEAR_MS);
  fallbackTimerByScope.set(scope, timer);
}

export function beginFilterTransition(scope: FilterTransitionScope): void {
  pendingByScope.set(scope, true);
  notify(scope);
  armFallbackClear(scope);
}

export function clearFilterTransition(scope: FilterTransitionScope): void {
  pendingByScope.set(scope, false);
  const prev = fallbackTimerByScope.get(scope);
  if (prev) {
    clearTimeout(prev);
    fallbackTimerByScope.set(scope, null);
  }
  notify(scope);
}

export function isFilterTransitionPending(
  scope: FilterTransitionScope,
): boolean {
  return pendingByScope.get(scope) === true;
}

export function useFilterTransition(scope: FilterTransitionScope): boolean {
  const [isPending, setIsPending] = useState(isFilterTransitionPending(scope));

  useEffect(() => {
    const listeners = listenersByScope.get(scope);
    if (!listeners) return;
    listeners.add(setIsPending);
    return () => {
      listeners.delete(setIsPending);
    };
  }, [scope]);

  return isPending;
}

export function resetFilterTransitionsForTests(): void {
  for (const scope of pendingByScope.keys()) {
    clearFilterTransition(scope);
  }
}
