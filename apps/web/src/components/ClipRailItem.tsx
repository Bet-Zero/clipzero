"use client";

import { forwardRef } from "react";
import type { Clip } from "@/lib/types";

type Props = {
  clip: Clip;
  isActive: boolean;
  index: number;
  onClick: () => void;
};

function formatClock(clock?: string) {
  if (!clock) return "—";
  return clock
    .replace("PT", "")
    .replace("M", ":")
    .replace(".00S", "")
    .replace("S", "");
}

const ClipRailItem = forwardRef<HTMLButtonElement, Props>(
  ({ clip, isActive, index, onClick }, ref) => {
    return (
      <button
        ref={ref}
        onClick={onClick}
        aria-pressed={isActive}
        className={`flex w-44 shrink-0 flex-col gap-0.5 rounded-md border p-2 text-left transition ${
          isActive
            ? "border-white bg-zinc-800"
            : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 hover:bg-zinc-900"
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-xs font-semibold text-white">
            {clip.playerName ?? "Unknown"}
          </span>
          <span className="shrink-0 text-[10px] text-zinc-500">
            #{index + 1}
          </span>
        </div>

        <p className="line-clamp-2 text-[11px] leading-tight text-zinc-400">
          {clip.description ?? "No description"}
        </p>

        <div className="mt-auto text-[10px] text-zinc-500">
          Q{clip.period ?? "—"} · {formatClock(clip.clock)}
          {clip.teamTricode ? ` · ${clip.teamTricode}` : ""}
        </div>
      </button>
    );
  },
);

ClipRailItem.displayName = "ClipRailItem";

export default ClipRailItem;
