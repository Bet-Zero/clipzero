"use client";

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

export default function SeasonSelector({ selectedSeason }: SeasonSelectorProps) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <select
      value={selectedSeason}
      onChange={(e) => {
        const newSeason = parseSeason(e.target.value);
        const search = new URLSearchParams();

        search.set("season", newSeason);

        // Keep date only if it still falls within the new season
        const currentDate = params.get("date");
        if (currentDate && dateInSeason(currentDate, newSeason)) {
          search.set("date", currentDate);
        } else {
          search.set("date", defaultDateForSeason(newSeason));
        }

        // Preserve limit if set
        const limit = params.get("limit");
        if (limit) search.set("limit", limit);

        // playType resets to default "shots"; gameId, player, team, quarter, result are cleared

        router.push(`/?${search.toString()}`);
      }}
      className="h-9 rounded bg-zinc-900 px-3 text-sm text-white"
    >
      {SEASONS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
