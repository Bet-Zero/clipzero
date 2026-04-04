"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Game } from "@/lib/types";

type GameSelectorProps = {
  games: Game[];
  selectedGameId: string;
  apiError?: boolean;
};

export default function GameSelector({
  games,
  selectedGameId,
  apiError,
}: GameSelectorProps) {
  const router = useRouter();
  const params = useSearchParams();

  if (games.length === 0) {
    return (
      <select
        data-testid="game-selector"
        className="h-9 rounded bg-zinc-900 px-3 text-sm text-zinc-500 cursor-not-allowed"
        disabled
      >
        <option>
          {apiError
            ? "API unavailable — check localhost:4000"
            : "No games for this date"}
        </option>
      </select>
    );
  }

  return (
    <select
      data-testid="game-selector"
      className="h-9 rounded bg-zinc-900 px-3 text-sm text-white"
      value={selectedGameId}
      onChange={(e) => {
        const search = new URLSearchParams(params.toString());
        search.set("gameId", e.target.value);
        search.delete("player");
        search.delete("team");
        search.delete("actionNumber");
        router.push(`/?${search.toString()}`);
      }}
    >
      {games.map((game) => (
        <option key={game.gameId} value={game.gameId}>
          {game.matchup}
        </option>
      ))}
    </select>
  );
}
