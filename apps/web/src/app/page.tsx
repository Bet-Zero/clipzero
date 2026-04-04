import { Suspense } from "react";
import { redirect } from "next/navigation";
import ClipFeedPaginated from "@/components/ClipFeedPaginated";
import DatePicker from "@/components/DatePicker";
import FilterBar from "@/components/FilterBar";
import GameSelector from "@/components/GameSelector";
import SeasonSelector from "@/components/SeasonSelector";
import ClipFeed from "@/components/ClipFeed";
import { buildApiUrl } from "@/lib/api";
import {
  parseSeason,
  seasonForDate,
  dateInSeason,
  defaultDateForSeason,
} from "@/lib/season";

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
      buildApiUrl("/games", search.toString() ? search : undefined),
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
  offset?: number,
): Promise<{
  clips: Clip[];
  total: number;
  players: Player[];
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number | null;
}> {
  const search = new URLSearchParams();
  search.set("gameId", gameId);
  search.set("limit", String(limit));
  search.set("offset", String(offset ?? 0));

  if (player) search.set("player", player);
  if (result && result !== "all") search.set("result", result);
  if (playType) search.set("playType", playType);
  if (quarter) search.set("quarter", quarter);
  if (team) search.set("team", team);

  const empty = {
    clips: [] as Clip[],
    total: 0,
    players: [] as Player[],
    offset: offset ?? 0,
    limit,
    hasMore: false,
    nextOffset: null,
  };

  try {
    const res = await fetch(buildApiUrl("/clips/game", search), {
      cache: "no-store",
    });
    if (!res.ok) return empty;
    const data = await res.json();
    return {
      clips: data.clips ?? [],
      total: data.total ?? 0,
      players: data.players ?? [],
      offset: data.offset ?? offset ?? 0,
      limit: data.limit ?? limit,
      hasMore: data.hasMore ?? false,
      nextOffset: data.nextOffset ?? null,
    };
  } catch {
    return empty;
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

  const {
    clips,
    total,
    players,
    offset: initialOffset,
    hasMore: initialHasMore,
    nextOffset: initialNextOffset,
  } = await getClips(gameId, limit, player, result, playType, quarter, team);

  const filterKey = `${gameId}:${player}:${team}:${result}:${playType}:${quarter}:${limit}`;

  return (
    <>
      <FilterBar players={players} teams={teams} />

      <ClipFeedPaginated
        key={filterKey}
        initialClips={clips}
        initialTotal={total}
        initialLimit={limit}
        initialHasMore={initialHasMore}
        initialNextOffset={initialNextOffset}
        gameId={gameId}
        player={player}
        result={result}
        playType={playType}
        quarter={quarter}
        team={team}
      />
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
    season?: string;
  }>;
}) {
  const params = await searchParams;

  // Derive season: prefer explicit param, then infer from date, then today
  const today = getTodayString();
  const selectedSeason = params.season
    ? parseSeason(params.season)
    : seasonForDate(params.date || today);

  // Use the URL date if it's in-season; otherwise fall back to a sensible default
  const seasonDefault = dateInSeason(today, selectedSeason)
    ? today
    : defaultDateForSeason(selectedSeason);
  const selectedDate =
    params.date && dateInSeason(params.date, selectedSeason)
      ? params.date
      : seasonDefault;

  const games = await getGames(selectedDate);

  // Canonicalize URL: redirect whenever the resolved state diverges from the raw params.
  // Triggers when: season was inferred or coerced, date was inferred or corrected, or
  // gameId is not present in the resolved game list for the selected date.
  const gameIdIsValid =
    !params.gameId || games.some((g) => g.gameId === params.gameId);
  const needsRedirect =
    !params.season ||
    params.season !== selectedSeason ||
    !params.date ||
    params.date !== selectedDate ||
    !gameIdIsValid;

  if (needsRedirect) {
    const canonical = new URLSearchParams();
    canonical.set("season", selectedSeason);
    canonical.set("date", selectedDate);
    // Preserve non-empty filter params as-is
    if (params.limit) canonical.set("limit", params.limit);
    if (params.playType) canonical.set("playType", params.playType);
    if (params.quarter) canonical.set("quarter", params.quarter);
    if (params.result) canonical.set("result", params.result);
    // Keep gameId only if it resolves to a real game; drop player/team when gameId is dropped
    if (gameIdIsValid && params.gameId) {
      canonical.set("gameId", params.gameId);
      if (params.player) canonical.set("player", params.player);
      if (params.team) canonical.set("team", params.team);
    }
    redirect(`/?${canonical.toString()}`);
  }

  const limitParam = Number(params.limit ?? "12");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 12;

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
        <SeasonSelector selectedSeason={selectedSeason} />
        <DatePicker selectedDate={selectedDate} selectedSeason={selectedSeason} />
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
