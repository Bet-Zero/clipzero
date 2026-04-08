"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Reads a stable DOM node by id using a no-op `useSyncExternalStore` subscription,
 * so the element is resolved only at mount time.
 *
 * This is intended for portal targets that already exist when the component
 * mounts. It will not react if the element is later added to or removed from
 * the DOM; consumers that need reactive DOM detection should use a different
 * subscription mechanism such as a `MutationObserver`.
 */
export function useDomElementById(id: string): HTMLElement | null {
  return useSyncExternalStore(
    subscribe,
    () => document.getElementById(id),
    () => null,
  );
}
