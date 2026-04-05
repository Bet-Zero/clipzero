"use client";

import { forwardRef } from "react";
import type { Clip } from "@/lib/types";

// Most visually distinctive accent color per team tricode (official palette).
// Secondary colors used where the primary is near-black or shared with multiple teams.
const TEAM_COLORS: Record<string, string> = {
  ATL: "#E03A3E", // Hawks Red
  BOS: "#007A33", // Celtics Green
  BKN: "#999999", // Mid-grey (black/white invisible on dark bg)
  CHA: "#00788C", // Teal
  CHI: "#CE1141", // Bulls Red
  CLE: "#860038", // Cavaliers Wine
  DAL: "#00538C", // Royal Blue
  DEN: "#FEC524", // Sunshine Yellow
  DET: "#C8102E", // Pistons Red
  GSW: "#FFC72C", // Golden Yellow
  HOU: "#CE1141", // Rockets Red
  IND: "#FDBB30", // Pacers Yellow
  LAC: "#1D428A", // Royal Blue (avoids red collision with CHI/HOU/DET)
  LAL: "#552583", // Lakers Purple
  MEM: "#5D76A9", // Beale Street Blue
  MIA: "#98002E", // Heat Maroon
  MIL: "#00471B", // Good Land Green
  MIN: "#236192", // Lake Blue
  NOP: "#85714D", // Pelicans Gold (avoids red collision)
  NYK: "#F58426", // Knicks Orange
  OKC: "#EF3B24", // Sunset Orange (avoids blue collision with ORL/DAL)
  ORL: "#0077C0", // Magic Blue
  PHI: "#006BB6", // Sixers Blue
  PHX: "#E56020", // Suns Orange
  POR: "#E03A3E", // Blazers Red
  SAC: "#5A2D81", // Kings Purple
  SAS: "#C4CED4", // Spurs Silver
  TOR: "#CE1141", // Raptors Red
  UTA: "#002B5C", // Jazz Navy
  WAS: "#E31837", // Wizards Red
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
          {/* Action description — bold + white for makes, normal for misses */}
          <p
            className={`line-clamp-3 text-[11px] leading-snug ${
              clip.shotResult === "Made"
                ? "font-semibold text-white"
                : "text-zinc-400"
            }`}
          >
            {actionLabel}
          </p>

          {/* Period · clock · index */}
          <div className="mt-auto flex items-center justify-between pt-0.5 text-[10px] text-zinc-500">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: teamColor }}
              />
              <span>
                Q{clip.period ?? "—"} · {formatClock(clip.clock)}
              </span>
            </div>
            <span className="tabular-nums">#{index + 1}</span>
          </div>
        </div>
      </button>
    );
  },
);

ClipRailItem.displayName = "ClipRailItem";

export default ClipRailItem;
