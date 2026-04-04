"use client";

import type { Clip } from "@/lib/types";

function formatClock(clock?: string) {
  if (!clock) return "—";
  return clock
    .replace("PT", "")
    .replace("M", ":")
    .replace(".00S", "")
    .replace("S", "");
}

function isShot(clip: Clip): boolean {
  return clip.shotResult === "Made" || clip.shotResult === "Missed";
}

function getResultBadge(shotResult?: string) {
  if (shotResult === "Made") {
    return (
      <span className="rounded bg-green-600/20 px-2 py-0.5 text-xs text-green-400">
        MADE
      </span>
    );
  }
  if (shotResult === "Missed") {
    return (
      <span className="rounded bg-red-600/20 px-2 py-0.5 text-xs text-red-400">
        MISS
      </span>
    );
  }
  return null;
}

function getEventBadge(actionType?: string) {
  if (!actionType) return null;
  return (
    <span className="rounded bg-zinc-700/40 px-2 py-0.5 text-xs text-zinc-300">
      {actionType.toUpperCase()}
    </span>
  );
}

type Props = {
  clip: Clip | null;
};

export default function ClipPlayer({ clip }: Props) {
  if (!clip) {
    return (
      <div className="flex aspect-video max-h-[65vh] w-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-sm text-zinc-500">
        No clip selected
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      {clip.videoUrl ? (
        <video
          key={clip.videoUrl}
          src={clip.videoUrl}
          poster={clip.thumbnailUrl ?? undefined}
          controls
          preload="metadata"
          className="max-h-[65vh] w-full bg-black"
        />
      ) : (
        <div className="flex aspect-video max-h-[65vh] items-center justify-center bg-zinc-900 text-sm text-zinc-500">
          Video unavailable
        </div>
      )}

      <div className="space-y-1 px-4 py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">
              {clip.playerName ?? "Unknown"}
            </span>
            {isShot(clip)
              ? getResultBadge(clip.shotResult)
              : getEventBadge(clip.actionType)}
          </div>
          <span className="shrink-0 text-xs text-zinc-400">
            Q{clip.period ?? "—"} · {formatClock(clip.clock)}
          </span>
        </div>

        <p className="text-sm text-zinc-300">
          {clip.description ?? "No description available."}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
          <span>
            {[clip.teamTricode, clip.subType].filter(Boolean).join(" · ")}
          </span>
          {isShot(clip) && typeof clip.shotDistance === "number" && (
            <span>{Math.round(clip.shotDistance)} ft</span>
          )}
        </div>
      </div>
    </div>
  );
}
