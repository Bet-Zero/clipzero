type Clip = {
  gameId: string;
  actionNumber?: number;
  period?: number;
  clock?: string;
  teamId?: number;
  teamTricode?: string;
  personId?: number;
  playerName?: string;
  actionType?: string;
  subType?: string;
  shotResult?: string;
  shotDistance?: number;
  x?: number;
  y?: number;
  description?: string;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
};

type ClipFeedProps = {
  clips: Clip[];
};

function formatClock(clock?: string) {
  if (!clock) return "—";
  return clock
    .replace("PT", "")
    .replace("M", ":")
    .replace(".00S", "")
    .replace("S", "");
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

export default function ClipFeed({ clips }: ClipFeedProps) {
  if (clips.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-400">
          No clips found for this filter.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      {clips.map((clip) => {
        const key = [
          clip.gameId,
          clip.actionNumber ?? "na",
          clip.period ?? "na",
          clip.clock ?? "na",
          clip.playerName ?? "na",
          clip.description ?? "na",
        ].join(":");

        return (
          <article
            key={key}
            className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
          >
            {clip.videoUrl ? (
              <video
                src={clip.videoUrl}
                poster={clip.thumbnailUrl ?? undefined}
                controls
                preload="none"
                className="w-full bg-black"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-zinc-900 text-sm text-zinc-500">
                Video unavailable
              </div>
            )}

            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    {clip.playerName ?? "Unknown"}
                  </span>
                  {getResultBadge(clip.shotResult)}
                </div>

                <span className="shrink-0 text-xs text-zinc-400">
                  Q{clip.period ?? "—"} · {formatClock(clip.clock)}
                </span>
              </div>

              <p className="text-sm text-zinc-300">
                {clip.description ?? "No description available."}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
                <div className="flex flex-wrap gap-2">
                  {clip.teamTricode && <span>{clip.teamTricode}</span>}
                  {clip.actionType && <span>{clip.actionType}</span>}
                  {clip.subType && <span>{clip.subType}</span>}
                </div>

                {typeof clip.shotDistance === "number" && (
                  <span>{Math.round(clip.shotDistance)} ft</span>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
