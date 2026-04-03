"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Game = {
  gameId: string;
  matchup: string;
};

type GameSelectorProps = {
  games: Game[];
  selectedGameId: string;
};

export default function GameSelector({
  games,
  selectedGameId,
}: GameSelectorProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pendingGameId, setPendingGameId] = useState(selectedGameId);

  useEffect(() => {
    setPendingGameId(selectedGameId);
  }, [selectedGameId]);

  function selectGame(gameId: string) {
    setPendingGameId(gameId);

    const search = new URLSearchParams(params.toString());
    search.set("gameId", gameId);
    search.delete("player");
    search.delete("team");
    router.push(`/?${search.toString()}`);
  }

  if (games.length === 0) {
    return (
      <div className="rounded bg-zinc-900 px-3 py-2 text-sm text-zinc-400">
        No games found for this date.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {games.map((game) => {
        const isActive = game.gameId === pendingGameId;

        return (
          <button
            key={game.gameId}
            onClick={() => selectGame(game.gameId)}
            className={`rounded px-3 py-2 text-sm transition ${
              isActive
                ? "bg-white text-black"
                : "bg-zinc-900 text-white hover:bg-zinc-800"
            }`}
          >
            {game.matchup}
          </button>
        );
      })}
    </div>
  );
}
