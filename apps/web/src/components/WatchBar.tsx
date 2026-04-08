"use client";

import { PLAY_TYPE_LABELS } from "@/lib/filterConfig";
import { DEFAULT_PLAY_TYPE, splitMultiValue } from "@/lib/filters";

type GameSummaryInput = {
  matchup: string; // e.g. "LAL @ BOS"
  player: string; // comma-separated player names (URL param)
  team: string; // comma-separated team tricodes (URL param)
  playType: string;
};

type PlayerSummaryInput = {
  playerName: string;
  opponent: string; // tricode or ""
  playType: string;
};

/** Build the compact summary for game mode. */
export function buildGameSummary({
  matchup,
  player,
  team,
  playType,
}: GameSummaryInput): string {
  const parts: string[] = [];

  // 1. matchup
  parts.push(matchup || "No Game");

  // 2. player/team context
  const players = splitMultiValue(player);
  const teams = splitMultiValue(team);
  if (players.length === 1) {
    // Single player — show last name
    const name = players[0];
    const lastName = name.includes(" ") ? name.split(" ").pop()! : name;
    parts.push(lastName);
  } else if (players.length > 1) {
    parts.push(`${players.length} players`);
  } else if (teams.length === 1) {
    parts.push(teams[0]);
  }
  // If no player and no team filter, omit the middle segment

  // 3. play type
  if (playType && playType !== DEFAULT_PLAY_TYPE) {
    parts.push(
      PLAY_TYPE_LABELS[playType as keyof typeof PLAY_TYPE_LABELS] ?? playType,
    );
  } else {
    parts.push("All");
  }

  return parts.join(" · ");
}

/** Build the compact summary for player mode. */
export function buildPlayerSummary({
  playerName,
  opponent,
  playType,
}: PlayerSummaryInput): string {
  const parts: string[] = [];

  // 1. player name — use last name for brevity
  if (playerName) {
    const lastName = playerName.includes(" ")
      ? playerName.split(" ").pop()!
      : playerName;
    parts.push(lastName);
  }

  // 2. opponent
  if (opponent) {
    parts.push(`vs ${opponent}`);
  } else {
    parts.push("All Opponents");
  }

  // 3. play type
  if (playType && playType !== DEFAULT_PLAY_TYPE) {
    parts.push(
      PLAY_TYPE_LABELS[playType as keyof typeof PLAY_TYPE_LABELS] ?? playType,
    );
  } else {
    parts.push("All");
  }

  return parts.join(" · ");
}

type WatchBarProps = {
  summary: string;
  onEdit: () => void;
};

export default function WatchBar({ summary, onEdit }: WatchBarProps) {
  return (
    <div data-testid="watch-bar" className="flex items-center gap-3">
      <span className="truncate text-sm text-zinc-300">{summary}</span>
      <button
        onClick={onEdit}
        className="shrink-0 rounded bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
      >
        Edit
      </button>
    </div>
  );
}
