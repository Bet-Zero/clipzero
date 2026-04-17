"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SEASONS,
  parseSeason,
  dateInSeason,
  defaultDateForSeason,
} from "@/lib/season";

type SeasonSelectorProps = {
  selectedSeason: string;
};

export default function SeasonSelector({
  selectedSeason,
}: SeasonSelectorProps) {
  const router = useRouter();
  const params = useSearchParams();

  // Optimistic state for immediate visual feedback
  const [displaySeason, setDisplaySeason] = useState(selectedSeason);
  useEffect(() => {
    setDisplaySeason(selectedSeason);
  }, [selectedSeason]);

  return (
    <select
      value={displaySeason}
      onChange={(e) => {
        const newSeason = parseSeason(e.target.value);
        setDisplaySeason(newSeason);
        const search = new URLSearchParams();

        search.set("season", newSeason);

        const mode = params.get("mode");
        if (mode === "player" || mode === "matchup") {
          search.set("mode", mode);
          if (mode === "matchup") {
            const teamA = params.get("teamA");
            const teamB = params.get("teamB");
            if (teamA) search.set("teamA", teamA);
            if (teamB) search.set("teamB", teamB);
          }
        } else {
          // Keep date only if it still falls within the new season.
          const currentDate = params.get("date");
          if (currentDate && dateInSeason(currentDate, newSeason)) {
            search.set("date", currentDate);
          } else {
            search.set("date", defaultDateForSeason(newSeason));
          }
        }

        // Preserve limit if set
        const limit = params.get("limit");
        if (limit) search.set("limit", limit);

        // playType resets to default "all"; gameId, player, team, quarter, result are cleared

        router.push(`/?${search.toString()}`);
      }}
      className="h-7 rounded bg-zinc-900 px-2 text-sm text-white"
    >
      {SEASONS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
