"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Player = {
  name: string;
};

const PLAY_TYPES = ["shots", "assists", "rebounds", "turnovers", "fouls"];

export default function FilterBar({ players }: { players: Player[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const shotResult = params.get("result") || "all";
  const selectedPlayer = params.get("player") || "";
  const gameId = params.get("gameId") || "";
  const playType = params.get("playType") || "shots";
  const quarter = params.get("quarter") || "";

  function update(paramsObj: Record<string, string | null>) {
    const search = new URLSearchParams();

    if (gameId) search.set("gameId", gameId);

    Object.entries(paramsObj).forEach(([key, value]) => {
      if (value && value !== "all") {
        search.set(key, value);
      }
    });

    router.push(`/?${search.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800 px-4 py-3">
      <select
        value={playType}
        onChange={(e) =>
          update({
            playType: e.target.value,
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

      {playType === "shots" && (
        <div className="flex gap-2">
          {["all", "Made", "Missed"].map((value) => (
            <button
              key={value}
              onClick={() =>
                update({
                  playType,
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

      <select
        value={selectedPlayer}
        onChange={(e) =>
          update({
            playType,
            quarter,
            player: e.target.value,
            result: playType === "shots" ? shotResult : "all",
          })
        }
        className="h-9 rounded bg-zinc-900 px-3 text-sm text-white"
      >
        <option value="">All Players</option>
        {players.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
