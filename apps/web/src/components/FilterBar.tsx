"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Player = {
  name: string;
};

const PLAY_TYPES = ["shots", "assists", "rebounds", "turnovers", "fouls"];

export default function FilterBar({
  players,
  teams,
}: {
  players: Player[];
  teams: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const shotResult = params.get("result") || "all";
  const selectedPlayer = params.get("player") || "";
  const date = params.get("date") || "";
  const gameId = params.get("gameId") || "";
  const playType = params.get("playType") || "shots";
  const quarter = params.get("quarter") || "";
  const team = params.get("team") || "";

  const [playerInput, setPlayerInput] = useState(selectedPlayer);

  useEffect(() => {
    setPlayerInput(selectedPlayer);
  }, [selectedPlayer, gameId, team, playType, quarter]);

  function update(paramsObj: Record<string, string | null>) {
    const search = new URLSearchParams();

    if (date) search.set("date", date);
    if (gameId) search.set("gameId", gameId);

    Object.entries(paramsObj).forEach(([key, value]) => {
      if (value && value !== "all") {
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
    update({
      playType,
      team,
      quarter,
      player: name,
      result: playType === "shots" ? shotResult : "all",
    });
  }

  function clearPlayer() {
    setPlayerInput("");
    update({
      playType,
      team,
      quarter,
      player: "",
      result: playType === "shots" ? shotResult : "all",
    });
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
            result: "all",
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
            result: playType === "shots" ? shotResult : "all",
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

      {playType === "shots" && (
        <div className="flex gap-2">
          {["all", "Made", "Missed"].map((value) => (
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
            result: playType === "shots" ? shotResult : "all",
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
      </select>

      <div className="relative min-w-[220px]">
        <div className="flex items-center gap-2">
          <input
            value={playerInput}
            onChange={(e) => setPlayerInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const exactMatch = players.find(
                  (p) =>
                    p.name.toLowerCase() === playerInput.trim().toLowerCase(),
                );
                applyPlayer(exactMatch?.name ?? playerInput.trim());
              }

              if (e.key === "Escape") {
                clearPlayer();
              }
            }}
            placeholder="Search player last name"
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

        {playerInput.trim() !== "" && filteredPlayers.length > 0 && (
          <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-lg">
            {filteredPlayers.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPlayer(p.name)}
                className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-zinc-900"
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
