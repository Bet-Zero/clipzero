"use client";

import { useState, useEffect, useRef } from "react";
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

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

export default function DatePicker({
  selectedDate,
  selectedSeason,
}: DatePickerProps) {
  const { start, end } = seasonBounds(selectedSeason);
  const router = useRouter();
  const params = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  // Optimistic state for immediate visual feedback
  const [displayDate, setDisplayDate] = useState(selectedDate);
  useEffect(() => {
    setDisplayDate(selectedDate);
  }, [selectedDate]);

  function navigate(dateStr: string) {
    if (dateStr < start || dateStr > end) return;
    setDisplayDate(dateStr);
    const search = new URLSearchParams();
    search.set("date", dateStr);
    for (const key of PRESERVE_ON_DATE_CHANGE) {
      const val = params.get(key);
      if (val) search.set(key, val);
    }
    router.push(`/?${search.toString()}`);
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => navigate(addDays(displayDate, -1))}
        disabled={displayDate <= start}
        className="flex h-7 w-6 items-center justify-center rounded text-sm text-white hover:bg-zinc-700 disabled:opacity-30"
        aria-label="Previous day"
      >
        ‹
      </button>
      <div className="relative">
        <button
          onClick={() => inputRef.current?.showPicker?.()}
          className="h-7 rounded bg-zinc-900 px-2 text-sm text-white hover:bg-zinc-700"
        >
          {formatDisplay(displayDate)}
        </button>
        <input
          ref={inputRef}
          type="date"
          value={displayDate}
          min={start}
          max={end}
          onChange={(e) => navigate(e.target.value)}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
      <button
        onClick={() => navigate(addDays(displayDate, 1))}
        disabled={displayDate >= end}
        className="flex h-7 w-6 items-center justify-center rounded text-sm text-white hover:bg-zinc-700 disabled:opacity-30"
        aria-label="Next day"
      >
        ›
      </button>
    </div>
  );
}
