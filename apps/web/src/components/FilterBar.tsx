"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Player = {
  name: string;
};

export default function FilterBar({ players }: { players: Player[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const shotResult = params.get("result") || "all";
  const selectedPlayer = params.get("player") || "";
  const gameId = params.get("gameId") || "";

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
      {/* RESULT FILTER */}
      <div className="flex gap-2">
        {["all", "Made", "Missed"].map((value) => (
          <button
            key={value}
            onClick={() => update({ result: value, player: selectedPlayer })}
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

      {/* PLAYER DROPDOWN */}
      <select
        value={selectedPlayer}
        onChange={(e) => update({ player: e.target.value, result: shotResult })}
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
