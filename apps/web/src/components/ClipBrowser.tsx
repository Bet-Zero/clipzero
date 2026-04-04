"use client";

import { useCallback, useRef, useState } from "react";
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
};

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
}: Props) {
  const [clips, setClips] = useState<Clip[]>(initialClips);
  const [total, setTotal] = useState(initialTotal);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextOffset, setNextOffset] = useState<number | null>(initialNextOffset);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const loadingRef = useRef(false);

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
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="text-xs text-zinc-500">
        <span className="text-sm text-zinc-400">
          {clips.length} of {total} clips
        </span>
        {"  ·  "}
        {team || "All Teams"} · {quarter ? `Q${quarter}` : "All Quarters"} ·{" "}
        {playType}
        {player ? ` · ${player}` : ""}
        {playType === DEFAULT_PLAY_TYPE && result !== DEFAULT_RESULT
          ? ` · ${result}`
          : ""}
      </div>

      <ClipRail
        clips={clips}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
        hasMore={hasMore}
        loading={loading}
        error={error}
        onLoadMore={loadMore}
      />

      <div className="mx-auto w-full max-w-4xl">
        <ClipPlayer clip={clips[activeIndex] ?? null} />
      </div>
    </div>
  );
}
