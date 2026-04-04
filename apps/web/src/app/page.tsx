import { Suspense } from "react";
import { redirect } from "next/navigation";
import ClipBrowser from "@/components/ClipBrowser";
import DatePicker from "@/components/DatePicker";
import FilterBar from "@/components/FilterBar";
import GameSelector from "@/components/GameSelector";
import ModeToggle from "@/components/ModeToggle";
import PlayerModeBrowser from "@/components/PlayerModeBrowser";
import SeasonSelector from "@/components/SeasonSelector";
import { buildApiUrl } from "@/lib/api";
import {
  parseSeason,
  seasonForDate,
  dateInSeason,
  defaultDateForSeason,
} from "@/lib/season";
import type { Game, ClipsResponse } from "@/lib/types";
import {
  DEFAULT_PLAY_TYPE,
  DEFAULT_RESULT,
  buildClipSearchParams,
} from "@/lib/filters";

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
  actionNumber?: number | null,
): Promise<ClipsResponse> {
  const search = buildClipSearchParams({
    gameId,
    limit,
    offset: offset ?? 0,
    player,
    result,
    playType,
    quarter,
    team,
    actionNumber,
  });

  const empty: ClipsResponse = {
    clips: [],
    total: 0,
    players: [],
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
      targetIndex: data.targetIndex ?? undefined,
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
      <div className="mx-auto max-w-3xl px-4 py-4">
        {/* rail skeleton */}
        <div className="mb-4 flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-24 w-44 shrink-0 animate-pulse rounded-lg bg-zinc-900"
            />
          ))}
        </div>
        {/* player skeleton */}
        <div className="aspect-video w-full animate-pulse rounded-xl bg-zinc-900" />
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
  actionNumber,
}: {
  gameId: string;
  limit: number;
  player: string;
  result: string;
  playType: string;
  quarter: string;
  team: string;
  teams: string[];
  actionNumber: number | null;
}) {
  if (!gameId) {
    return (
      <>
        <FilterBar players={[]} teams={[]} />
        <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-zinc-400">
          Select a game to load clips.
        </div>
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
    targetIndex: initialTargetIndex,
  } = await getClips(
    gameId,
    limit,
    player,
    result,
    playType,
    quarter,
    team,
    undefined,
    actionNumber,
  );

  const filterKey = `${gameId}:${player}:${team}:${result}:${playType}:${quarter}:${limit}`;

  return (
    <>
      <FilterBar players={players} teams={teams} />

      <ClipBrowser
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
        initialActionNumber={actionNumber}
        initialTargetIndex={initialTargetIndex ?? null}
      />
    </>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    gameId?: string;
    limit?: string;
    result?: string;
    player?: string;
    playType?: string;
    date?: string;
    quarter?: string;
    team?: string;
    season?: string;
    actionNumber?: string;
    personId?: string;
    playerName?: string;
    teamTricode?: string;
    excludeGameIds?: string;
    excludeDates?: string;
  }>;
}) {
  const params = await searchParams;
  const mode = params.mode === "player" ? "player" : "game";

  // Derive season: prefer explicit param, then infer from date, then today
  const today = getTodayString();
  const selectedSeason = params.season
    ? parseSeason(params.season)
    : seasonForDate(params.date || today);

  // ── Player mode: skip game-scoped data fetching entirely ──
  if (mode === "player") {
    return (
      <main className="min-h-screen bg-black text-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-2">
          <ModeToggle mode={mode} />
          <SeasonSelector selectedSeason={selectedSeason} />
        </div>

        <PlayerModeBrowser season={selectedSeason} />
      </main>
    );
  }

  // ── Game mode (existing flow) ──

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
    // Keep gameId only if it resolves to a real game; drop player/team/actionNumber when gameId is dropped
    if (gameIdIsValid && params.gameId) {
      canonical.set("gameId", params.gameId);
      if (params.player) canonical.set("player", params.player);
      if (params.team) canonical.set("team", params.team);
      if (params.actionNumber)
        canonical.set("actionNumber", params.actionNumber);
    }
    redirect(`/?${canonical.toString()}`);
  }

  const limitParam = Number(params.limit ?? "12");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 12;

  const selectedGameId = params.gameId || games[0]?.gameId || "";
  const resultFilter = params.result || DEFAULT_RESULT;
  const playerFilter = params.player || "";
  const playType = params.playType || DEFAULT_PLAY_TYPE;
  const quarter = params.quarter || "";
  const team = params.team || "";

  const selectedGame = selectedGameId
    ? games.find((game) => game.gameId === selectedGameId)
    : undefined;
  const teams = [
    selectedGame?.awayTeam?.teamTricode,
    selectedGame?.homeTeam?.teamTricode,
  ].filter(Boolean) as string[];

  const actionNumberParam = Number(params.actionNumber ?? "");
  const actionNumber =
    params.actionNumber &&
    Number.isFinite(actionNumberParam) &&
    actionNumberParam > 0
      ? actionNumberParam
      : null;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-2">
        <ModeToggle mode={mode} />
        <SeasonSelector selectedSeason={selectedSeason} />
        <DatePicker
          selectedDate={selectedDate}
          selectedSeason={selectedSeason}
        />
        <GameSelector games={games} selectedGameId={selectedGameId} />
        <div id="filter-bar-portal" />
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
          actionNumber={actionNumber}
        />
      </Suspense>
    </main>
  );
}
