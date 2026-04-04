"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Player } from "@/lib/types";
import { DEFAULT_PLAY_TYPE, DEFAULT_RESULT } from "@/lib/filters";

const PLAY_TYPES = [
  DEFAULT_PLAY_TYPE,
  "assists",
  "rebounds",
  "turnovers",
  "fouls",
  "steals",
  "blocks",
];

export default function FilterBar({
  players,
  teams,
}: {
  players: Player[];
  teams: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const shotResult = params.get("result") || DEFAULT_RESULT;
  const selectedPlayer = params.get("player") || "";
  const date = params.get("date") || "";
  const gameId = params.get("gameId") || "";
  const season = params.get("season") || "";
  const playType = params.get("playType") || DEFAULT_PLAY_TYPE;
  const quarter = params.get("quarter") || "";
  const team = params.get("team") || "";

  const [playerInput, setPlayerInput] = useState(selectedPlayer);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPlayerInput(selectedPlayer);
    setIsPlayerOpen(false);
  }, [selectedPlayer, gameId, team, playType, quarter]);

  // Reset highlight whenever the visible list changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [playerInput]);

  function update(paramsObj: Record<string, string | null>) {
    const search = new URLSearchParams();

    if (season) search.set("season", season);
    if (date) search.set("date", date);
    if (gameId) search.set("gameId", gameId);

    Object.entries(paramsObj).forEach(([key, value]) => {
      if (value && value !== DEFAULT_RESULT) {
        search.set(key, value);
      }
    });

    router.push(`/?${search.toString()}`);
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

    update({
      playType,
      team,
      quarter,
      player: name,
      result: playType === DEFAULT_PLAY_TYPE ? shotResult : DEFAULT_RESULT,
    });
  }

  function clearPlayer() {
    setPlayerInput("");
    setIsPlayerOpen(false);

    update({
      playType,
      team,
      quarter,
      player: "",
      result: playType === DEFAULT_PLAY_TYPE ? shotResult : DEFAULT_RESULT,
    });
  }

  const isFiltered =
    playType !== DEFAULT_PLAY_TYPE ||
    shotResult !== DEFAULT_RESULT ||
    quarter !== "" ||
    selectedPlayer !== "" ||
    team !== "";

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

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800 px-4 py-3">
      <select
        value={playType}
        onChange={(e) =>
          update({
            playType: e.target.value,
            team,
            quarter,
            result: DEFAULT_RESULT,
            player: "",
          })
        }
        className="h-9 rounded bg-zinc-900 px-3 text-sm text-white"
      >
        {PLAY_TYPES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>

      <select
        value={team}
        onChange={(e) =>
          update({
            playType,
            quarter,
            team: e.target.value,
            result: playType === DEFAULT_PLAY_TYPE ? shotResult : DEFAULT_RESULT,
            player: "",
          })
        }
        className="h-9 rounded bg-zinc-900 px-3 text-sm text-white"
      >
        <option value="">All Teams</option>
        {teams.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>

      {playType === DEFAULT_PLAY_TYPE && (
        <div className="flex gap-2">
          {[DEFAULT_RESULT, "Made", "Missed"].map((value) => (
            <button
              key={value}
              onClick={() =>
                update({
                  playType,
                  team,
                  quarter,
                  result: value,
                  player: selectedPlayer,
                })
              }
              className={`rounded px-3 py-1 text-sm ${
                shotResult === value
                  ? "bg-white text-black"
                  : "bg-zinc-900 text-zinc-400"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      )}

      <select
        value={quarter}
        onChange={(e) =>
          update({
            playType,
            team,
            quarter: e.target.value,
            result: playType === DEFAULT_PLAY_TYPE ? shotResult : DEFAULT_RESULT,
            player: selectedPlayer,
          })
        }
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

      <div className="relative min-w-[220px]">
        <div className="flex items-center gap-2">
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
                      p.name.toLowerCase() === playerInput.trim().toLowerCase(),
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
            className="h-9 w-full rounded bg-zinc-900 px-3 text-sm text-white placeholder:text-zinc-500"
          />

          {selectedPlayer && (
            <button
              onClick={clearPlayer}
              className="h-9 rounded bg-zinc-900 px-3 text-sm text-zinc-300"
            >
              Clear
            </button>
          )}
        </div>

        {isPlayerOpen && filteredPlayers.length > 0 && (
          <div
            ref={listRef}
            className="absolute z-10 mt-2 w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-lg"
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

      {isFiltered && (
        <button
          onClick={clearFilters}
          className="h-9 rounded bg-zinc-800 px-3 text-sm text-zinc-300 hover:bg-zinc-700"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
