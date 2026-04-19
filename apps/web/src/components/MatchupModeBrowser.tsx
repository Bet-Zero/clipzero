"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  buildMatchupClipSearchParams,
  buildMatchupModeUrl,
  hasMultiValue,
  parseMatchupModeParams,
  splitMultiValue,
  toggleMultiValue,
} from "@/lib/filters";
import { NBA_TEAMS, isKnownTeam } from "@/lib/teams";
import type { Clip, MatchupGame, MatchupModeFilterState } from "@/lib/types";
import {
  FILTER_PRESETS,
  PLAY_TYPES,
  PLAY_TYPE_LABELS,
  PLAY_TYPE_SPECIFIC_PARAMS,
  getFiltersForPlayType,
} from "@/lib/filterConfig";
import ClipPlayer from "@/components/ClipPlayer";
import ClipRail from "@/components/ClipRail";

function MatchupMultiSelectDropdown({
  label,
  summaryLabel,
  options,
  selectedValues,
  onToggle,
  onClear,
}: {
  label: string;
  summaryLabel: string;
  options: { label: string; value: string }[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  onClear?: () => void;
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
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span>{label}</span>
        <button
          onClick={() => setOpen((o) => !o)}
          className="h-7 shrink-0 rounded bg-zinc-900 px-2 text-sm text-white hover:bg-zinc-800"
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

function TeamSelect({
  value,
  exclude,
  placeholder,
  onChange,
}: {
  value: string;
  exclude: string;
  placeholder: string;
  onChange: (team: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 min-w-28 shrink-0 rounded bg-zinc-900 px-2 text-sm text-white"
    >
      <option value="">{placeholder}</option>
      {NBA_TEAMS.map((team) => (
        <option
          key={team.tricode}
          value={team.tricode}
          disabled={team.tricode === exclude}
        >
          {team.tricode} · {team.name}
        </option>
      ))}
    </select>
  );
}

function formatGameDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function MatchupGameList({
  games,
  excludedGameIds,
  onToggleGameId,
}: {
  games: MatchupGame[];
  excludedGameIds: Set<string>;
  onToggleGameId: (gameId: string) => void;
}) {
  if (games.length === 0) {
    return <p className="text-sm text-zinc-500">No games found.</p>;
  }

  const includedCount = games.length - excludedGameIds.size;

  return (
    <div className="space-y-1">
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {includedCount} of {games.length} games included
        </span>
        <span className="text-zinc-600">click to toggle</span>
      </div>
      {games.map((game) => {
        const isExcluded = excludedGameIds.has(game.gameId);
        const hasScore =
          game.awayScore !== null &&
          game.awayScore !== undefined &&
          game.homeScore !== null &&
          game.homeScore !== undefined;
        const margin = hasScore
          ? Math.abs(game.awayScore! - game.homeScore!)
          : null;

        return (
          <button
            key={game.gameId}
            onClick={() => onToggleGameId(game.gameId)}
            className={`flex w-full items-center justify-between rounded px-2.5 py-2 text-left text-sm transition-colors ${
              isExcluded
                ? "bg-zinc-950 opacity-40"
                : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            <span className={isExcluded ? "text-zinc-500" : ""}>
              {formatGameDate(game.gameDate)}
              <span className="mx-1.5 text-zinc-600">·</span>
              {game.awayTeam.tricode}{" "}
              {hasScore && (
                <span
                  className={
                    game.awayScore! > game.homeScore!
                      ? "font-semibold"
                      : "text-zinc-500"
                  }
                >
                  {game.awayScore}
                </span>
              )}
              <span className="mx-1 text-zinc-600">@</span>
              {game.homeTeam.tricode}{" "}
              {hasScore && (
                <span
                  className={
                    game.homeScore! > game.awayScore!
                      ? "font-semibold"
                      : "text-zinc-500"
                  }
                >
                  {game.homeScore}
                </span>
              )}
            </span>
            <span className="flex items-center gap-2">
              {hasScore && margin !== null && (
                <span className="text-[10px] text-zinc-600">
                  {margin === 0 ? "OT?" : `${margin > 15 ? "↑" : ""}+${margin}`}
                </span>
              )}
              <span
                className={`h-2 w-2 rounded-full ${isExcluded ? "bg-zinc-700" : "bg-emerald-500"}`}
              />
            </span>
          </button>
        );
      })}
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

function quarterSummary(quarter: string): string {
  const selected = splitMultiValue(quarter);
  if (selected.length === 0) return "All";
  return selected
    .map((v) => {
      const n = Number(v);
      return n >= 1 && n <= 4 ? `Q${n}` : n >= 5 ? `OT${n - 4}` : v;
    })
    .join(", ");
}

export default function MatchupModeBrowser({ season }: { season: string }) {
  const router = useRouter();
  const params = useSearchParams();

  const [games, setGames] = useState<MatchupGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [excludedGameIds, setExcludedGameIds] = useState<Set<string>>(
    new Set(),
  );

  const [clips, setClips] = useState<Clip[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [videoCdnAvailable, setVideoCdnAvailable] = useState(true);
  const [clipsLoading, setClipsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

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
  const p = (key: string) => optimisticValues[key] ?? params.get(key) ?? "";

  const teamA = p("teamA").toUpperCase();
  const teamB = p("teamB").toUpperCase();
  const team = p("team").toUpperCase();
  const playType = p("playType") || DEFAULT_PLAY_TYPE;
  const result = p("result") || DEFAULT_RESULT;
  const quarter = p("quarter");
  const shotValue = p("shotValue");
  const subType = p("subType");
  const distanceBucket = p("distanceBucket");
  const area = p("area");
  const descriptor = p("descriptor");
  const qualifier = p("qualifier");
  const limit = 12;

  const portalTarget = useDomElementById("matchup-filter-portal");
  const overlayTarget = useDomElementById("filter-overlay-anchor");
  const triggerRef = useRef<HTMLDivElement>(null);
  const gamesTriggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [isGamesOpen, setIsGamesOpen] = useState(false);

  const loadingRef = useRef(false);
  // Request generation counter — incremented on every new clip-set fetch.
  const generationRef = useRef(0);
  // AbortController for the current in-flight clip fetch.
  const abortRef = useRef<AbortController | null>(null);
  const clipsRef = useRef(clips);
  clipsRef.current = clips;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const pendingAdvanceRef = useRef(false);

  const excludedGameIdsKey = [...excludedGameIds].sort().join(",");

  useEffect(() => {
    const initial = parseMatchupModeParams(
      new URLSearchParams(params.toString()),
    );
    if (initial.excludedGameIds.size > 0) {
      setExcludedGameIds(initial.excludedGameIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter panel stays open until the Filters button is clicked again —
  // no outside-click close, so users can make multiple selections freely.

  useEffect(() => {
    if (!isGamesOpen) return;
    function handleOutside(e: MouseEvent) {
      if (gamesTriggerRef.current?.contains(e.target as Node)) return;
      setIsGamesOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isGamesOpen]);

  const validMatchup =
    Boolean(teamA) &&
    Boolean(teamB) &&
    teamA !== teamB &&
    isKnownTeam(teamA) &&
    isKnownTeam(teamB);

  useEffect(() => {
    if (!validMatchup) {
      setGames([]);
      setGamesError(null);
      setClips([]);
      setTotal(0);
      return;
    }

    let cancelled = false;
    setGamesLoading(true);
    setGamesError(null);

    (async () => {
      try {
        const search = new URLSearchParams({ season, teamA, teamB });
        const res = await fetch(buildApiUrl("/matchups", search));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setGames(data.games ?? []);
      } catch (err) {
        if (!cancelled) {
          setGames([]);
          setGamesError(
            err instanceof TypeError
              ? getApiUnavailableMessage()
              : `Could not load matchup games (${err instanceof Error ? err.message : "error"})`,
          );
        }
      } finally {
        if (!cancelled) setGamesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [validMatchup, season, teamA, teamB]);

  const fetchClips = useCallback(
    async (offset: number, append: boolean) => {
      if (!validMatchup || games.length === 0) return;

      if (offset === 0) {
        setInitialLoading(true);
      } else {
        setClipsLoading(true);
      }
      loadingRef.current = true;
      setError(null);

      // Increment generation and capture locally.
      const gen = ++generationRef.current;

      // Abort any previous in-flight fetch.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const pinnedNum = !append ? getCurrentActionNumber(params) : null;

      try {
        const search = buildMatchupClipSearchParams({
          teamA,
          teamB,
          season,
          limit,
          offset,
          team,
          playType,
          result,
          quarter,
          shotValue,
          subType,
          distanceBucket,
          area,
          descriptor,
          qualifier,
          excludeGameIds: [...excludedGameIds],
        });

        const res = await fetch(buildApiUrl("/clips/matchup", search), {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Stale generation — discard silently.
        if (gen !== generationRef.current) return;

        if (typeof data.videoCdnAvailable === "boolean") {
          setVideoCdnAvailable(data.videoCdnAvailable);
        }

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
        // Intentional aborts are silent.
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (gen !== generationRef.current) return;
        setError(
          err instanceof TypeError
            ? getApiUnavailableMessage()
            : `Could not load clips (${err instanceof Error ? err.message : "error"})`,
        );
      } finally {
        if (gen === generationRef.current) {
          loadingRef.current = false;
          setClipsLoading(false);
          setInitialLoading(false);
        }
      }
    },
    [
      validMatchup,
      games.length,
      params,
      teamA,
      teamB,
      season,
      team,
      playType,
      result,
      quarter,
      shotValue,
      subType,
      distanceBucket,
      area,
      descriptor,
      qualifier,
      excludedGameIds,
    ],
  );

  useEffect(() => {
    // Clear stale auto-advance state from the previous context.
    pendingAdvanceRef.current = false;
    if (validMatchup && !gamesLoading && games.length > 0) {
      fetchClips(0, false);
    } else if (validMatchup && !gamesLoading && games.length === 0) {
      setClips([]);
      setTotal(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    validMatchup,
    gamesLoading,
    games.length,
    team,
    playType,
    result,
    quarter,
    shotValue,
    subType,
    distanceBucket,
    area,
    descriptor,
    qualifier,
    excludedGameIdsKey,
  ]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore || nextOffset === null) return;
    await fetchClips(nextOffset, true);
  }, [hasMore, nextOffset, fetchClips]);

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

  useEffect(() => {
    const adjacent = [clips[activeIndex - 1], clips[activeIndex + 1]];
    for (const c of adjacent) {
      if (c?.thumbnailUrl) {
        const img = new Image();
        img.src = c.thumbnailUrl;
      }
    }
  }, [activeIndex, clips]);

  const liveActionNumber = getCurrentActionNumber(params);

  function getFilterState(
    overrides: Partial<MatchupModeFilterState> = {},
  ): MatchupModeFilterState {
    const hasFilterChange =
      "team" in overrides ||
      "playType" in overrides ||
      "result" in overrides ||
      "quarter" in overrides ||
      "shotValue" in overrides ||
      "subType" in overrides ||
      "distanceBucket" in overrides;

    return {
      teamA: overrides.teamA ?? teamA,
      teamB: overrides.teamB ?? teamB,
      team: overrides.team ?? team,
      playType: overrides.playType ?? playType,
      result: overrides.result ?? result,
      quarter: overrides.quarter ?? quarter,
      shotValue: overrides.shotValue ?? shotValue,
      subType: overrides.subType ?? subType,
      distanceBucket: overrides.distanceBucket ?? distanceBucket,
      area: overrides.area ?? area,
      descriptor: overrides.descriptor ?? descriptor,
      qualifier: overrides.qualifier ?? qualifier,
      excludedGameIds: overrides.excludedGameIds ?? excludedGameIds,
      actionNumber:
        "actionNumber" in overrides
          ? (overrides.actionNumber ?? null)
          : hasFilterChange
            ? null
            : liveActionNumber,
    };
  }

  function navigateTo(overrides: Partial<MatchupModeFilterState> = {}) {
    const stringKeys = [
      "teamA",
      "teamB",
      "team",
      "playType",
      "result",
      "quarter",
      "shotValue",
      "subType",
      "distanceBucket",
      "area",
      "descriptor",
      "qualifier",
    ] as const;
    const updates: Record<string, string> = {};
    for (const key of stringKeys) {
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

    router.push(buildMatchupModeUrl(season, getFilterState(overrides)), {
      scroll: false,
    });
  }

  function selectTeam(which: "teamA" | "teamB", nextTeam: string) {
    setExcludedGameIds(new Set());
    setClips([]);
    setTotal(0);
    setGames([]);
    navigateTo({
      [which]: nextTeam,
      team: "",
      excludedGameIds: new Set(),
      actionNumber: null,
    } as Partial<MatchupModeFilterState>);
  }

  function toggleGameId(gameId: string) {
    const next = new Set(excludedGameIds);
    if (next.has(gameId)) {
      next.delete(gameId);
    } else {
      next.add(gameId);
    }
    setExcludedGameIds(next);
    navigateTo({ excludedGameIds: next, actionNumber: null });
  }

  function changePlayType(newPlayType: string) {
    navigateTo({
      ...Object.fromEntries(PLAY_TYPE_SPECIFIC_PARAMS.map((p) => [p, ""])),
      playType: newPlayType,
      actionNumber: null,
    } as Partial<MatchupModeFilterState>);
  }

  function clearFilters() {
    const empty = new Set<string>();
    setExcludedGameIds(empty);
    navigateTo({
      team: "",
      playType: DEFAULT_PLAY_TYPE,
      result: DEFAULT_RESULT,
      quarter: "",
      shotValue: "",
      subType: "",
      distanceBucket: "",
      area: "",
      descriptor: "",
      qualifier: "",
      excludedGameIds: empty,
      actionNumber: null,
    });
  }

  function applyPreset(preset: (typeof FILTER_PRESETS)[number]) {
    navigateTo({
      ...Object.fromEntries(PLAY_TYPE_SPECIFIC_PARAMS.map((p) => [p, ""])),
      quarter: "",
      ...preset.params,
      actionNumber: null,
    } as Partial<MatchupModeFilterState>);
  }

  function isPresetActive(preset: (typeof FILTER_PRESETS)[number]): boolean {
    const state: Record<string, string> = {
      playType,
      result,
      shotValue,
      subType,
      distanceBucket,
      area,
      descriptor,
      qualifier,
      quarter,
    };
    return Object.entries(preset.params).every(
      ([k, v]) => (state[k] ?? "") === v,
    );
  }

  const playTypeFilters = getFiltersForPlayType(playType);
  const exclusionCount = excludedGameIds.size;
  const activeFilterCount =
    (team !== "" ? 1 : 0) +
    (playType !== DEFAULT_PLAY_TYPE ? 1 : 0) +
    (quarter !== "" ? splitMultiValue(quarter).length : 0) +
    (result !== DEFAULT_RESULT && playType === "shots" ? 1 : 0) +
    (shotValue !== "" ? 1 : 0) +
    (subType !== "" ? splitMultiValue(subType).length : 0) +
    (distanceBucket !== "" ? splitMultiValue(distanceBucket).length : 0) +
    (area !== "" ? splitMultiValue(area).length : 0) +
    (descriptor !== "" ? splitMultiValue(descriptor).length : 0) +
    (qualifier !== "" ? splitMultiValue(qualifier).length : 0) +
    exclusionCount;

  const isFiltered = activeFilterCount > 0;

  return (
    <div>
      {portalTarget &&
        createPortal(
          <div ref={triggerRef} className="contents">
            <TeamSelect
              value={teamA}
              exclude={teamB}
              placeholder="Team A"
              onChange={(value) => selectTeam("teamA", value)}
            />
            <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-600">
              vs
            </span>
            <TeamSelect
              value={teamB}
              exclude={teamA}
              placeholder="Team B"
              onChange={(value) => selectTeam("teamB", value)}
            />

            {validMatchup && (
              <>
                <div className="flex h-7 shrink-0 items-center rounded bg-zinc-950 p-0.5">
                  {["", teamA, teamB].map((value) => {
                    const active = team === value;
                    const label = value || "All";
                    return (
                      <button
                        key={label}
                        onClick={() =>
                          navigateTo({ team: value, actionNumber: null })
                        }
                        className={`flex h-full items-center rounded-sm px-2 text-xs font-medium transition-colors ${
                          active
                            ? "bg-zinc-700 text-white"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {games.length > 0 && (
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
                          <MatchupGameList
                            games={games}
                            excludedGameIds={excludedGameIds}
                            onToggleGameId={toggleGameId}
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
                    onClick={clearFilters}
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

      {isOverflowOpen &&
        overlayTarget &&
        validMatchup &&
        createPortal(
          <div
            ref={panelRef}
            className="absolute left-0 right-0 top-0 z-50 border-b border-zinc-700 bg-zinc-800 shadow-lg"
          >
            <div className="flex items-center gap-4 overflow-x-auto px-4 py-2.5">
              <label className="flex shrink-0 items-center gap-2 text-xs text-zinc-500">
                Play Type
                <select
                  value={playType}
                  onChange={(e) => changePlayType(e.target.value)}
                  className="h-7 rounded bg-zinc-900 px-2 text-sm text-white"
                >
                  {PLAY_TYPES.map((pt) => (
                    <option key={pt} value={pt}>
                      {PLAY_TYPE_LABELS[pt]}
                    </option>
                  ))}
                </select>
              </label>
              <MatchupMultiSelectDropdown
                label="Quarter"
                summaryLabel={quarterSummary(quarter)}
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
                    actionNumber: null,
                  })
                }
                onClear={
                  quarter
                    ? () => navigateTo({ quarter: "", actionNumber: null })
                    : undefined
                }
              />

              {playTypeFilters.map((filter) => {
                const currentValue =
                  p(filter.param) || filter.defaultValue || "";

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
                                      actionNumber: null,
                                    })
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
                                actionNumber: null,
                              })
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
                    <MatchupMultiSelectDropdown
                      key={filter.id}
                      label={filter.label}
                      summaryLabel={summaryLabel}
                      options={nonEmptyOptions}
                      selectedValues={selectedValues}
                      onToggle={(val) =>
                        navigateTo({
                          [filter.param]: toggleMultiValue(currentValue, val),
                          actionNumber: null,
                        })
                      }
                      onClear={
                        count > 0
                          ? () =>
                              navigateTo({
                                [filter.param]: "",
                                actionNumber: null,
                              })
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
                          actionNumber: null,
                        })
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
            </div>

            <div
              className="flex flex-wrap items-center gap-1.5 border-t border-zinc-700 px-4 py-1.5"
              data-testid="matchup-filter-presets"
            >
              <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                Quick:
              </span>
              {FILTER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
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

      <div className="flex flex-1 min-h-0 flex-col gap-2 px-4 py-2">
        {!validMatchup ? (
          <div className="mx-auto max-w-2xl px-4 py-8 text-sm text-zinc-400">
            Select two teams above to load their head-to-head games for {season}
            .
          </div>
        ) : gamesLoading ? (
          <div className="mx-auto max-w-2xl px-4 py-8 text-sm text-zinc-500">
            Loading matchup games...
          </div>
        ) : gamesError ? (
          <div className="mx-auto max-w-2xl px-4 py-8 text-sm text-red-400">
            {gamesError}
          </div>
        ) : games.length === 0 ? (
          <div className="mx-auto max-w-2xl px-4 py-8 text-sm text-zinc-400">
            No completed {teamA} vs {teamB} games found for {season}.
          </div>
        ) : (
          <>
            <ClipRail
              clips={clips}
              activeIndex={activeIndex}
              onSelect={handleSelect}
              hasMore={hasMore}
              loading={clipsLoading || initialLoading}
              error={error}
              onLoadMore={loadMore}
            />

            <div className="mx-auto w-full max-w-4xl">
              {!videoCdnAvailable && (
                <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  NBA video CDN is currently returning placeholder videos. Clips
                  are listed, but playback is disabled until NBA video files
                  recover.
                </div>
              )}
              <ClipPlayer
                clip={clips[activeIndex] ?? null}
                onEnded={handleClipEnded}
              />
            </div>

            <div className="pb-1 text-center text-xs text-zinc-600">
              {clips.length} of {total} clips
              {"  ·  "}
              {team || "All Teams"} ·{" "}
              {quarter ? quarterSummary(quarter) : "All Quarters"} ·{" "}
              {PLAY_TYPE_LABELS[playType as keyof typeof PLAY_TYPE_LABELS] ??
                playType}
              {playType === "shots" && result !== DEFAULT_RESULT
                ? ` · ${result}`
                : ""}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
