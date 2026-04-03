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
        const search = new URLSearchParams();
        search.set("date", e.target.value);
        router.push(`/?${search.toString()}`);
      }}
      className="h-9 rounded bg-zinc-900 px-3 text-sm text-white"
    />
  );
}
