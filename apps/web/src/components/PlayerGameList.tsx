"use client";

import { useMemo, useState } from "react";
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

type DateGroup = {
  date: string;
  games: PlayerGameLogEntry[];
};

export default function PlayerGameList({
  games,
  excludedGameIds,
  excludedDates,
  onToggleGameId,
  onToggleDate,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<"games" | "dates">("games");

  if (games.length === 0) return null;

  const excludedCount = games.filter((g) => {
    const nd = normalizeDate(g.gameDate);
    return excludedGameIds.has(g.gameId) || excludedDates.has(nd);
  }).length;

  const dateGroups = useMemo(() => {
    const map = new Map<string, PlayerGameLogEntry[]>();
    for (const game of games) {
      const nd = normalizeDate(game.gameDate);
      const existing = map.get(nd);
      if (existing) {
        existing.push(game);
      } else {
        map.set(nd, [game]);
      }
    }
    const groups: DateGroup[] = [];
    for (const [date, dateGames] of map) {
      groups.push({ date, games: dateGames });
    }
    return groups;
  }, [games]);

  const visibleGames = isExpanded ? games : games.slice(0, 5);
  const visibleDates = isExpanded ? dateGroups : dateGroups.slice(0, 8);

  return (
    <div className="mx-auto max-w-3xl px-4">
      <div className="flex items-center gap-2 pb-1">
        <span className="text-xs text-zinc-500">
          {games.length} games · {dateGroups.length} dates
          {excludedCount > 0 && (
            <span className="text-yellow-500"> ({excludedCount} excluded)</span>
          )}
        </span>

        <div className="flex rounded bg-zinc-900 text-[10px]">
          <button
            onClick={() => setViewMode("games")}
            className={`rounded px-1.5 py-0.5 ${
              viewMode === "games"
                ? "bg-zinc-700 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Games
          </button>
          <button
            onClick={() => setViewMode("dates")}
            className={`rounded px-1.5 py-0.5 ${
              viewMode === "dates"
                ? "bg-zinc-700 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Dates
          </button>
        </div>

        {((viewMode === "games" && games.length > 5) ||
          (viewMode === "dates" && dateGroups.length > 8)) && (
          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            {isExpanded
              ? "Show less"
              : `Show all ${viewMode === "games" ? games.length : dateGroups.length}`}
          </button>
        )}
      </div>

      {viewMode === "games" && (
        <div className="flex flex-wrap gap-1">
          {visibleGames.map((game) => {
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
      )}

      {viewMode === "dates" && (
        <div className="flex flex-wrap gap-1">
          {visibleDates.map(({ date, games: dateGames }) => {
            const isDateExcluded = excludedDates.has(date);
            const gameCount = dateGames.length;
            const opponents = dateGames
              .map((g) => g.matchup.split(" ").slice(-1)[0])
              .join(", ");

            return (
              <button
                key={date}
                onClick={() => onToggleDate(date)}
                title={`${date} — ${gameCount} game${gameCount > 1 ? "s" : ""}: ${opponents}\nClick to ${isDateExcluded ? "include" : "exclude"} all clips from this date`}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${
                  isDateExcluded
                    ? "bg-zinc-900 text-zinc-600 line-through"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {date.slice(5)} ({gameCount})
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
