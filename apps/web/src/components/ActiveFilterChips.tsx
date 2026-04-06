"use client";

export type FilterChip = {
  key: string;
  label: string;
  value?: string; // for multi-select: the specific value to remove
};

type Props = {
  chips: FilterChip[];
  onRemove: (key: string, value?: string) => void;
  onClearAll?: () => void;
};

export default function ActiveFilterChips({
  chips,
  onRemove,
  onClearAll,
}: Props) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 px-4 py-1">
      {chips.map((chip) => (
        <span
          key={chip.value ? `${chip.key}:${chip.value}` : chip.key}
          className="inline-flex items-center gap-1 rounded-full bg-zinc-800 py-0.5 pl-2.5 pr-1 text-xs text-zinc-300"
        >
          {chip.label}
          <button
            onClick={() => onRemove(chip.key, chip.value)}
            className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-700 hover:text-zinc-200"
            aria-label={`Remove ${chip.label} filter`}
          >
            ×
          </button>
        </span>
      ))}
      {onClearAll && chips.length > 1 && (
        <button
          onClick={onClearAll}
          className="ml-1 text-xs text-zinc-500 hover:text-zinc-300"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
