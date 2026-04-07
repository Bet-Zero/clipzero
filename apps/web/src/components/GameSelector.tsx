"use client";

import { useState, useEffect } from "react";
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

  // Optimistic state for immediate visual feedback
  const [displayGameId, setDisplayGameId] = useState(selectedGameId);
  useEffect(() => {
    setDisplayGameId(selectedGameId);
  }, [selectedGameId]);

  if (games.length === 0) {
    return (
      <select
        data-testid="game-selector"
        className="h-7 rounded bg-zinc-900 px-2 text-sm text-zinc-500 cursor-not-allowed"
        disabled
      >
          <option>
            {apiError
              ? "API unavailable — check the configured API"
              : "No games for this date"}
          </option>
        </select>
      );
  }

  return (
    <select
      data-testid="game-selector"
      className="h-7 rounded bg-zinc-900 px-2 text-sm text-white"
      value={displayGameId}
      onChange={(e) => {
        setDisplayGameId(e.target.value);
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
