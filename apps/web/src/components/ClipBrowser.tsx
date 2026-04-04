"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildApiUrl } from "@/lib/api";
import {
  DEFAULT_PLAY_TYPE,
  DEFAULT_RESULT,
  buildClipSearchParams,
} from "@/lib/filters";
import type { Clip } from "@/lib/types";
import ClipPlayer from "@/components/ClipPlayer";
import ClipRail from "@/components/ClipRail";

type Props = {
  initialClips: Clip[];
  initialTotal: number;
  initialLimit: number;
  initialHasMore: boolean;
  initialNextOffset: number | null;
  gameId: string;
  player: string;
  result: string;
  playType: string;
  quarter: string;
  team: string;
  initialActionNumber: number | null;
};

function setActionNumberInUrl(actionNumber: number | null) {
  const url = new URL(window.location.href);
  if (actionNumber !== null) {
    url.searchParams.set("actionNumber", String(actionNumber));
  } else {
    url.searchParams.delete("actionNumber");
  }
  window.history.replaceState(null, "", url.toString());
}

export default function ClipBrowser({
  initialClips,
  initialTotal,
  initialLimit,
  initialHasMore,
  initialNextOffset,
  gameId,
  player,
  result,
  playType,
  quarter,
  team,
  initialActionNumber,
}: Props) {
  const [clips, setClips] = useState<Clip[]>(initialClips);
  const [total, setTotal] = useState(initialTotal);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextOffset, setNextOffset] = useState<number | null>(
    initialNextOffset,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize active index from the pinned actionNumber, fall back to 0.
  const [activeIndex, setActiveIndex] = useState(() => {
    if (initialActionNumber === null) return 0;
    const idx = initialClips.findIndex(
      (c) => c.actionNumber === initialActionNumber,
    );
    return idx >= 0 ? idx : 0;
  });

  const loadingRef = useRef(false);

  // Keep a ref to clips so handleSelect never closes over a stale array.
  const clipsRef = useRef(clips);
  clipsRef.current = clips;

  // Refs for auto-advance so the onEnded callback never reads stale state.
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const pendingAdvanceRef = useRef(false);

  // Deep-link restore: if the URL has an actionNumber that isn't in the first
  // loaded page, clear it from the URL and stay at clip 0.
  // No blocking catch-up fetch — reliable page-1 loading takes priority.
  useEffect(() => {
    if (
      initialActionNumber !== null &&
      !initialClips.some((c) => c.actionNumber === initialActionNumber)
    ) {
      setActionNumberInUrl(initialClips[0]?.actionNumber ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When user clicks a rail item, update both selection state and the URL.
  const handleSelect = useCallback((index: number) => {
    setActiveIndex(index);
    const clip = clipsRef.current[index];
    setActionNumberInUrl(clip?.actionNumber ?? null);
  }, []);

  // Navigate to the previous clip.
  const goToPrev = useCallback(() => {
    setActiveIndex((prev) => {
      if (prev <= 0) return prev;
      const next = prev - 1;
      const clip = clipsRef.current[next];
      setActionNumberInUrl(clip?.actionNumber ?? null);
      return next;
    });
  }, []);

  // Navigate to the next clip, auto-loading more if near the end.
  const goToNext = useCallback(() => {
    setActiveIndex((prev) => {
      const maxIndex = clipsRef.current.length - 1;
      if (prev >= maxIndex) return prev;
      const next = prev + 1;
      const clip = clipsRef.current[next];
      setActionNumberInUrl(clip?.actionNumber ?? null);
      return next;
    });
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore || nextOffset === null) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const search = buildClipSearchParams({
        gameId,
        limit: initialLimit,
        offset: nextOffset,
        player,
        result,
        playType,
        quarter,
        team,
      });

      const res = await fetch(buildApiUrl("/clips/game", search));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setClips((prev) => [...prev, ...(data.clips ?? [])]);
      setTotal((prev) => data.total ?? prev);
      setHasMore(data.hasMore ?? false);
      setNextOffset(data.nextOffset ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load clips");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [
    hasMore,
    nextOffset,
    gameId,
    player,
    result,
    playType,
    quarter,
    team,
    initialLimit,
  ]);

  // Auto-advance: when the active clip's video ends, move to the next clip.
  // If at the end of the loaded list but more clips exist, trigger loadMore
  // and set a pending flag so we advance once they arrive.
  const handleClipEnded = useCallback(() => {
    const current = activeIndexRef.current;
    const maxIndex = clipsRef.current.length - 1;

    if (current < maxIndex) {
      goToNext();
    } else if (hasMoreRef.current) {
      pendingAdvanceRef.current = true;
      loadMore();
    }
    // else: final clip in the entire set — stop cleanly
  }, [goToNext, loadMore]);

  // Resolve pending advance when new clips arrive after loadMore completes.
  useEffect(() => {
    if (pendingAdvanceRef.current) {
      const current = activeIndexRef.current;
      const maxIndex = clips.length - 1;
      if (current < maxIndex) {
        pendingAdvanceRef.current = false;
        goToNext();
      }
    }
  }, [clips.length, goToNext]);

  // Auto-load more clips when within 3 of the end.
  useEffect(() => {
    if (hasMore && clips.length - activeIndex <= 3) {
      loadMore();
    }
  }, [activeIndex, clips.length, hasMore, loadMore]);

  // Keyboard navigation: ArrowLeft / ArrowRight.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't hijack keyboard input from text fields or other inputs.
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [goToPrev, goToNext]);

  // Preload adjacent clip poster images (lightweight, poster only).
  useEffect(() => {
    const adjacent = [clips[activeIndex - 1], clips[activeIndex + 1]];
    for (const c of adjacent) {
      if (c?.thumbnailUrl) {
        const img = new Image();
        img.src = c.thumbnailUrl;
      }
    }
  }, [activeIndex, clips]);

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <ClipRail
        clips={clips}
        activeIndex={activeIndex}
        onSelect={handleSelect}
        hasMore={hasMore}
        loading={loading}
        error={error}
        onLoadMore={loadMore}
      />

      <div className="mx-auto w-full max-w-4xl">
        <ClipPlayer
          clip={clips[activeIndex] ?? null}
          onEnded={handleClipEnded}
        />
      </div>

      <div className="text-center text-xs text-zinc-600">
        {clips.length} of {total} clips
        {"  ·  "}
        {team || "All Teams"} · {quarter ? `Q${quarter}` : "All Quarters"} ·{" "}
        {playType}
        {player ? ` · ${player}` : ""}
        {playType === DEFAULT_PLAY_TYPE && result !== DEFAULT_RESULT
          ? ` · ${result}`
          : ""}
      </div>
    </div>
  );
}
