"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildApiUrl } from "@/lib/api";
import {
  DEFAULT_PLAY_TYPE,
  DEFAULT_RESULT,
  buildPlayerClipSearchParams,
} from "@/lib/filters";
import type { Clip, PlayerSearchResult, PlayerGameLogEntry } from "@/lib/types";
import ClipPlayer from "@/components/ClipPlayer";
import ClipRail from "@/components/ClipRail";
import PlayerSearch from "@/components/PlayerSearch";
import PlayerGameList from "@/components/PlayerGameList";

const PLAY_TYPES = [
  DEFAULT_PLAY_TYPE,
  "assists",
  "rebounds",
  "turnovers",
  "fouls",
  "steals",
  "blocks",
];

function setActionNumberInUrl(actionNumber: number | null) {
  const url = new URL(window.location.href);
  if (actionNumber !== null) {
    url.searchParams.set("actionNumber", String(actionNumber));
  } else {
    url.searchParams.delete("actionNumber");
  }
  window.history.replaceState(null, "", url.toString());
}

export default function PlayerModeBrowser({ season }: { season: string }) {
  const router = useRouter();
  const params = useSearchParams();

  // Player selection state
  const [selectedPlayer, setSelectedPlayer] =
    useState<PlayerSearchResult | null>(null);
  const [gameLog, setGameLog] = useState<PlayerGameLogEntry[]>([]);
  const [gameLogLoading, setGameLogLoading] = useState(false);

  // Exclusions
  const [excludedGameIds, setExcludedGameIds] = useState<Set<string>>(
    new Set(),
  );
  const [excludedDates, setExcludedDates] = useState<Set<string>>(new Set());

  // Clip state
  const [clips, setClips] = useState<Clip[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [clipsLoading, setClipsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Filters from URL
  const playType = params.get("playType") || DEFAULT_PLAY_TYPE;
  const result = params.get("result") || DEFAULT_RESULT;
  const quarter = params.get("quarter") || "";

  const limit = 12;

  const loadingRef = useRef(false);
  const clipsRef = useRef(clips);
  clipsRef.current = clips;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const pendingAdvanceRef = useRef(false);

  // Restore player from URL on mount
  useEffect(() => {
    const personId = params.get("personId");
    const playerName = params.get("playerName");
    if (personId && playerName) {
      setSelectedPlayer({
        personId: Number(personId),
        displayName: playerName,
        teamTricode: params.get("teamTricode") || "",
      });
    }
    const urlExcludeGames = params.get("excludeGameIds");
    if (urlExcludeGames) {
      setExcludedGameIds(new Set(urlExcludeGames.split(",").filter(Boolean)));
    }
    const urlExcludeDates = params.get("excludeDates");
    if (urlExcludeDates) {
      setExcludedDates(new Set(urlExcludeDates.split(",").filter(Boolean)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch game log when player changes
  useEffect(() => {
    if (!selectedPlayer) {
      setGameLog([]);
      setClips([]);
      setTotal(0);
      return;
    }

    let cancelled = false;
    setGameLogLoading(true);

    (async () => {
      try {
        const url = buildApiUrl(
          `/players/${selectedPlayer.personId}/games`,
          new URLSearchParams({ season }),
        );
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setGameLog(data.games ?? []);
        }
      } catch {
        if (!cancelled) setGameLog([]);
      } finally {
        if (!cancelled) setGameLogLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPlayer, season]);

  // Fetch clips when player, exclusions, or filters change
  const fetchClips = useCallback(
    async (offset: number, append: boolean) => {
      if (!selectedPlayer) return;

      if (offset === 0) {
        setInitialLoading(true);
      } else {
        setClipsLoading(true);
      }
      loadingRef.current = true;
      setError(null);

      try {
        const search = buildPlayerClipSearchParams({
          personId: selectedPlayer.personId,
          season,
          limit,
          offset,
          playType,
          result,
          quarter,
          excludeDates: [...excludedDates],
          excludeGameIds: [...excludedGameIds],
        });

        const res = await fetch(buildApiUrl("/clips/player", search));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (append) {
          setClips((prev) => [...prev, ...(data.clips ?? [])]);
        } else {
          setClips(data.clips ?? []);
          setActiveIndex(0);
        }
        setTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
        setNextOffset(data.nextOffset ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load clips");
      } finally {
        loadingRef.current = false;
        setClipsLoading(false);
        setInitialLoading(false);
      }
    },
    [
      selectedPlayer,
      season,
      playType,
      result,
      quarter,
      excludedDates,
      excludedGameIds,
    ],
  );

  // Trigger initial clip fetch when dependencies change
  useEffect(() => {
    if (selectedPlayer && gameLog.length > 0) {
      fetchClips(0, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedPlayer?.personId,
    season,
    playType,
    result,
    quarter,
    // Serialize exclusion sets so effect re-fires on changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...excludedGameIds].sort().join(","),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...excludedDates].sort().join(","),
    gameLog.length,
  ]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore || nextOffset === null) return;
    await fetchClips(nextOffset, true);
  }, [hasMore, nextOffset, fetchClips]);

  // Navigation
  const handleSelect = useCallback((index: number) => {
    setActiveIndex(index);
    const clip = clipsRef.current[index];
    setActionNumberInUrl(clip?.actionNumber ?? null);
  }, []);

  const goToPrev = useCallback(() => {
    setActiveIndex((prev) => {
      if (prev <= 0) return prev;
      const next = prev - 1;
      const clip = clipsRef.current[next];
      setActionNumberInUrl(clip?.actionNumber ?? null);
      return next;
    });
  }, []);

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

  const handleClipEnded = useCallback(() => {
    const current = activeIndexRef.current;
    const maxIndex = clipsRef.current.length - 1;
    if (current < maxIndex) {
      goToNext();
    } else if (hasMoreRef.current) {
      pendingAdvanceRef.current = true;
      loadMore();
    }
  }, [goToNext, loadMore]);

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

  useEffect(() => {
    if (hasMore && clips.length - activeIndex <= 3) {
      loadMore();
    }
  }, [activeIndex, clips.length, hasMore, loadMore]);

  // Keyboard nav
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
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

  // Preload adjacent thumbnails
  useEffect(() => {
    const adjacent = [clips[activeIndex - 1], clips[activeIndex + 1]];
    for (const c of adjacent) {
      if (c?.thumbnailUrl) {
        const img = new Image();
        img.src = c.thumbnailUrl;
      }
    }
  }, [activeIndex, clips]);

  // Update URL with player state
  function updateUrl(overrides: Record<string, string>) {
    const search = new URLSearchParams();
    search.set("mode", "player");
    search.set("season", season);
    if (selectedPlayer) {
      search.set("personId", String(selectedPlayer.personId));
      search.set("playerName", selectedPlayer.displayName);
      if (selectedPlayer.teamTricode)
        search.set("teamTricode", selectedPlayer.teamTricode);
    }
    Object.entries(overrides).forEach(([k, v]) => {
      if (v) search.set(k, v);
    });
    router.push(`/?${search.toString()}`, { scroll: false });
  }

  function handlePlayerSelect(player: PlayerSearchResult) {
    setSelectedPlayer(player);
    setExcludedGameIds(new Set());
    setExcludedDates(new Set());
    setClips([]);
    setTotal(0);
    const search = new URLSearchParams();
    search.set("mode", "player");
    search.set("season", season);
    search.set("personId", String(player.personId));
    search.set("playerName", player.displayName);
    if (player.teamTricode) search.set("teamTricode", player.teamTricode);
    const pt = params.get("playType");
    if (pt) search.set("playType", pt);
    router.push(`/?${search.toString()}`, { scroll: false });
  }

  function handlePlayerClear() {
    setSelectedPlayer(null);
    setGameLog([]);
    setClips([]);
    setTotal(0);
    setExcludedGameIds(new Set());
    setExcludedDates(new Set());
    const search = new URLSearchParams();
    search.set("mode", "player");
    search.set("season", season);
    router.push(`/?${search.toString()}`, { scroll: false });
  }

  function toggleGameId(gameId: string) {
    setExcludedGameIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      return next;
    });
  }

  function toggleDate(date: string) {
    setExcludedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  }

  return (
    <div>
      {/* Search + filter bar */}
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-2">
        <PlayerSearch
          season={season}
          selectedPlayer={selectedPlayer}
          onSelect={handlePlayerSelect}
          onClear={handlePlayerClear}
        />

        {selectedPlayer && (
          <>
            <select
              value={playType}
              onChange={(e) => updateUrl({ playType: e.target.value })}
              className="h-9 rounded bg-zinc-900 px-3 text-sm text-white"
            >
              {PLAY_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {pt}
                </option>
              ))}
            </select>

            {playType === DEFAULT_PLAY_TYPE && (
              <select
                value={result}
                onChange={(e) =>
                  updateUrl({ playType, result: e.target.value })
                }
                className="h-9 rounded bg-zinc-900 px-3 text-sm text-white"
              >
                <option value="all">All Results</option>
                <option value="Made">Made</option>
                <option value="Missed">Missed</option>
              </select>
            )}

            <select
              value={quarter}
              onChange={(e) => updateUrl({ playType, quarter: e.target.value })}
              className="h-9 rounded bg-zinc-900 px-3 text-sm text-white"
            >
              <option value="">All Quarters</option>
              <option value="1">Q1</option>
              <option value="2">Q2</option>
              <option value="3">Q3</option>
              <option value="4">Q4</option>
              <option value="5">OT1</option>
              <option value="6">OT2</option>
              <option value="7">OT3</option>
            </select>
          </>
        )}
      </div>

      {/* Game list with exclusions */}
      {selectedPlayer && gameLog.length > 0 && (
        <div className="pb-2">
          <PlayerGameList
            games={gameLog}
            excludedGameIds={excludedGameIds}
            excludedDates={excludedDates}
            onToggleGameId={toggleGameId}
            onToggleDate={toggleDate}
          />
        </div>
      )}

      {/* Loading states */}
      {gameLogLoading && (
        <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-zinc-400">
          Loading game log...
        </div>
      )}

      {initialLoading && (
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="mb-2 text-sm text-zinc-400">
            Loading clips across {gameLog.length} games... this may take a
            moment on first load.
          </div>
          <div className="mb-4 flex gap-3 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-24 w-44 shrink-0 animate-pulse rounded-lg bg-zinc-900"
              />
            ))}
          </div>
          <div className="aspect-video w-full animate-pulse rounded-xl bg-zinc-900" />
        </div>
      )}

      {/* No player selected */}
      {!selectedPlayer && !gameLogLoading && (
        <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-zinc-400">
          Search for a player to browse their clips across games.
        </div>
      )}

      {/* Error */}
      {error && !initialLoading && (
        <div className="mx-auto max-w-3xl px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Clips viewer */}
      {!initialLoading && clips.length > 0 && (
        <div className="flex flex-col gap-4 px-4 py-4">
          <ClipRail
            clips={clips}
            activeIndex={activeIndex}
            onSelect={handleSelect}
            hasMore={hasMore}
            loading={clipsLoading}
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
            {clips.length} of {total} clips · {playType}
            {playType === DEFAULT_PLAY_TYPE && result !== DEFAULT_RESULT
              ? ` · ${result}`
              : ""}
            {quarter ? ` · Q${quarter}` : ""}
          </div>
        </div>
      )}

      {/* Empty state after load */}
      {!initialLoading &&
        !clipsLoading &&
        selectedPlayer &&
        gameLog.length > 0 &&
        clips.length === 0 &&
        !error && (
          <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-zinc-400">
            No clips found for this player with the current filters.
          </div>
        )}
    </div>
  );
}
