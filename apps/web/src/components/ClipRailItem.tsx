"use client";

import { forwardRef } from "react";
import type { Clip } from "@/lib/types";

// Primary or most-visible accent color per team tricode.
// For teams whose primary is near-black, a recognizable secondary is used instead.
const TEAM_COLORS: Record<string, string> = {
  ATL: "#E03A3E",
  BOS: "#007A33",
  BKN: "#999999",
  CHA: "#00788C",
  CHI: "#CE1141",
  CLE: "#860038",
  DAL: "#00538C",
  DEN: "#FEC524",
  DET: "#C8102E",
  GSW: "#FDB927",
  HOU: "#CE1141",
  IND: "#FDBB30",
  LAC: "#C8102E",
  LAL: "#552583",
  MEM: "#5D76A9",
  MIA: "#98002E",
  MIL: "#00471B",
  MIN: "#236192",
  NOP: "#E31837",
  NYK: "#F58426",
  OKC: "#007AC1",
  ORL: "#0077C0",
  PHI: "#006BB6",
  PHX: "#E56020",
  POR: "#E03A3E",
  SAC: "#5A2D81",
  SAS: "#8A9BB0",
  TOR: "#CE1141",
  UTA: "#F9A01B",
  WAS: "#E31837",
};

function getTeamColor(tricode?: string): string {
  return (tricode && TEAM_COLORS[tricode]) ?? "#52525B"; // zinc-600 fallback
}

function formatClock(clock?: string) {
  if (!clock) return "—";
  return clock
    .replace("PT", "")
    .replace("M", ":")
    .replace(".00S", "")
    .replace("S", "");
}

// NBA live play-by-play descriptions start with the player's last name
// (e.g. "Curry MISS 3pt Jump Shot", "Davis Defensive Rebound").
// Strip only that leading last name so it isn't shown twice — keep everything else.
function cleanDescription(desc: string | undefined, playerName: string | undefined): string | null {
  if (!desc) return null;
  let clean = desc.trim();

  if (playerName) {
    const lastName = playerName.trim().split(" ").at(-1) ?? "";
    if (lastName && clean.toLowerCase().startsWith(lastName.toLowerCase())) {
      clean = clean.slice(lastName.length).trim();
    }
  }

  return clean || null;
}

type Props = {
  clip: Clip;
  isActive: boolean;
  index: number;
  onClick: () => void;
};

const ClipRailItem = forwardRef<HTMLButtonElement, Props>(
  ({ clip, isActive, index, onClick }, ref) => {
    const actionLabel =
      cleanDescription(clip.description, clip.playerName) ?? clip.subType ?? clip.actionType ?? "—";

    return (
      <button
        ref={ref}
        onClick={onClick}
        aria-pressed={isActive}
        className={`flex w-44 shrink-0 flex-col overflow-hidden rounded-md border text-left transition ${
          isActive
            ? "border-white bg-zinc-800"
            : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 hover:bg-zinc-900"
        }`}
      >
        {/* Team color stripe */}
        <div
          className="h-1 w-full shrink-0"
          style={{ backgroundColor: getTeamColor(clip.teamTricode) }}
        />

        {/* Card content */}
        <div className="flex flex-1 flex-col gap-1 p-2">
          {/* Row 1: player name + clip index */}
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-xs font-semibold text-white">
              {clip.playerName ?? "Unknown"}
            </span>
            <span className="shrink-0 text-[10px] text-zinc-500">
              #{index + 1}
            </span>
          </div>

          {/* Row 2: action description */}
          <p className="line-clamp-2 text-[11px] leading-tight text-zinc-300">
            {actionLabel}
          </p>

          {/* Row 3: period · clock + shot result */}
          <div className="flex items-center justify-between text-[10px] text-zinc-500">
            <span>
              Q{clip.period ?? "—"} · {formatClock(clip.clock)}
            </span>
            {clip.shotResult === "Made" && (
              <span className="text-green-400">MADE</span>
            )}
            {clip.shotResult === "Missed" && (
              <span className="text-red-400">MISS</span>
            )}
          </div>
        </div>
      </button>
    );
  },
);

ClipRailItem.displayName = "ClipRailItem";

export default ClipRailItem;
