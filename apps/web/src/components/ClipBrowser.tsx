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

  // If the pinned actionNumber is not in this filter set's initial page,
  // clear it from the URL so the address reflects what's actually selected.
  useEffect(() => {
    if (initialActionNumber === null) return;
    const found = initialClips.some(
      (c) => c.actionNumber === initialActionNumber,
    );
    if (!found) {
      setActionNumberInUrl(null);
    }
    // Intentionally run only on mount; initialClips/initialActionNumber are
    // stable props that define the remount boundary (via filterKey).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When user clicks a rail item, update both selection state and the URL.
  const handleSelect = useCallback((index: number) => {
    setActiveIndex(index);
    const clip = clipsRef.current[index];
    setActionNumberInUrl(clip?.actionNumber ?? null);
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

  return (
    <div className="flex flex-col gap-2 px-3 py-3">
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
        <ClipPlayer clip={clips[activeIndex] ?? null} />
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
