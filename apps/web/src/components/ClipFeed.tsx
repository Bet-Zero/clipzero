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

export default function ClipFeed({ clips }: ClipFeedProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      {clips.map((clip) => (
        <article
          key={`${clip.gameId}-${clip.actionNumber}`}
          className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
        >
          {/* VIDEO */}
          {clip.videoUrl ? (
            <video
              src={clip.videoUrl}
              poster={clip.thumbnailUrl ?? undefined}
              controls
              preload="none"
              className="w-full"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center bg-zinc-900 text-sm text-zinc-500">
              Video unavailable
            </div>
          )}

          {/* META */}
          <div className="space-y-3 p-4">
            {/* TOP ROW */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {clip.playerName ?? "Unknown"}
                </span>

                {clip.shotResult === "Made" && (
                  <span className="rounded bg-green-600/20 px-2 py-0.5 text-xs text-green-400">
                    MADE
                  </span>
                )}

                {clip.shotResult === "Missed" && (
                  <span className="rounded bg-red-600/20 px-2 py-0.5 text-xs text-red-400">
                    MISS
                  </span>
                )}
              </div>

              <span className="text-xs text-zinc-400">
                Q{clip.period} · {clip.clock}
              </span>
            </div>

            {/* DESCRIPTION */}
            <p className="text-sm text-zinc-300">{clip.description}</p>

            {/* FOOTER */}
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <div className="flex gap-2">
                <span>{clip.teamTricode}</span>
                <span>{clip.actionType}</span>
                <span>{clip.subType}</span>
              </div>

              {clip.shotDistance && (
                <span>{Math.round(clip.shotDistance)} ft</span>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
