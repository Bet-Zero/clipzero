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

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function DatePicker({ selectedDate }: DatePickerProps) {
  const router = useRouter();
  const today = getTodayString();
  const yesterday = shiftDate(today, -1);
  const tomorrow = shiftDate(today, 1);

  function goToDate(date: string) {
    const search = new URLSearchParams();
    search.set("date", date);
    router.push(`/?${search.toString()}`);
  }

  function chipClass(isActive: boolean) {
    return `h-9 rounded px-3 text-sm transition ${
      isActive
        ? "bg-white text-black"
        : "bg-zinc-900 text-white hover:bg-zinc-800"
    }`;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => goToDate(yesterday)}
        className={chipClass(selectedDate === yesterday)}
      >
        Yesterday
      </button>

      <button
        onClick={() => goToDate(today)}
        className={chipClass(selectedDate === today)}
      >
        Today
      </button>

      <button
        onClick={() => goToDate(tomorrow)}
        className={chipClass(selectedDate === tomorrow)}
      >
        Tomorrow
      </button>

      <button
        onClick={() => goToDate(shiftDate(selectedDate, -1))}
        className="h-9 rounded bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800"
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
        className="h-9 rounded bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800"
      >
        Next
      </button>
    </div>
  );
}
