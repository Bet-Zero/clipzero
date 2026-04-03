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

async function getGames(): Promise<Game[]> {
  const res = await fetch("http://localhost:4000/games", {
    cache: "no-store",
  });

  const data = await res.json();
  return data.games;
}

async function getClips(gameId: string): Promise<Clip[]> {
  const res = await fetch(`http://localhost:4000/clips/game?gameId=${gameId}`, {
    cache: "no-store",
  });

  const data = await res.json();
  return data.clips;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ gameId?: string }>;
}) {
  const games = await getGames();
  const params = await searchParams;

  const selectedGameId = params.gameId || games[0]?.gameId || "0022501115";

  const clips = await getClips(selectedGameId);

  const resultFilter = params.result;

  let filteredClips = clips;

  if (resultFilter && resultFilter !== "all") {
    filteredClips = filteredClips.filter((c) => c.shotResult === resultFilter);
  }

  const playerFilter = params.player;

  if (playerFilter) {
    filteredClips = filteredClips.filter((c) => c.playerName === playerFilter);
  }

  const players = Array.from(
    new Set(clips.map((c) => c.playerName).filter(Boolean)),
  ).map((name) => ({ name }));

  return (
    <main className="min-h-screen bg-black text-white">
      <FilterBar players={players} />

      <div className="mx-auto max-w-3xl px-4 py-4">
        <GameSelector games={games} selectedGameId={selectedGameId} />
      </div>

      <ClipFeed clips={filteredClips} />
    </main>
  );
}
