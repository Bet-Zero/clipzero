"use client";

import { useRouter } from "next/navigation";

type DatePickerProps = {
  selectedDate: string;
};

function shiftDate(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function DatePicker({ selectedDate }: DatePickerProps) {
  const router = useRouter();

  function goToDate(date: string) {
    const search = new URLSearchParams();
    search.set("date", date);
    router.push(`/?${search.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => goToDate(shiftDate(selectedDate, -1))}
        className="h-9 rounded bg-zinc-900 px-3 text-sm text-white"
      >
        Prev
      </button>

      <input
        type="date"
        value={selectedDate}
        onChange={(e) => goToDate(e.target.value)}
        className="h-9 rounded bg-zinc-900 px-3 text-sm text-white"
      />

      <button
        onClick={() => goToDate(shiftDate(selectedDate, 1))}
        className="h-9 rounded bg-zinc-900 px-3 text-sm text-white"
      >
        Next
      </button>
    </div>
  );
}
