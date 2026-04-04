import { Suspense } from "react";
import ClipFeed from "@/components/ClipFeed";
import DatePicker from "@/components/DatePicker";
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

async function getGames(date?: string): Promise<Game[]> {
  const search = new URLSearchParams();
  if (date) search.set("date", date);

  try {
    const res = await fetch(
      `http://localhost:4000/games${search.toString() ? `?${search.toString()}` : ""}`,
      {
        cache: "no-store",
      },
    );
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

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function ClipsFallback() {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="h-9 w-28 rounded bg-zinc-900 animate-pulse" />
        <div className="h-9 w-28 rounded bg-zinc-900 animate-pulse" />
        <div className="h-9 w-28 rounded bg-zinc-900 animate-pulse" />
        <div className="h-9 w-40 rounded bg-zinc-900 animate-pulse" />
      </div>
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
          >
            <div className="aspect-video w-full bg-zinc-900 animate-pulse" />
            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="h-4 w-32 rounded bg-zinc-900 animate-pulse" />
                <div className="h-3 w-16 rounded bg-zinc-900 animate-pulse" />
              </div>
              <div className="h-4 w-full rounded bg-zinc-900 animate-pulse" />
              <div className="h-4 w-4/5 rounded bg-zinc-900 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

async function ClipsSection({
  gameId,
  limit,
  player,
  result,
  playType,
  quarter,
  team,
  teams,
}: {
  gameId: string;
  limit: number;
  player: string;
  result: string;
  playType: string;
  quarter: string;
  team: string;
  teams: string[];
}) {
  if (!gameId) {
    return (
      <>
        <FilterBar players={[]} teams={[]} />

        <div className="mx-auto max-w-3xl px-4 pt-2 text-sm text-zinc-400">
          Showing 0 of 0 clips
        </div>

        <div className="mx-auto max-w-3xl px-4 pt-1 text-xs text-zinc-500">
          {team || "All Teams"} • {quarter ? `Q${quarter}` : "All Quarters"} •{" "}
          {playType}
          {player ? ` • ${player}` : ""}
          {playType === "shots" && result !== "all" ? ` • ${result}` : ""}
        </div>

        <ClipFeed clips={[]} />
      </>
    );
  }

  const { clips, total, players } = await getClips(
    gameId,
    limit,
    player,
    result,
    playType,
    quarter,
    team,
  );
  return (
    <>
      <FilterBar players={players} teams={teams} />

      <div className="mx-auto max-w-3xl px-4 pt-2 text-sm text-zinc-400">
        Showing {clips.length} of {total} clips
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-1 text-xs text-zinc-500">
        {team || "All Teams"} • {quarter ? `Q${quarter}` : "All Quarters"} •{" "}
        {playType}
        {player ? ` • ${player}` : ""}
        {playType === "shots" && result !== "all" ? ` • ${result}` : ""}
      </div>

      <ClipFeed clips={clips} />
    </>
  );
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
    date?: string;
    quarter?: string;
    team?: string;
  }>;
}) {
  const params = await searchParams;
  const selectedDate = params.date || getTodayString();
  const games = await getGames(selectedDate);

  const limitParam = Number(params.limit ?? "24");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 24;

  const selectedGameId = params.gameId || games[0]?.gameId || "";
  const resultFilter = params.result || "all";
  const playerFilter = params.player || "";
  const playType = params.playType || "shots";
  const quarter = params.quarter || "";
  const team = params.team || "";

  const selectedGame = selectedGameId
    ? games.find((game) => game.gameId === selectedGameId)
    : undefined;
  const teams = [
    selectedGame?.awayTeam?.teamTricode,
    selectedGame?.homeTeam?.teamTricode,
  ].filter(Boolean) as string[];

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-4">
        <DatePicker selectedDate={selectedDate} />
        <GameSelector games={games} selectedGameId={selectedGameId} />
      </div>

      <Suspense fallback={<ClipsFallback />}>
        <ClipsSection
          gameId={selectedGameId}
          limit={limit}
          player={playerFilter}
          result={resultFilter}
          playType={playType}
          quarter={quarter}
          team={team}
          teams={teams}
        />
      </Suspense>
    </main>
  );
}
