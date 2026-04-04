"use client";

import { useRouter, useSearchParams } from "next/navigation";

/** Params that are generally compatible across dates */
const PRESERVE_ON_DATE_CHANGE = ["playType", "quarter", "result", "limit", "season"];

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

        for (const key of PRESERVE_ON_DATE_CHANGE) {
          const val = params.get(key);
          if (val) search.set(key, val);
        }

        router.push(`/?${search.toString()}`);
      }}
      className="h-9 rounded bg-zinc-900 px-3 text-sm text-white"
    />
  );
}
