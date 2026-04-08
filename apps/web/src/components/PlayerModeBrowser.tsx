"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  useRouter,
  useSearchParams,
  type ReadonlyURLSearchParams,
} from "next/navigation";
import { buildApiUrl, getApiUnavailableMessage } from "@/lib/api";
import { useDomElementById } from "@/lib/dom";
import {
  DEFAULT_PLAY_TYPE,
  DEFAULT_RESULT,
  buildPlayerClipSearchParams,
  parsePlayerModeParams,
  buildPlayerModeUrl,
  splitMultiValue,
  hasMultiValue,
  toggleMultiValue,
} from "@/lib/filters";
import type {
  Clip,
  PlayerSearchResult,
  PlayerGameLogEntry,
  PlayerModeFilterState,
} from "@/lib/types";
import ClipPlayer from "@/components/ClipPlayer";
import ClipRail from "@/components/ClipRail";
import PlayerSearch from "@/components/PlayerSearch";
import PlayerGameList from "@/components/PlayerGameList";
import {
  PLAY_TYPES,
  PLAY_TYPE_LABELS,
  getFiltersForPlayType,
  FILTER_PRESETS,
} from "@/lib/filterConfig";
import { type FilterChip } from "@/components/ActiveFilterChips";
import { useWatchMode } from "@/components/PageShell";
import WatchBar, { buildPlayerSummary } from "@/components/WatchBar";

// Reusable multi-select dropdown for player mode filter options.
function PlayerMultiSelectDropdown({
  label,
  summaryLabel,
  options,
  selectedValues,
  onToggle,
  onClear,
  size = "lg",
}: {
  label?: string;
  summaryLabel: string;
  options: { label: string; value: string }[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  onClear?: () => void;
  size?: "sm" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <div
        className={`flex items-center gap-2 ${label ? "text-xs text-zinc-500" : ""}`}
      >
        {label && <span>{label}</span>}
        <button
          onClick={() => setOpen((o) => !o)}
          className={`shrink-0 rounded bg-zinc-900 text-sm text-white hover:bg-zinc-800 ${size === "sm" ? "h-7 px-2" : "h-9 px-3"}`}
        >
          {summaryLabel}
          <span className="ml-1 text-zinc-500">▾</span>
        </button>
      </div>
      {open && (
        <div className="absolute z-30 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-lg">
          {options.map((opt) => {
            const checked = selectedValues.includes(opt.value);
            return (
              <button
                key={opt.value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onToggle(opt.value)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                  checked
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                    checked
                      ? "border-white bg-white text-black"
                      : "border-zinc-600"
                  }`}
                >
                  {checked ? "✓" : ""}
                </span>
                {opt.label}
              </button>
            );
          })}
          {onClear && selectedValues.length > 0 && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="w-full border-t border-zinc-800 px-3 py-1.5 text-left text-xs text-zinc-500 hover:text-zinc-300"
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function setActionNumberInUrl(actionNumber: number | null) {
  const url = new URL(window.location.href);
  if (actionNumber !== null) {
    url.searchParams.set("actionNumber", String(actionNumber));
  } else {
    url.searchParams.delete("actionNumber");
  }
  window.history.replaceState(null, "", url.toString());
}

function normalizeDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toISOString().slice(0, 10);
}

function getCurrentActionNumber(
  params: ReadonlyURLSearchParams,
): number | null {
  const raw =
    typeof window === "undefined"
      ? params.get("actionNumber")
      : new URLSearchParams(window.location.search).get("actionNumber");
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export default function PlayerModeBrowser({ season }: { season: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { isWatchMode, enterWatchMode, exitWatchMode } = useWatchMode();

  // Player selection state
  const [selectedPlayer, setSelectedPlayer] =
    useState<PlayerSearchResult | null>(null);
  const [gameLog, setGameLog] = useState<PlayerGameLogEntry[]>([]);
  const [gameLogLoading, setGameLogLoading] = useState(false);
  const [gameLogError, setGameLogError] = useState<string | null>(null);

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

  // Optimistic pending state — allows controls to update instantly before
  // the URL navigation round-trip completes.
  const [pending, setPending] = useState<{
    sourceKey: string;
    values: Record<string, string>;
  }>({
    sourceKey: params.toString(),
    values: {},
  });
  const paramsKey = params.toString();
  const optimisticValues =
    pending.sourceKey === paramsKey ? pending.values : {};

  // Read a param, preferring any pending optimistic override.
  const p = (key: string) => optimisticValues[key] ?? params.get(key) ?? "";

  // Filters (with optimistic overrides)
  const playType = p("playType") || DEFAULT_PLAY_TYPE;
  const result = p("result") || DEFAULT_RESULT;
  const quarter = p("quarter");
  const shotValue = p("shotValue");
  const subType = p("subType");
  const distanceBucket = p("distanceBucket");
  const opponent = p("opponent");

  const limit = 12;

  const portalTarget = useDomElementById("player-filter-portal");
  const overlayTarget = useDomElementById("filter-overlay-anchor");
  const watchBarPortal = useDomElementById("watch-bar-portal");
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [isGamesOpen, setIsGamesOpen] = useState(false);
  const playerTriggerRef = useRef<HTMLDivElement>(null);
  const playerPanelRef = useRef<HTMLDivElement>(null);
  const gamesTriggerRef = useRef<HTMLDivElement>(null);

  // Auto-enter watch mode when clips first arrive.
  // Reset when player/filter changes so new clip set triggers re-entry.
  const watchModeAutoEntered = useRef(false);
  const hasPlayerClips = clips.length > 0 && selectedPlayer !== null;
  const filterKey = `${selectedPlayer?.personId}:${playType}:${result}:${quarter}:${shotValue}:${subType}:${distanceBucket}:${opponent}`;
  const prevFilterKey = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKey.current !== filterKey) {
      prevFilterKey.current = filterKey;
      watchModeAutoEntered.current = false;
    }
    if (hasPlayerClips && !watchModeAutoEntered.current) {
      watchModeAutoEntered.current = true;
      enterWatchMode();
    }
  }, [hasPlayerClips, filterKey, enterWatchMode]);

  useEffect(() => {
    if (!isOverflowOpen) return;
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        playerTriggerRef.current?.contains(target) ||
        playerPanelRef.current?.contains(target)
      ) {
        return;
      }
      setIsOverflowOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOverflowOpen]);

  useEffect(() => {
    if (!isGamesOpen) return;
    function handleOutside(e: MouseEvent) {
      if (gamesTriggerRef.current?.contains(e.target as Node)) return;
      setIsGamesOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isGamesOpen]);

  const loadingRef = useRef(false);
  const clipsRef = useRef(clips);
  clipsRef.current = clips;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const pendingAdvanceRef = useRef(false);

  // Hydrate player + exclusion state from URL on mount
  useEffect(() => {
    const initial = parsePlayerModeParams(
      new URLSearchParams(params.toString()),
    );
    if (initial.player) setSelectedPlayer(initial.player);
    if (initial.excludedGameIds.size > 0)
      setExcludedGameIds(initial.excludedGameIds);
    if (initial.excludedDates.size > 0) setExcludedDates(initial.excludedDates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch game log when player changes
  useEffect(() => {
    if (!selectedPlayer) {
      setGameLog([]);
      setGameLogError(null);
      setClips([]);
      setTotal(0);
      return;
    }

    let cancelled = false;
    setGameLogLoading(true);
    setGameLogError(null);

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
      } catch (err) {
        if (!cancelled) {
          setGameLog([]);
          setGameLogError(
            err instanceof TypeError
              ? getApiUnavailableMessage()
              : `Could not load game log (${err instanceof Error ? err.message : "error"})`,
          );
        }
      } finally {
        if (!cancelled) setGameLogLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPlayer, season]);

  // Derive unique opponent options from the player's game log matchup strings.
  const opponentOptions = useMemo(() => {
    if (!selectedPlayer || gameLog.length === 0) return [];
    const playerTeam = selectedPlayer.teamTricode;
    const opps = new Set<string>();
    for (const g of gameLog) {
      // matchup format: "DAL @ LAL" or "DAL vs. BOS"
      const parts = g.matchup.split(/\s+(?:@|vs\.?)\s+/);
      for (const p of parts) {
        const tri = p.trim();
        if (tri && tri !== playerTeam) opps.add(tri);
      }
    }
    return [...opps].sort().map((t) => ({ label: `vs ${t}`, value: t }));
  }, [selectedPlayer, gameLog]);

  const includedGameCount = useMemo(
    () =>
      gameLog.reduce((count, game) => {
        const normalizedDate = normalizeDate(game.gameDate);
        if (
          excludedGameIds.has(game.gameId) ||
          excludedDates.has(normalizedDate)
        ) {
          return count;
        }

        return count + 1;
      }, 0),
    [gameLog, excludedGameIds, excludedDates],
  );

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

      // On the initial fetch, read actionNumber from URL to restore position
      // if the clip is already in the first loaded page.
      const pinnedNum = !append ? getCurrentActionNumber(params) : null;

      try {
        const search = buildPlayerClipSearchParams({
          personId: selectedPlayer.personId,
          season,
          limit,
          offset,
          playType,
          result,
          quarter,
          shotValue,
          subType,
          distanceBucket,
          opponent,
          excludeDates: [...excludedDates],
          excludeGameIds: [...excludedGameIds],
        });

        const res = await fetch(buildApiUrl("/clips/player", search));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (append) {
          setClips((prev) => [...prev, ...(data.clips ?? [])]);
          setTotal((prev) => data.total ?? prev);
          setHasMore(data.hasMore ?? false);
          setNextOffset(data.nextOffset ?? null);
        } else {
          const newClips: Clip[] = data.clips ?? [];
          setClips(newClips);
          setTotal(data.total ?? 0);
          setHasMore(data.hasMore ?? false);
          setNextOffset(data.nextOffset ?? null);

          // Restore pinned actionNumber if the clip is in the first loaded page.
          // If it's beyond page 1, clear the URL and fall back to clip 0 —
          // no blocking catch-up fetch.
          if (pinnedNum) {
            const idx = newClips.findIndex((c) => c.actionNumber === pinnedNum);
            if (idx >= 0) {
              setActiveIndex(idx);
            } else {
              setActiveIndex(0);
              setActionNumberInUrl(newClips[0]?.actionNumber ?? null);
            }
          } else {
            setActiveIndex(0);
          }
        }
      } catch (err) {
        setError(
          err instanceof TypeError
            ? getApiUnavailableMessage()
            : `Could not load clips (${err instanceof Error ? err.message : "error"})`,
        );
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
      shotValue,
      subType,
      distanceBucket,
      opponent,
      params,
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
    shotValue,
    subType,
    distanceBucket,
    opponent,
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

  // Read actionNumber from window.location rather than params because
  // replaceState (used by setActionNumberInUrl for rail navigation) does NOT
  // update useSearchParams, so params.get() would return a stale value.
  const liveActionNumber = getCurrentActionNumber(params);

  // Merge current component state with overrides into a complete filter state.
  function getFilterState(
    overrides: Partial<PlayerModeFilterState> = {},
  ): PlayerModeFilterState {
    const hasFilterChange =
      "playType" in overrides ||
      "result" in overrides ||
      "quarter" in overrides ||
      "shotValue" in overrides ||
      "subType" in overrides ||
      "distanceBucket" in overrides ||
      "opponent" in overrides;

    return {
      player:
        "player" in overrides ? (overrides.player ?? null) : selectedPlayer,
      playType: overrides.playType ?? playType,
      result: overrides.result ?? result,
      quarter: overrides.quarter ?? quarter,
      shotValue: overrides.shotValue ?? shotValue,
      subType: overrides.subType ?? subType,
      distanceBucket: overrides.distanceBucket ?? distanceBucket,
      opponent: overrides.opponent ?? opponent,
      excludedGameIds: overrides.excludedGameIds ?? excludedGameIds,
      excludedDates: overrides.excludedDates ?? excludedDates,
      actionNumber:
        "actionNumber" in overrides
          ? (overrides.actionNumber ?? null)
          : hasFilterChange
            ? null
            : liveActionNumber,
    };
  }

  function navigateTo(overrides: Partial<PlayerModeFilterState> = {}) {
    // Apply optimistic updates for string filter params
    const filterKeys = [
      "playType",
      "result",
      "quarter",
      "shotValue",
      "subType",
      "distanceBucket",
      "opponent",
    ] as const;
    const updates: Record<string, string> = {};
    for (const key of filterKeys) {
      if (key in overrides)
        updates[key] = String(
          (overrides as Record<string, unknown>)[key] ?? "",
        );
    }
    if (Object.keys(updates).length > 0) {
      setPending((prev) => ({
        sourceKey: paramsKey,
        values:
          prev.sourceKey === paramsKey
            ? { ...prev.values, ...updates }
            : { ...updates },
      }));
    }
    router.push(buildPlayerModeUrl(season, getFilterState(overrides)), {
      scroll: false,
    });
  }

  function handlePlayerSelect(player: PlayerSearchResult) {
    setSelectedPlayer(player);
    setExcludedGameIds(new Set());
    setExcludedDates(new Set());
    setClips([]);
    setTotal(0);
    navigateTo({
      player,
      opponent: "",
      excludedGameIds: new Set(),
      excludedDates: new Set(),
      actionNumber: null,
    });
  }

  function handlePlayerClear() {
    setSelectedPlayer(null);
    setGameLog([]);
    setClips([]);
    setTotal(0);
    setExcludedGameIds(new Set());
    setExcludedDates(new Set());
    navigateTo({
      player: null,
      opponent: "",
      excludedGameIds: new Set(),
      excludedDates: new Set(),
      actionNumber: null,
    });
  }

  function toggleGameId(gameId: string) {
    const next = new Set(excludedGameIds);
    if (next.has(gameId)) {
      next.delete(gameId);
    } else {
      next.add(gameId);
    }
    setExcludedGameIds(next);
    navigateTo({ excludedGameIds: next });
  }

  function toggleDate(date: string) {
    const next = new Set(excludedDates);
    if (next.has(date)) {
      next.delete(date);
    } else {
      next.add(date);
    }
    setExcludedDates(next);
    navigateTo({ excludedDates: next });
  }

  const activeChips = useMemo(() => {
    const chips: FilterChip[] = [];
    const filters = getFiltersForPlayType(playType);

    if (playType !== DEFAULT_PLAY_TYPE) {
      chips.push({
        key: "playType",
        label:
          PLAY_TYPE_LABELS[playType as keyof typeof PLAY_TYPE_LABELS] ??
          playType,
      });
    }
    if (quarter) {
      for (const q of splitMultiValue(quarter)) {
        const n = Number(q);
        const qLabel = n >= 1 && n <= 4 ? `Q${n}` : n >= 5 ? `OT${n - 4}` : q;
        chips.push({ key: "quarter", label: qLabel, value: q });
      }
    }

    const values: Record<string, string> = {
      result,
      shotValue,
      subType,
      distanceBucket,
    };
    for (const filter of filters) {
      const val = values[filter.param] ?? "";
      if (val && val !== filter.defaultValue) {
        if (filter.multiSelect) {
          for (const v of splitMultiValue(val)) {
            const optLabel =
              filter.options.find((o) => o.value === v)?.label ?? v;
            chips.push({
              key: filter.param,
              label: `${filter.label}: ${optLabel}`,
              value: v,
            });
          }
        } else {
          const optLabel =
            filter.options.find((o) => o.value === val)?.label ?? val;
          chips.push({
            key: filter.param,
            label: `${filter.label}: ${optLabel}`,
          });
        }
      }
    }

    if (opponent) {
      chips.push({ key: "opponent", label: `vs ${opponent}` });
    }

    const excludeCount = excludedGameIds.size + excludedDates.size;
    if (excludeCount > 0) {
      chips.push({
        key: "exclusions",
        label: `${excludeCount} exclusion${excludeCount !== 1 ? "s" : ""}`,
      });
    }

    return chips;
  }, [
    playType,
    quarter,
    result,
    shotValue,
    subType,
    distanceBucket,
    opponent,
    excludedGameIds.size,
    excludedDates.size,
  ]);

  function clearAllChips() {
    setExcludedGameIds(new Set());
    setExcludedDates(new Set());
    navigateTo({
      playType: DEFAULT_PLAY_TYPE,
      result: DEFAULT_RESULT,
      quarter: "",
      shotValue: "",
      subType: "",
      distanceBucket: "",
      opponent: "",
      excludedGameIds: new Set(),
      excludedDates: new Set(),
    });
  }

  const isFiltered =
    playType !== DEFAULT_PLAY_TYPE ||
    result !== DEFAULT_RESULT ||
    quarter !== "" ||
    shotValue !== "" ||
    subType !== "" ||
    distanceBucket !== "" ||
    opponent !== "" ||
    excludedGameIds.size > 0 ||
    excludedDates.size > 0;

  const activeFilterCount = activeChips.length;
  const exclusionCount = excludedGameIds.size + excludedDates.size;

  function applyPreset(preset: (typeof FILTER_PRESETS)[number]) {
    navigateTo({
      result: "",
      shotValue: "",
      subType: "",
      distanceBucket: "",
      quarter: "",
      ...preset.params,
    } as Partial<PlayerModeFilterState>);
  }

  function isPresetActive(preset: (typeof FILTER_PRESETS)[number]): boolean {
    const state: Record<string, string> = {
      playType,
      result,
      shotValue,
      subType,
      distanceBucket,
      quarter,
    };
    return Object.entries(preset.params).every(
      ([k, v]) => (state[k] ?? "") === v,
    );
  }

  const playerSummary = buildPlayerSummary({
    playerName: selectedPlayer?.displayName ?? "",
    opponent,
    playType,
  });

  return (
    <div>
      {/* Watch mode: compact summary + Edit */}
      {isWatchMode &&
        watchBarPortal &&
        createPortal(
          <WatchBar summary={playerSummary} onEdit={exitWatchMode} />,
          watchBarPortal,
        )}

      {/* Compact filter controls — portaled into the top bar (one line) */}
      {!isWatchMode &&
        portalTarget &&
        createPortal(
          <div ref={playerTriggerRef} className="contents">
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
                  onChange={(e) =>
                    navigateTo({
                      playType: e.target.value,
                      result: DEFAULT_RESULT,
                      shotValue: "",
                      subType: "",
                      distanceBucket: "",
                    })
                  }
                  className="h-7 shrink-0 rounded bg-zinc-900 px-2 text-sm text-white"
                >
                  {PLAY_TYPES.map((pt) => (
                    <option key={pt} value={pt}>
                      {PLAY_TYPE_LABELS[pt]}
                    </option>
                  ))}
                </select>

                {opponentOptions.length > 0 && (
                  <select
                    data-testid="player-opponent-select"
                    value={opponent}
                    onChange={(e) => navigateTo({ opponent: e.target.value })}
                    className="h-7 shrink-0 rounded bg-zinc-900 px-2 text-sm text-white"
                  >
                    <option value="">All Opponents</option>
                    {opponentOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}

                {gameLog.length > 0 && (
                  <div ref={gamesTriggerRef} className="relative shrink-0">
                    <button
                      onClick={() => {
                        setIsGamesOpen((o) => !o);
                        setIsOverflowOpen(false);
                      }}
                      className={`relative h-7 shrink-0 rounded px-2 text-sm transition-colors ${
                        isGamesOpen
                          ? "bg-zinc-700 text-white"
                          : exclusionCount > 0
                            ? "bg-zinc-800 text-white"
                            : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      }`}
                    >
                      {exclusionCount > 0
                        ? `Games (${exclusionCount})`
                        : "Games"}
                      {exclusionCount > 0 && (
                        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-yellow-500" />
                      )}
                    </button>
                    {isGamesOpen && (
                      <div className="absolute right-0 z-40 mt-1 w-[340px] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-lg">
                        <div className="max-h-[60vh] overflow-y-auto p-3">
                          <PlayerGameList
                            games={gameLog}
                            excludedGameIds={excludedGameIds}
                            excludedDates={excludedDates}
                            onToggleGameId={toggleGameId}
                            onToggleDate={toggleDate}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => {
                    setIsOverflowOpen((o) => !o);
                    setIsGamesOpen(false);
                  }}
                  className={`relative h-7 shrink-0 rounded px-2 text-sm transition-colors ${
                    isOverflowOpen
                      ? "bg-zinc-700 text-white"
                      : activeFilterCount > 0
                        ? "bg-zinc-800 text-white"
                        : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {activeFilterCount > 0
                    ? `Filters (${activeFilterCount})`
                    : "Filters"}
                  {activeFilterCount > 0 && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-blue-500" />
                  )}
                </button>

                {isFiltered && (
                  <button
                    onClick={clearAllChips}
                    className="px-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </>
            )}
          </div>,
          portalTarget,
        )}

      {/* Floating filter panel — portaled into overlay anchor, never pushes content */}
      {!isWatchMode &&
        isOverflowOpen &&
        overlayTarget &&
        selectedPlayer &&
        createPortal(
          <div
            ref={playerPanelRef}
            className="absolute left-0 right-0 top-0 z-50 border-b border-zinc-700 bg-zinc-800 shadow-lg"
          >
            <div className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-2.5">
              {/* Play-type-specific filters from filterConfig */}
              {getFiltersForPlayType(playType).map((filter) => {
                const currentValue = p(filter.param) || filter.defaultValue;

                if (filter.style === "buttons") {
                  if (filter.multiSelect) {
                    return (
                      <div key={filter.id} className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">
                          {filter.label}
                        </span>
                        <div className="flex gap-1">
                          {filter.options
                            .filter((opt) => opt.value !== "")
                            .map((opt) => {
                              const active = hasMultiValue(
                                currentValue,
                                opt.value,
                              );
                              return (
                                <button
                                  key={opt.value}
                                  onClick={() =>
                                    navigateTo({
                                      [filter.param]: toggleMultiValue(
                                        currentValue,
                                        opt.value,
                                      ),
                                    } as Partial<PlayerModeFilterState>)
                                  }
                                  className={`rounded px-3 py-0.5 text-sm ${
                                    active
                                      ? "bg-zinc-600 text-white"
                                      : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={filter.id} className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">
                        {filter.label}
                      </span>
                      <div className="flex gap-1">
                        {filter.options.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() =>
                              navigateTo({
                                [filter.param]: opt.value,
                              } as Partial<PlayerModeFilterState>)
                            }
                            className={`rounded px-3 py-0.5 text-sm ${
                              currentValue === opt.value
                                ? "bg-zinc-600 text-white"
                                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (filter.multiSelect) {
                  const selectedValues = splitMultiValue(currentValue);
                  const count = selectedValues.length;
                  const nonEmptyOptions = filter.options.filter(
                    (o) => o.value !== "",
                  );
                  const summaryLabel =
                    count === 0
                      ? (filter.options[0]?.label ?? "All")
                      : count <= 2
                        ? selectedValues
                            .map(
                              (v) =>
                                nonEmptyOptions.find((o) => o.value === v)
                                  ?.label ?? v,
                            )
                            .join(", ")
                        : `${count} selected`;
                  return (
                    <PlayerMultiSelectDropdown
                      key={filter.id}
                      label={filter.label}
                      size="sm"
                      summaryLabel={summaryLabel}
                      options={nonEmptyOptions}
                      selectedValues={selectedValues}
                      onToggle={(val) =>
                        navigateTo({
                          [filter.param]: toggleMultiValue(currentValue, val),
                        } as Partial<PlayerModeFilterState>)
                      }
                      onClear={
                        count > 0
                          ? () =>
                              navigateTo({
                                [filter.param]: "",
                              } as Partial<PlayerModeFilterState>)
                          : undefined
                      }
                    />
                  );
                }

                return (
                  <label
                    key={filter.id}
                    className="flex items-center gap-2 text-xs text-zinc-500"
                  >
                    {filter.label}
                    <select
                      value={currentValue}
                      onChange={(e) =>
                        navigateTo({
                          [filter.param]: e.target.value,
                        } as Partial<PlayerModeFilterState>)
                      }
                      className="h-7 rounded bg-zinc-900 px-2 text-sm text-white"
                    >
                      {filter.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}

              {/* Quarter — multi-select dropdown */}
              <PlayerMultiSelectDropdown
                label="Quarter"
                size="sm"
                summaryLabel={(() => {
                  const sel = splitMultiValue(quarter);
                  if (sel.length === 0) return "All";
                  return sel
                    .map((v) => {
                      const n = Number(v);
                      return n >= 1 && n <= 4
                        ? `Q${n}`
                        : n >= 5
                          ? `OT${n - 4}`
                          : v;
                    })
                    .join(", ");
                })()}
                options={[
                  { label: "Q1", value: "1" },
                  { label: "Q2", value: "2" },
                  { label: "Q3", value: "3" },
                  { label: "Q4", value: "4" },
                  { label: "OT1", value: "5" },
                  { label: "OT2", value: "6" },
                  { label: "OT3", value: "7" },
                ]}
                selectedValues={splitMultiValue(quarter)}
                onToggle={(val) =>
                  navigateTo({
                    quarter: toggleMultiValue(quarter, val),
                  })
                }
                onClear={
                  quarter ? () => navigateTo({ quarter: "" }) : undefined
                }
              />
            </div>

            {/* Presets — inside panel, not in page flow */}
            <div
              className="flex flex-wrap items-center gap-1.5 border-t border-zinc-700 px-4 py-1.5"
              data-testid="filter-presets"
            >
              <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                Quick:
              </span>
              {FILTER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  data-testid={`preset-${preset.id}`}
                  onClick={() => applyPreset(preset)}
                  className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                    isPresetActive(preset)
                      ? "bg-zinc-700 text-zinc-200"
                      : "text-zinc-500 hover:text-zinc-400"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>,
          overlayTarget,
        )}

      {/* Loading states */}
      {gameLogLoading && (
        <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-zinc-400">
          Loading game log...
        </div>
      )}

      {gameLogError && !gameLogLoading && (
        <div className="mx-auto max-w-3xl px-4 py-2 text-sm text-red-400">
          {gameLogError}
        </div>
      )}

      {selectedPlayer &&
        !gameLogLoading &&
        !gameLogError &&
        gameLog.length === 0 && (
          <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-zinc-400">
            No games found for this player in the selected season.
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

      {!initialLoading &&
        !clipsLoading &&
        !error &&
        selectedPlayer &&
        gameLog.length > 0 &&
        includedGameCount === 0 && (
          <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-zinc-400">
            All selected games are excluded. Clear exclusions to load clips
            again.
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
        includedGameCount > 0 &&
        clips.length === 0 &&
        !error && (
          <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-zinc-400">
            No clips found for this player with the current filters.
          </div>
        )}
    </div>
  );
}
