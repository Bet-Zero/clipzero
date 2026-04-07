"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function useDomElementById(id: string): HTMLElement | null {
  return useSyncExternalStore(
    subscribe,
    () => document.getElementById(id),
    () => null,
  );
}
