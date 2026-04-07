"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type Season, seasonBounds } from "@/lib/season";

/** Params that are generally compatible across dates */
const PRESERVE_ON_DATE_CHANGE = [
  "playType",
  "quarter",
  "result",
  "limit",
  "season",
];

type DatePickerProps = {
  selectedDate: string;
  selectedSeason: Season;
};

export default function DatePicker({
  selectedDate,
  selectedSeason,
}: DatePickerProps) {
  const { start, end } = seasonBounds(selectedSeason);
  const router = useRouter();
  const params = useSearchParams();

  return (
    <input
      type="date"
      value={selectedDate}
      min={start}
      max={end}
      onChange={(e) => {
        const search = new URLSearchParams();
        search.set("date", e.target.value);

        for (const key of PRESERVE_ON_DATE_CHANGE) {
          const val = params.get(key);
          if (val) search.set(key, val);
        }

        router.push(`/?${search.toString()}`);
      }}
      className="h-7 rounded bg-zinc-900 px-2 text-sm text-white"
    />
  );
}
