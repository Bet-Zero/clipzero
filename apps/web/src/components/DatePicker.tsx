"use client";

type DatePickerProps = {
  selectedDate: string;
};

export default function DatePicker({ selectedDate }: DatePickerProps) {
  return (
    <input
      type="date"
      value={selectedDate}
      readOnly
      className="h-9 rounded bg-zinc-900 px-3 text-sm text-zinc-500"
    />
  );
}
