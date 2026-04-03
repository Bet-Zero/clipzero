import ClipFeed from "@/components/ClipFeed";
import FilterBar from "@/components/FilterBar";
import GameSelector from "@/components/GameSelector";

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

type Game = {
  gameId: string;
  matchup: string;
};

type Player = {
  name: string;
};

async function getGames(): Promise<Game[]> {
  const res = await fetch("http://localhost:4000/games", {
    cache: "no-store",
  });

  const data = await res.json();
  return data.games;
}

async function getClips(
  gameId: string,
  limit: number,
  player?: string,
  result?: string,
  playType?: string,
): Promise<{ clips: Clip[]; total: number; players: Player[] }> {
  const search = new URLSearchParams();
  search.set("gameId", gameId);
  search.set("limit", String(limit));

  if (player) search.set("player", player);
  if (result && result !== "all") search.set("result", result);
  if (playType) search.set("playType", playType);

  const res = await fetch(
    `http://localhost:4000/clips/game?${search.toString()}`,
    {
      cache: "no-store",
    },
  );

  const data = await res.json();
  return {
    clips: data.clips ?? [],
    total: data.total ?? 0,
    players: data.players ?? [],
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    gameId?: string;
    limit?: string;
    result?: string;
    player?: string;
    playType?: string;
  }>;
}) {
  const games = await getGames();
  const params = await searchParams;

  const limitParam = Number(params.limit ?? "24");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 24;

  const selectedGameId = params.gameId || games[0]?.gameId || "0022501115";
  const resultFilter = params.result || "all";
  const playerFilter = params.player || "";
  const playType = params.playType || "shots";

  const { clips, total, players } = await getClips(
    selectedGameId,
    limit,
    playerFilter,
    resultFilter,
    playType,
  );

  return (
    <main className="min-h-screen bg-black text-white">
      <FilterBar players={players} />

      <div className="mx-auto max-w-3xl px-4 py-4">
        <GameSelector games={games} selectedGameId={selectedGameId} />
      </div>

      <ClipFeed clips={clips} />
    </main>
  );
}
