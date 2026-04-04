"use client";

import { useState } from "react";
import type { PlayerGameLogEntry } from "@/lib/types";

type Props = {
  games: PlayerGameLogEntry[];
  excludedGameIds: Set<string>;
  excludedDates: Set<string>;
  onToggleGameId: (gameId: string) => void;
  onToggleDate: (date: string) => void;
};

function normalizeDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toISOString().slice(0, 10);
}

export default function PlayerGameList({
  games,
  excludedGameIds,
  excludedDates,
  onToggleGameId,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (games.length === 0) return null;

  const excludedCount = games.filter((g) => {
    const nd = normalizeDate(g.gameDate);
    return excludedGameIds.has(g.gameId) || excludedDates.has(nd);
  }).length;

  const visible = isExpanded ? games : games.slice(0, 5);

  return (
    <div className="mx-auto max-w-3xl px-4">
      <div className="flex items-center gap-2 pb-1">
        <span className="text-xs text-zinc-500">
          {games.length} games
          {excludedCount > 0 && (
            <span className="text-yellow-500"> ({excludedCount} excluded)</span>
          )}
        </span>
        {games.length > 5 && (
          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            {isExpanded ? "Show less" : `Show all ${games.length}`}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {visible.map((game) => {
          const nd = normalizeDate(game.gameDate);
          const isExcluded =
            excludedGameIds.has(game.gameId) || excludedDates.has(nd);

          return (
            <button
              key={game.gameId}
              onClick={() => onToggleGameId(game.gameId)}
              title={`${game.matchup} — ${nd}\n${game.pts}pts ${game.reb}reb ${game.ast}ast\nClick to ${isExcluded ? "include" : "exclude"}`}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                isExcluded
                  ? "bg-zinc-900 text-zinc-600 line-through"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {nd.slice(5)} {game.matchup.split(" ").slice(-1)[0]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
