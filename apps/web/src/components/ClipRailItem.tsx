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
function cleanDescription(
  desc: string | undefined,
  playerName: string | undefined,
): string | null {
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
    const teamColor = getTeamColor(clip.teamTricode);
    const actionLabel =
      cleanDescription(clip.description, clip.playerName) ??
      clip.subType ??
      clip.actionType ??
      "—";

    return (
      <button
        ref={ref}
        onClick={onClick}
        aria-pressed={isActive}
        className={`group relative flex w-44 shrink-0 flex-col overflow-hidden rounded-lg text-left transition-all duration-200 ${
          isActive
            ? "scale-[1.03] ring-1 ring-white/80"
            : "hover:scale-[1.02] hover:brightness-110"
        }`}
        style={{
          background: isActive
            ? `linear-gradient(to bottom, ${teamColor}18, #18181b 40%)`
            : "#09090b",
          boxShadow: isActive
            ? `0 0 16px 2px ${teamColor}30, 0 2px 8px rgba(0,0,0,.5)`
            : "0 1px 4px rgba(0,0,0,.4)",
          border: isActive ? `1px solid ${teamColor}60` : "1px solid #27272a",
        }}
      >
        {/* Team color accent bar */}
        <div
          className="h-1 w-full shrink-0"
          style={{ backgroundColor: teamColor }}
        />

        {/* Card content */}
        <div className="flex flex-1 flex-col gap-1 px-2.5 pt-2 pb-2.5">
          {/* Row 1: index + shot result */}
          <div className="flex items-center justify-between gap-1">
            <span className="flex shrink-0 items-center gap-1.5">
              {clip.shotResult === "Made" && (
                <span className="rounded-full bg-green-500/20 px-1.5 py-0.5 text-[9px] font-bold text-green-400">
                  MADE
                </span>
              )}
              {clip.shotResult === "Missed" && (
                <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                  MISS
                </span>
              )}
            </span>
            <span className="text-[10px] tabular-nums text-zinc-500">
              #{index + 1}
            </span>
          </div>

          {/* Action description */}
          <p className="line-clamp-2 text-[11px] leading-snug text-zinc-400">
            {actionLabel}
          </p>

          {/* Period · clock */}
          <div className="mt-auto flex items-center gap-1.5 pt-0.5 text-[10px] text-zinc-500">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: teamColor }}
            />
            <span>
              Q{clip.period ?? "—"} · {formatClock(clip.clock)}
            </span>
          </div>
        </div>
      </button>
    );
  },
);

ClipRailItem.displayName = "ClipRailItem";

export default ClipRailItem;
