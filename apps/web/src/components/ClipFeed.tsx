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

          <div className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold text-white">
                {clip.playerName ?? "Unknown Player"}
              </h2>
              <span className="text-xs text-zinc-400">
                Q{clip.period} · {clip.clock}
              </span>
            </div>

            <p className="text-sm text-zinc-300">{clip.description}</p>

            <div className="flex gap-2 text-xs text-zinc-500">
              <span>{clip.teamTricode}</span>
              <span>{clip.actionType}</span>
              <span>{clip.subType}</span>
              <span>{clip.shotResult}</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
