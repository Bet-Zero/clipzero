"use client";

import { useCallback, useState } from "react";
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
  onEnded?: () => void;
};

export default function ClipPlayer({ clip, onEnded }: Props) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!clip?.videoUrl || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(clip.videoUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${clip.playerName ?? "clip"}-${clip.actionNumber ?? ""}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fall back to opening the URL directly
      window.open(clip.videoUrl!, "_blank");
    } finally {
      setDownloading(false);
    }
  }, [clip?.videoUrl, clip?.playerName, clip?.actionNumber, downloading]);

  if (!clip) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-sm text-zinc-500">
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
          autoPlay
          preload="metadata"
          referrerPolicy="no-referrer"
          className="w-full bg-black"
          onEnded={onEnded}
        />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-zinc-900 text-sm text-zinc-500">
          Video unavailable
        </div>
      )}

      <div className="space-y-1 px-3 py-2">
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
          <div className="flex items-center gap-3">
            {isShot(clip) && typeof clip.shotDistance === "number" && (
              <span>{Math.round(clip.shotDistance)} ft</span>
            )}
            {clip.videoUrl && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-1 rounded bg-zinc-700/50 px-2 py-0.5 text-zinc-300 transition-colors hover:bg-zinc-600/50 hover:text-white disabled:opacity-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3.5 w-3.5"
                >
                  <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                  <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                </svg>
                {downloading ? "Saving…" : "Download"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
