"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import type { Player } from "@/lib/types";
import {
  DEFAULT_PLAY_TYPE,
  DEFAULT_RESULT,
  cleanSearchString,
  toggleMultiValue,
  hasMultiValue,
  splitMultiValue,
  removeMultiValue,
} from "@/lib/filters";
import {
  PLAY_TYPES,
  PLAY_TYPE_SPECIFIC_PARAMS,
  getFiltersForPlayType,
} from "@/lib/filterConfig";
import ActiveFilterChips, {
  type FilterChip,
} from "@/components/ActiveFilterChips";

// Reusable multi-select dropdown for filter options with checkmarks.
function MultiSelectDropdown({
  label,
  summaryLabel,
  options,
  selectedValues,
  onToggle,
}: {
  label: string;
  summaryLabel: string;
  options: { label: string; value: string }[];
  selectedValues: string[];
  onToggle: (value: string) => void;
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
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span>{label}</span>
        <button
          onClick={() => setOpen((o) => !o)}
          className="h-7 rounded bg-zinc-900 px-2 text-sm text-white hover:bg-zinc-800"
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
        </div>
      )}
    </div>
  );
}

export default function FilterBar({
  players,
  teams,
}: {
  players: Player[];
  teams: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  // Persistent URL context — not filter state
  const date = params.get("date") || "";
  const gameId = params.get("gameId") || "";
  const season = params.get("season") || "";

  // Universal filters
  const playType = params.get("playType") || DEFAULT_PLAY_TYPE;
  const quarter = params.get("quarter") || "";
  const team = params.get("team") || "";
  const selectedPlayer = params.get("player") || "";

  // Shot-specific filters
  const shotResult = params.get("result") || DEFAULT_RESULT;

  // Play-type-specific filters from config
  const shotValue = params.get("shotValue") || "";
  const subType = params.get("subType") || "";
  const distanceBucket = params.get("distanceBucket") || "";

  const [playerInput, setPlayerInput] = useState(selectedPlayer);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.getElementById("filter-bar-portal"));
  }, []);

  useEffect(() => {
    if (!isOverflowOpen) return;
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setIsOverflowOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOverflowOpen]);

  useEffect(() => {
    setPlayerInput(selectedPlayer);
    setIsPlayerOpen(false);
  }, [selectedPlayer, gameId, team, playType, quarter]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [playerInput]);

  // Build a URL with the given overrides merged into current filter state.
  // Omitting a key preserves its current value; passing "" clears it.
  function navigate(overrides: Record<string, string>) {
    const search = new URLSearchParams();
    if (season) search.set("season", season);
    if (date) search.set("date", date);
    if (gameId) search.set("gameId", gameId);

    const state: Record<string, string> = {
      playType,
      team,
      quarter,
      player: selectedPlayer,
      result: shotResult,
      shotValue,
      subType,
      distanceBucket,
      ...overrides,
    };

    if (state.playType && state.playType !== DEFAULT_PLAY_TYPE)
      search.set("playType", state.playType);
    if (state.team) search.set("team", state.team);
    if (state.player) search.set("player", state.player);
    if (state.quarter) search.set("quarter", state.quarter);
    if (state.result && state.result !== DEFAULT_RESULT)
      search.set("result", state.result);
    if (state.shotValue) search.set("shotValue", state.shotValue);
    if (state.subType) search.set("subType", state.subType);
    if (state.distanceBucket)
      search.set("distanceBucket", state.distanceBucket);

    router.push(`/?${cleanSearchString(search)}`);
  }

  // When play type changes, clear every play-type-specific param.
  function changePlayType(newPlayType: string) {
    const clears = Object.fromEntries(
      PLAY_TYPE_SPECIFIC_PARAMS.map((p) => [p, ""]),
    );
    navigate({ ...clears, playType: newPlayType, player: "" });
  }

  const filteredPlayers = useMemo(() => {
    const q = playerInput.trim().toLowerCase();
    if (!q) return players.slice(0, 8);
    const queryParts = q.split(/\s+/).filter(Boolean);
    return players
      .filter((p) => {
        const name = p.name.toLowerCase();
        const nameParts = name.split(/\s+/).filter(Boolean);
        const reversedName = nameParts.slice().reverse().join(" ");
        return (
          name.includes(q) ||
          reversedName.includes(q) ||
          queryParts.every((part) =>
            nameParts.some((namePart) => namePart.startsWith(part)),
          )
        );
      })
      .slice(0, 8);
  }, [players, playerInput]);

  function applyPlayer(name: string) {
    setPlayerInput(name);
    setIsPlayerOpen(false);
    navigate({ player: name });
  }

  function clearPlayer() {
    setPlayerInput("");
    setIsPlayerOpen(false);
    navigate({ player: "" });
  }

  const isFiltered =
    playType !== DEFAULT_PLAY_TYPE ||
    shotResult !== DEFAULT_RESULT ||
    quarter !== "" ||
    selectedPlayer !== "" ||
    team !== "" ||
    shotValue !== "" ||
    subType !== "" ||
    distanceBucket !== "";

  const activeFilterCount =
    (playType !== DEFAULT_PLAY_TYPE ? 1 : 0) +
    (team !== "" ? splitMultiValue(team).length : 0) +
    (selectedPlayer !== "" ? 1 : 0) +
    (quarter !== "" ? splitMultiValue(quarter).length : 0) +
    (shotResult !== DEFAULT_RESULT && playType === DEFAULT_PLAY_TYPE ? 1 : 0) +
    (shotValue !== "" ? 1 : 0) +
    (subType !== "" ? splitMultiValue(subType).length : 0) +
    (distanceBucket !== "" ? splitMultiValue(distanceBucket).length : 0);

  function clearFilters() {
    const search = new URLSearchParams();
    if (season) search.set("season", season);
    if (date) search.set("date", date);
    if (gameId) search.set("gameId", gameId);
    const limit = params.get("limit");
    if (limit) search.set("limit", limit);
    setPlayerInput("");
    router.push(`/?${search.toString()}`);
  }

  const playTypeFilters = getFiltersForPlayType(playType);

  const activeChips = useMemo(() => {
    const chips: FilterChip[] = [];
    const filters = getFiltersForPlayType(playType);

    if (playType !== DEFAULT_PLAY_TYPE) {
      chips.push({ key: "playType", label: playType });
    }
    if (team) {
      for (const t of splitMultiValue(team)) {
        chips.push({ key: "team", label: `Team: ${t}`, value: t });
      }
    }
    if (selectedPlayer) {
      chips.push({ key: "player", label: selectedPlayer });
    }
    if (quarter) {
      for (const q of splitMultiValue(quarter)) {
        const n = Number(q);
        const qLabel = n >= 1 && n <= 4 ? `Q${n}` : n >= 5 ? `OT${n - 4}` : q;
        chips.push({ key: "quarter", label: qLabel, value: q });
      }
    }

    const values: Record<string, string> = {
      result: shotResult,
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

    return chips;
  }, [
    playType,
    team,
    selectedPlayer,
    quarter,
    shotResult,
    shotValue,
    subType,
    distanceBucket,
  ]);

  function removeChip(key: string, value?: string) {
    if (key === "playType") {
      changePlayType(DEFAULT_PLAY_TYPE);
      return;
    }
    if (key === "player") {
      clearPlayer();
      return;
    }
    // Multi-select params: remove one value from the comma-separated list
    if (value) {
      const multiParams: Record<string, string> = {
        team,
        quarter,
        subType,
        distanceBucket,
      };
      if (key in multiParams) {
        navigate({ [key]: removeMultiValue(multiParams[key], value) });
        return;
      }
    }
    const filter = playTypeFilters.find((f) => f.param === key);
    navigate({ [key]: filter?.defaultValue ?? "" });
  }

  return (
    <>
      <div className="relative" style={{ height: 0, overflow: "visible" }}>
        {portalTarget &&
          createPortal(
            <div ref={triggerRef} className="flex items-center gap-2">
              {/* Player dropdown grouped by team */}
              {players.length > 0 && (
                <select
                  value={selectedPlayer}
                  onChange={(e) => navigate({ player: e.target.value })}
                  className="h-8 rounded bg-zinc-900 px-2 text-sm text-white"
                >
                  <option value="">All Players</option>
                  {(() => {
                    const playerTricodes = Array.from(
                      new Set(players.map((p) => p.teamTricode ?? "")),
                    );
                    const orderedTricodes = [
                      ...teams.filter((t) => playerTricodes.includes(t)),
                      ...playerTricodes.filter(
                        (t) => t !== "" && !teams.includes(t),
                      ),
                    ];
                    const ungrouped = players.filter(
                      (p) => !p.teamTricode || p.teamTricode === "",
                    );
                    return (
                      <>
                        {orderedTricodes.map((t) => {
                          const group = players.filter(
                            (p) => p.teamTricode === t,
                          );
                          return (
                            <optgroup key={t} label={t}>
                              {group.map((p) => (
                                <option key={p.name} value={p.name}>
                                  {p.name}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                        {ungrouped.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </>
                    );
                  })()}
                </select>
              )}

              <button
                onClick={() => setIsOverflowOpen((o) => !o)}
                className={`relative h-8 rounded px-3 text-sm transition-colors ${
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
                  className="h-8 rounded bg-zinc-800 px-3 text-sm text-zinc-300 hover:bg-zinc-700"
                >
                  Clear
                </button>
              )}
            </div>,
            portalTarget,
          )}

        {/* Floating filter panel */}
        {isOverflowOpen && (
          <div
            ref={panelRef}
            className="absolute left-0 right-0 top-0 z-50 border-b-2 border-zinc-600 bg-zinc-800 px-4 py-3 shadow-2xl"
          >
            <div className="flex flex-wrap items-start gap-3">
              {/* Play Type */}
              <label className="flex items-center gap-2 text-xs text-zinc-500">
                Play Type
                <select
                  value={playType}
                  onChange={(e) => changePlayType(e.target.value)}
                  className="h-7 rounded bg-zinc-900 px-2 text-sm text-white"
                >
                  {PLAY_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              {/* Team — multi-select toggle buttons */}
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span>Team</span>
                <div className="flex gap-1">
                  {teams.map((t) => {
                    const active = hasMultiValue(team, t);
                    return (
                      <button
                        key={t}
                        onClick={() =>
                          navigate({
                            team: toggleMultiValue(team, t),
                            player: "",
                          })
                        }
                        className={`rounded px-3 py-0.5 text-sm ${
                          active
                            ? "bg-white text-black"
                            : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Player search */}
              <div className="relative min-w-[200px]">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="shrink-0">Player</span>
                  <div className="flex items-center gap-1">
                    <input
                      value={playerInput}
                      onChange={(e) => {
                        setPlayerInput(e.target.value);
                        setIsPlayerOpen(true);
                      }}
                      onFocus={() => setIsPlayerOpen(true)}
                      onBlur={() => {
                        setTimeout(() => setIsPlayerOpen(false), 150);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          if (!isPlayerOpen) setIsPlayerOpen(true);
                          setActiveIndex((i) =>
                            filteredPlayers.length === 0
                              ? -1
                              : (i + 1) % filteredPlayers.length,
                          );
                          return;
                        }
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          if (!isPlayerOpen) setIsPlayerOpen(true);
                          setActiveIndex((i) =>
                            filteredPlayers.length === 0
                              ? -1
                              : i <= 0
                                ? filteredPlayers.length - 1
                                : i - 1,
                          );
                          return;
                        }
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (isPlayerOpen && activeIndex >= 0) {
                            applyPlayer(filteredPlayers[activeIndex].name);
                          } else {
                            const exactMatch = players.find(
                              (p) =>
                                p.name.toLowerCase() ===
                                playerInput.trim().toLowerCase(),
                            );
                            applyPlayer(exactMatch?.name ?? playerInput.trim());
                          }
                          return;
                        }
                        if (e.key === "Escape") {
                          if (isPlayerOpen) {
                            setIsPlayerOpen(false);
                            setActiveIndex(-1);
                          } else {
                            clearPlayer();
                          }
                        }
                      }}
                      placeholder="Search player"
                      className="h-7 w-full rounded bg-zinc-900 px-3 text-sm text-white placeholder:text-zinc-500"
                    />
                    {selectedPlayer && (
                      <button
                        onClick={clearPlayer}
                        className="h-7 rounded bg-zinc-900 px-2 text-sm text-zinc-400 hover:text-zinc-200"
                        aria-label="Clear player"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {isPlayerOpen && filteredPlayers.length > 0 && (
                  <div
                    ref={listRef}
                    className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-lg"
                  >
                    {filteredPlayers.map((p, i) => (
                      <button
                        key={p.name}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyPlayer(p.name)}
                        className={`block w-full px-3 py-2 text-left text-sm text-white ${
                          i === activeIndex
                            ? "bg-zinc-700"
                            : "hover:bg-zinc-800"
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quarter — multi-select toggle buttons */}
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span>Quarter</span>
                <div className="flex gap-1">
                  {[
                    { label: "Q1", value: "1" },
                    { label: "Q2", value: "2" },
                    { label: "Q3", value: "3" },
                    { label: "Q4", value: "4" },
                    { label: "OT1", value: "5" },
                    { label: "OT2", value: "6" },
                    { label: "OT3", value: "7" },
                  ].map((q) => {
                    const active = hasMultiValue(quarter, q.value);
                    return (
                      <button
                        key={q.value}
                        onClick={() =>
                          navigate({
                            quarter: toggleMultiValue(quarter, q.value),
                          })
                        }
                        className={`rounded px-2 py-0.5 text-sm ${
                          active
                            ? "bg-white text-black"
                            : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                        }`}
                      >
                        {q.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Play-type-specific filters from filterConfig */}
              {playTypeFilters.map((filter) => {
                const currentValue =
                  params.get(filter.param) || filter.defaultValue;

                if (filter.style === "buttons") {
                  if (filter.multiSelect) {
                    // Multi-select toggle buttons (skip the "All" option)
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
                                    navigate({
                                      [filter.param]: toggleMultiValue(
                                        currentValue,
                                        opt.value,
                                      ),
                                    })
                                  }
                                  className={`rounded px-3 py-0.5 text-sm ${
                                    active
                                      ? "bg-white text-black"
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
                              navigate({ [filter.param]: opt.value })
                            }
                            className={`rounded px-3 py-0.5 text-sm ${
                              currentValue === opt.value
                                ? "bg-white text-black"
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
                  // Multi-select dropdown with checkmarks
                  const selectedValues = splitMultiValue(currentValue);
                  const count = selectedValues.length;
                  const summaryLabel =
                    count === 0
                      ? (filter.options[0]?.label ?? "All")
                      : count === 1
                        ? (filter.options.find(
                            (o) => o.value === selectedValues[0],
                          )?.label ?? selectedValues[0])
                        : `${count} selected`;
                  return (
                    <MultiSelectDropdown
                      key={filter.id}
                      label={filter.label}
                      summaryLabel={summaryLabel}
                      options={filter.options.filter((o) => o.value !== "")}
                      selectedValues={selectedValues}
                      onToggle={(val) =>
                        navigate({
                          [filter.param]: toggleMultiValue(currentValue, val),
                        })
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
                        navigate({ [filter.param]: e.target.value })
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

              {/* Clear all */}
              {isFiltered && (
                <button
                  onClick={clearFilters}
                  className="h-7 rounded bg-zinc-800 px-3 text-sm text-zinc-300 hover:bg-zinc-700"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <ActiveFilterChips
        chips={activeChips}
        onRemove={removeChip}
        onClearAll={clearFilters}
      />
    </>
  );
}
