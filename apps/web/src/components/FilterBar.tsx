"use client";

import { useEffect, useRef, useState } from "react";
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
  canonicalMultiValue,
} from "@/lib/filters";
import {
  PLAY_TYPES,
  PLAY_TYPE_SPECIFIC_PARAMS,
  getFiltersForPlayType,
  FILTER_PRESETS,
} from "@/lib/filterConfig";

// Reusable multi-select dropdown for filter options with checkmarks.
function MultiSelectDropdown({
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
          {onClear && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 border-t border-zinc-800 px-3 py-1.5 text-left text-xs text-zinc-500 hover:text-zinc-300"
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Player selector grouped by team with multi-select checkmarks.
function PlayerGroupedDropdown({
  players,
  teams,
  selectedValues,
  onToggle,
  onClear,
}: {
  players: Player[];
  teams: string[];
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

  const summaryLabel = (() => {
    if (selectedValues.length === 0) return "All Players";
    if (selectedValues.length <= 2) return selectedValues.join(", ");
    return `${selectedValues.length} players`;
  })();

  // Group players by team, preserving the teams order
  const grouped = teams.map((t) => ({
    team: t,
    players: players.filter((p) => p.teamTricode === t),
  }));
  // Catch any players without a matching team
  const ungrouped = players.filter(
    (p) => !p.teamTricode || !teams.includes(p.teamTricode),
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-7 rounded bg-zinc-900 px-2 text-sm text-white hover:bg-zinc-800"
      >
        {summaryLabel}
        <span className="ml-1 text-zinc-500">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-80 min-w-[200px] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 shadow-lg">
          {grouped.map(({ team: t, players: teamPlayers }) =>
            teamPlayers.length > 0 ? (
              <div key={t}>
                <div className="sticky top-0 bg-zinc-950 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {t}
                </div>
                {teamPlayers.map((p) => {
                  const checked = selectedValues.includes(p.name);
                  return (
                    <button
                      key={p.name}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onToggle(p.name)}
                      className={`flex w-full items-center gap-2 px-3 py-1 text-left text-sm ${
                        checked
                          ? "bg-zinc-800 text-white"
                          : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                      }`}
                    >
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] ${
                          checked
                            ? "border-white bg-white text-black"
                            : "border-zinc-600"
                        }`}
                      >
                        {checked ? "✓" : ""}
                      </span>
                      {p.name}
                    </button>
                  );
                })}
              </div>
            ) : null,
          )}
          {ungrouped.length > 0 && (
            <div>
              <div className="sticky top-0 bg-zinc-950 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Other
              </div>
              {ungrouped.map((p) => {
                const checked = selectedValues.includes(p.name);
                return (
                  <button
                    key={p.name}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onToggle(p.name)}
                    className={`flex w-full items-center gap-2 px-3 py-1 text-left text-sm ${
                      checked
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    }`}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] ${
                        checked
                          ? "border-white bg-white text-black"
                          : "border-zinc-600"
                      }`}
                    >
                      {checked ? "✓" : ""}
                    </span>
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}
          {onClear && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 border-t border-zinc-800 px-3 py-1.5 text-left text-xs text-zinc-500 hover:text-zinc-300"
            >
              Clear selection
            </button>
          )}
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

  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [overlayTarget, setOverlayTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.getElementById("filter-bar-portal"));
    setOverlayTarget(document.getElementById("filter-overlay-anchor"));
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
    if (state.team) search.set("team", canonicalMultiValue(state.team));
    if (state.player) search.set("player", canonicalMultiValue(state.player));
    if (state.quarter)
      search.set("quarter", canonicalMultiValue(state.quarter));
    if (state.result && state.result !== DEFAULT_RESULT)
      search.set("result", state.result);
    if (state.shotValue) search.set("shotValue", state.shotValue);
    if (state.subType)
      search.set("subType", canonicalMultiValue(state.subType));
    if (state.distanceBucket)
      search.set("distanceBucket", canonicalMultiValue(state.distanceBucket));

    router.push(`/?${cleanSearchString(search)}`);
  }

  // When play type changes, clear every play-type-specific param.
  function changePlayType(newPlayType: string) {
    const clears = Object.fromEntries(
      PLAY_TYPE_SPECIFIC_PARAMS.map((p) => [p, ""]),
    );
    navigate({ ...clears, playType: newPlayType, player: "" });
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
    (selectedPlayer !== "" ? splitMultiValue(selectedPlayer).length : 0) +
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
    router.push(`/?${search.toString()}`);
  }

  const playTypeFilters = getFiltersForPlayType(playType);

  function applyPreset(preset: (typeof FILTER_PRESETS)[number]) {
    // Preset sets playType + play-type-specific params + optionally quarter.
    // Team and player are preserved.
    navigate({
      ...Object.fromEntries(PLAY_TYPE_SPECIFIC_PARAMS.map((p) => [p, ""])),
      quarter: "",
      ...preset.params,
    });
  }

  function isPresetActive(preset: (typeof FILTER_PRESETS)[number]): boolean {
    const state: Record<string, string> = {
      playType,
      result: shotResult,
      shotValue,
      subType,
      distanceBucket,
      quarter,
    };
    return Object.entries(preset.params).every(
      ([k, v]) => (state[k] ?? "") === v,
    );
  }

  return (
    <>
      {/* Buttons portaled into top bar — always one line */}
      {portalTarget &&
        createPortal(
          <div ref={triggerRef} className="flex items-center gap-2">
            {/* Player selector grouped by team */}
            {players.length > 0 && (
              <PlayerGroupedDropdown
                players={players}
                teams={teams}
                selectedValues={splitMultiValue(selectedPlayer)}
                onToggle={(val) =>
                  navigate({
                    player: toggleMultiValue(selectedPlayer, val),
                  })
                }
                onClear={
                  selectedPlayer ? () => navigate({ player: "" }) : undefined
                }
              />
            )}

            {/* Team toggle buttons — compact, max 2–3 teams */}
            {teams.length > 0 && (
              <div className="flex items-center gap-1">
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
                      className={`h-7 rounded px-2 text-xs font-medium transition-colors ${
                        active
                          ? "bg-white text-black"
                          : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
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
                className="h-7 rounded bg-zinc-800 px-2 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
              >
                Clear
              </button>
            )}
          </div>,
          portalTarget,
        )}

      {/* Floating filter panel — portaled into overlay anchor so it never pushes content */}
      {isOverflowOpen &&
        overlayTarget &&
        createPortal(
          <div
            ref={panelRef}
            className="absolute left-0 right-0 top-0 z-50 border-b-2 border-zinc-600 bg-zinc-800 shadow-2xl"
          >
            <div className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-2.5">
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

              {/* Quarter — multi-select dropdown */}
              <MultiSelectDropdown
                label="Quarter"
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
                  navigate({
                    quarter: toggleMultiValue(quarter, val),
                  })
                }
                onClear={quarter ? () => navigate({ quarter: "" }) : undefined}
              />

              {/* Play-type-specific filters from filterConfig */}
              {playTypeFilters.map((filter) => {
                const currentValue =
                  params.get(filter.param) || filter.defaultValue;

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
                    <MultiSelectDropdown
                      key={filter.id}
                      label={filter.label}
                      summaryLabel={summaryLabel}
                      options={nonEmptyOptions}
                      selectedValues={selectedValues}
                      onToggle={(val) =>
                        navigate({
                          [filter.param]: toggleMultiValue(currentValue, val),
                        })
                      }
                      onClear={
                        count > 0
                          ? () => navigate({ [filter.param]: "" })
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
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>,
          overlayTarget,
        )}
    </>
  );
}
