"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "@/components/DatePicker";
import GameSelector from "@/components/GameSelector";
import ModeToggle from "@/components/ModeToggle";
import PlayerModeBrowser from "@/components/PlayerModeBrowser";
import SeasonSelector from "@/components/SeasonSelector";
import type { Season } from "@/lib/season";
import type { Game } from "@/lib/types";

type Props = {
  initialMode: "game" | "player";
  season: Season;
  selectedDate: string;
  games?: Game[];
  selectedGameId?: string;
  gamesApiError?: boolean;
  /** Canonical game-mode date used when navigating to game mode from a player-mode URL */
  gameDate: string;
  /** Server-rendered game content — absent when page was loaded from a player-mode URL */
  children?: React.ReactNode;
};

export default function PageShell({
  initialMode,
  season,
  selectedDate,
  games = [],
  selectedGameId = "",
  gamesApiError = false,
  gameDate,
  children,
}: Props) {
  const [mode, setMode] = useState<"game" | "player">(initialMode);
  // Remember whether the server already rendered game content for us.
  // Once true it stays true for the lifetime of this client component instance.
  const [hasGameContent] = useState(() => children != null);
  const router = useRouter();

  const switchMode = useCallback(
    (newMode: "game" | "player") => {
      if (newMode === mode) return;

      if (newMode === "game" && !hasGameContent) {
        // No server-rendered game content available yet — need a server round-trip.
        const url = new URL(window.location.href);
        url.searchParams.delete("mode");
        if (!url.searchParams.has("date"))
          url.searchParams.set("date", gameDate);
        router.replace(url.pathname + url.search);
        return;
      }

      // Instant client-side switch — update the URL without triggering a
      // Next.js server round-trip, since we already have the content to render.
      setMode(newMode);
      const url = new URL(window.location.href);
      if (newMode === "player") {
        url.searchParams.set("mode", "player");
      } else {
        url.searchParams.delete("mode");
      }
      window.history.replaceState(null, "", url.pathname + url.search);
    },
    [mode, hasGameContent, gameDate, router],
  );

  return (
    <main className="flex h-dvh flex-col bg-black text-white">
      <div className="shrink-0 mx-auto flex w-full items-center gap-3 px-4 py-2">
        <ModeToggle mode={mode} onSwitch={switchMode} />
        <SeasonSelector selectedSeason={season} />
        {mode === "game" && (
          <>
            <div className="h-5 w-px bg-zinc-700" aria-hidden="true" />
            <DatePicker selectedDate={selectedDate} selectedSeason={season} />
            <GameSelector
              games={games}
              selectedGameId={selectedGameId}
              apiError={gamesApiError}
            />
            <div id="filter-bar-portal" />
          </>
        )}
        {mode === "player" && (
          <>
            <div className="h-5 w-px bg-zinc-700 shrink-0" aria-hidden="true" />
            <div id="player-filter-portal" className="contents" />
          </>
        )}
      </div>

      <div className="flex flex-1 min-h-0 flex-col">
        {mode === "game" ? (
          children
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <PlayerModeBrowser season={season} />
          </div>
        )}
      </div>
    </main>
  );
}
