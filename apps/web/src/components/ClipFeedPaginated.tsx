"use client";

import { useRef, useState } from "react";
import ClipFeed from "@/components/ClipFeed";

type Clip = {
  gameId: string;
  actionNumber?: number;
  period?: number;
  clock?: string;
  teamId?: number;
  teamTricode?: string;
  personId?: number;
  playerName?: string;
  actionType?: string;
  subType?: string;
  shotResult?: string;
  shotDistance?: number;
  x?: number;
  y?: number;
  description?: string;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
};

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

export default function ClipFeedPaginated({
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
  const [nextOffset, setNextOffset] = useState<number | null>(
    initialNextOffset,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  async function loadMore() {
    if (loadingRef.current || !hasMore || nextOffset === null) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const search = new URLSearchParams();
      search.set("gameId", gameId);
      search.set("limit", String(initialLimit));
      search.set("offset", String(nextOffset));
      if (player) search.set("player", player);
      if (result && result !== "all") search.set("result", result);
      if (playType) search.set("playType", playType);
      if (quarter) search.set("quarter", quarter);
      if (team) search.set("team", team);

      const res = await fetch(
        `http://localhost:4000/clips/game?${search.toString()}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setClips((prev) => [...prev, ...(data.clips ?? [])]);
      setTotal(data.total ?? total);
      setHasMore(data.hasMore ?? false);
      setNextOffset(data.nextOffset ?? null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load more clips";
      setError(message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 pt-2 text-sm text-zinc-400">
        Showing {clips.length} of {total} clips
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-1 text-xs text-zinc-500">
        {team || "All Teams"} • {quarter ? `Q${quarter}` : "All Quarters"} •{" "}
        {playType}
        {player ? ` • ${player}` : ""}
        {playType === "shots" && result !== "all" ? ` • ${result}` : ""}
      </div>

      <ClipFeed clips={clips} />

      {error && (
        <div className="mx-auto max-w-3xl px-4 pb-2">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {hasMore && (
        <div className="mx-auto max-w-3xl px-4 pb-10">
          <button
            onClick={loadMore}
            disabled={loading}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Loading..." : error ? "Retry" : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}
