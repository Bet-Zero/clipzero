"use client";

import { useEffect, useRef } from "react";
import type { Clip } from "@/lib/types";
import ClipRailItem from "@/components/ClipRailItem";

type Props = {
  clips: Clip[];
  activeIndex: number;
  onSelect: (index: number) => void;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
};

export default function ClipRail({
  clips,
  activeIndex,
  onSelect,
  hasMore,
  loading,
  onLoadMore,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore) return;
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
  }, [hasMore, onLoadMore]);

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
      className="overflow-x-auto pb-2"
    >
      <div className="flex gap-3">
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
              clip={clip}
              index={i}
              isActive={i === activeIndex}
              onClick={() => onSelect(i)}
            />
          );
        })}

        {hasMore && (
          <div ref={sentinelRef} aria-hidden="true" className="w-1 shrink-0 self-stretch" />
        )}

        {loading && (
          <div className="flex shrink-0 items-center px-4 text-sm text-zinc-500">
            Loading...
          </div>
        )}
      </div>
    </div>
  );
}
