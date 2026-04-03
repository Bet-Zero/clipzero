"use client";

import { useRouter, useSearchParams } from "next/navigation";

type DatePickerProps = {
  selectedDate: string;
};

export default function DatePicker({ selectedDate }: DatePickerProps) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <input
      type="date"
      value={selectedDate}
      onChange={(e) => {
        const search = new URLSearchParams(params.toString());
        search.set("date", e.target.value);
        search.delete("gameId");
        search.delete("player");
        search.delete("team");
        router.push(`/?${search.toString()}`);
      }}
      className="h-9 rounded bg-zinc-900 px-3 text-sm text-white"
    />
  );
}
