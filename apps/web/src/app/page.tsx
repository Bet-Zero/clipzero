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
  homeTeam?: {
    teamTricode: string;
  };
  awayTeam?: {
    teamTricode: string;
  };
};

type Player = {
  name: string;
};

async function getGames(): Promise<Game[]> {
  try {
    const res = await fetch("http://localhost:4000/games", {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.games ?? [];
  } catch {
    return [];
  }
}

async function getClips(
  gameId: string,
  limit: number,
  player?: string,
  result?: string,
  playType?: string,
  quarter?: string,
  team?: string,
): Promise<{ clips: Clip[]; total: number; players: Player[] }> {
  const search = new URLSearchParams();
  search.set("gameId", gameId);
  search.set("limit", String(limit));

  if (player) search.set("player", player);
  if (result && result !== "all") search.set("result", result);
  if (playType) search.set("playType", playType);
  if (quarter) search.set("quarter", quarter);
  if (team) search.set("team", team);

  try {
    const res = await fetch(
      `http://localhost:4000/clips/game?${search.toString()}`,
      {
        cache: "no-store",
      },
    );
    if (!res.ok) return { clips: [], total: 0, players: [] };
    const data = await res.json();
    return {
      clips: data.clips ?? [],
      total: data.total ?? 0,
      players: data.players ?? [],
    };
  } catch {
    return { clips: [], total: 0, players: [] };
  }
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
    quarter?: string;
    team?: string;
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
  const quarter = params.quarter || "";
  const team = params.team || "";

  const selectedGame = games.find((game) => game.gameId === selectedGameId);
  const teams = [
    selectedGame?.awayTeam?.teamTricode,
    selectedGame?.homeTeam?.teamTricode,
  ].filter(Boolean) as string[];

  const { clips, total, players } = await getClips(
    selectedGameId,
    limit,
    playerFilter,
    resultFilter,
    playType,
    quarter,
    team,
  );

  return (
    <main className="min-h-screen bg-black text-white">
      <FilterBar players={players} teams={teams} />

      <div className="mx-auto max-w-3xl px-4 py-4">
        <GameSelector games={games} selectedGameId={selectedGameId} />
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-2 text-sm text-zinc-400">
        Showing {clips.length} of {total} clips
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-1 text-xs text-zinc-500">
        {team || "All Teams"} • {quarter ? `Q${quarter}` : "All Quarters"} •{" "}
        {playType}
        {playerFilter ? ` • ${playerFilter}` : ""}
        {playType === "shots" && resultFilter !== "all"
          ? ` • ${resultFilter}`
          : ""}
      </div>

      <ClipFeed clips={clips} />
    </main>
  );
}
