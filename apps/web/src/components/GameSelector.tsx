"use client";

import { useRouter } from "next/navigation";

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

  return (
    <select
      className="h-9 rounded bg-zinc-900 px-3 text-sm text-white"
      value={selectedGameId}
      onChange={(e) => {
        router.push(`/?gameId=${e.target.value}`);
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
