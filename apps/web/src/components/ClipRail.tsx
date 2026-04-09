"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Clip } from "@/lib/types";
import ClipRailItem from "@/components/ClipRailItem";

type Props = {
  clips: Clip[];
  activeIndex: number;
  onSelect: (index: number) => void;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  onLoadMore: () => void;
  homeTeamTricode?: string;
};

export default function ClipRail({
  clips,
  activeIndex,
  onSelect,
  hasMore,
  loading,
  error,
  onLoadMore,
  homeTeamTricode,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  // Scroll to center the active item within the rail when selection changes.
  useEffect(() => {
    const el = itemRefs.current.get(activeIndex);
    const container = scrollRef.current;
    if (!el || !container) return;
    const targetScrollLeft =
      el.offsetLeft - container.clientWidth / 2 + el.offsetWidth / 2;
    container.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
  }, [activeIndex]);

  // IntersectionObserver: trigger load when sentinel scrolls near the right edge.
  useEffect(() => {
    if (!hasMore || error) return;
    const sentinel = sentinelRef.current;
    const scroll = scrollRef.current;
    if (!sentinel || !scroll) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { root: scroll, rootMargin: "0px 100px 0px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, error, onLoadMore]);

  const setItemRef = useCallback(
    (i: number) => (el: HTMLButtonElement | null) => {
      if (el) {
        itemRefs.current.set(i, el);
      } else {
        itemRefs.current.delete(i);
      }
    },
    [],
  );

  if (clips.length === 0 && !loading) {
    return (
      <p className="py-6 text-sm text-zinc-400">
        No clips found for this filter.
      </p>
    );
  }

  return (
    <div
      ref={scrollRef}
      data-testid="clip-rail"
      className="shrink-0 overflow-x-auto scrollbar-overlay -mx-1 px-1 -my-2 py-2"
    >
      <div className="flex gap-2">
        {clips.map((clip, i) => {
          const key = [
            clip.gameId,
            clip.actionNumber ?? i,
            clip.period ?? "na",
            clip.clock ?? "na",
            clip.playerName ?? "na",
          ].join(":");

          return (
            <ClipRailItem
              key={key}
              ref={setItemRef(i)}
              clip={clip}
              isActive={i === activeIndex}
              onClick={() => onSelect(i)}
              homeTeamTricode={homeTeamTricode}
            />
          );
        })}

        {/* Sentinel: invisible target for IntersectionObserver. Hidden while
            an error is pending so the observer doesn't fire on a stale position. */}
        {hasMore && !error && (
          <div
            ref={sentinelRef}
            aria-hidden="true"
            className="w-1 shrink-0 self-stretch"
          />
        )}

        {loading && (
          <div className="flex shrink-0 items-center px-4 text-sm text-zinc-500">
            Loading...
          </div>
        )}

        {/* Visible retry card — shown instead of the sentinel after a failure. */}
        {error && !loading && hasMore && (
          <div className="flex w-44 shrink-0 flex-col items-start justify-between gap-2 rounded-lg border border-red-800/50 bg-zinc-950 p-3">
            <p className="text-[11px] leading-snug text-red-400">
              Failed to load more clips
            </p>
            <button
              onClick={onLoadMore}
              className="rounded bg-zinc-800 px-2 py-1 text-xs text-white hover:bg-zinc-700"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
