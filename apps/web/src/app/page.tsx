import { Suspense } from "react";
import { redirect } from "next/navigation";
import ClipBrowser from "@/components/ClipBrowser";
import FilterBar from "@/components/FilterBar";
import PageShell from "@/components/PageShell";
import { buildApiUrl, getApiUnavailableMessage } from "@/lib/api";
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
  cleanSearchString,
  canonicalMultiValue,
} from "@/lib/filters";

async function getGames(
  date?: string,
): Promise<{ games: Game[]; apiError: boolean; apiErrorMessage?: string }> {
  const search = new URLSearchParams();
  if (date) search.set("date", date);

  try {
    const url = buildApiUrl("/games", search.toString() ? search : undefined);
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        games: [],
        apiError: true,
        apiErrorMessage: `GET /games failed: ${res.status} ${res.statusText}${
          text ? ` — ${text}` : ""
        }`,
      };
    }

    const data = await res.json();
    return { games: data.games ?? [], apiError: false };
  } catch (error) {
    return {
      games: [],
      apiError: true,
      apiErrorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

type ClipsResult = ClipsResponse & { apiError: boolean };

async function getClips(
  gameId: string,
  limit: number,
  player?: string,
  result?: string,
  playType?: string,
  quarter?: string,
  team?: string,
  shotValue?: string,
  subType?: string,
  distanceBucket?: string,
  offset?: number,
  actionNumber?: number | null,
  positionGroup?: string,
  playerIds?: string,
): Promise<ClipsResult> {
  const search = buildClipSearchParams({
    gameId,
    limit,
    offset: offset ?? 0,
    player,
    result,
    playType,
    quarter,
    team,
    shotValue,
    subType,
    distanceBucket,
    actionNumber,
    positionGroup,
    playerIds,
  });

  const empty: ClipsResult = {
    clips: [],
    total: 0,
    players: [],
    offset: offset ?? 0,
    limit,
    hasMore: false,
    nextOffset: null,
    apiError: false,
  };

  try {
    const res = await fetch(buildApiUrl("/clips/game", search), {
      cache: "no-store",
    });
    if (!res.ok) return { ...empty, apiError: true };
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
      apiError: false,
    };
  } catch {
    return { ...empty, apiError: true };
  }
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function ClipsFallback() {
  return (
    <>
      <div className="mx-auto flex min-h-0 max-w-3xl flex-1 flex-col px-4 py-4">
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
  gamesApiError,
  gamesApiErrorMessage,
  limit,
  player,
  result,
  playType,
  quarter,
  team,
  teams,
  shotValue,
  subType,
  distanceBucket,
  actionNumber,
  homeTeamTricode,
  matchup,
  group,
}: {
  gameId: string;
  gamesApiError: boolean;
  gamesApiErrorMessage?: string;
  limit: number;
  player: string;
  result: string;
  playType: string;
  quarter: string;
  team: string;
  teams: string[];
  shotValue: string;
  subType: string;
  distanceBucket: string;
  actionNumber: number | null;
  homeTeamTricode?: string;
  matchup?: string;
  group: string;
}) {
  if (gamesApiError) {
    return (
      <>
        <FilterBar players={[]} teams={[]} matchup="" />
        <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-red-400">
          {gamesApiErrorMessage || getApiUnavailableMessage()}
        </div>
      </>
    );
  }

  if (!gameId) {
    return (
      <>
        <FilterBar players={[]} teams={[]} matchup="" />
        <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-zinc-400">
          Select a game to load clips.
        </div>
      </>
    );
  }

  // Resolve group param into API filter params:
  // - "position:X" → positionGroup=X
  // - "custom:..." → resolved client-side, passed as playerIds (not here — SSR can't read localStorage)
  let positionGroup: string | undefined;
  if (group.startsWith("position:")) {
    positionGroup = group.slice("position:".length);
  }

  const clipsData = await getClips(
    gameId,
    limit,
    player,
    result,
    playType,
    quarter,
    team,
    shotValue,
    subType,
    distanceBucket,
    undefined,
    actionNumber,
    positionGroup,
  );

  if (clipsData.apiError) {
    return (
      <>
        <FilterBar players={[]} teams={[]} matchup="" />
        <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-red-400">
          {getApiUnavailableMessage()}
        </div>
      </>
    );
  }

  const {
    clips,
    total,
    players,
    hasMore: initialHasMore,
    nextOffset: initialNextOffset,
  } = clipsData;

  const filterKey = `${gameId}:${player}:${team}:${result}:${playType}:${quarter}:${shotValue}:${subType}:${distanceBucket}:${group}:${limit}`;

  return (
    <>
      <FilterBar players={players} teams={teams} matchup={matchup ?? ""} />

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
        shotValue={shotValue}
        subType={subType}
        distanceBucket={distanceBucket}
        initialActionNumber={actionNumber}
        homeTeamTricode={homeTeamTricode}
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
    shotValue?: string;
    subType?: string;
    distanceBucket?: string;
    personId?: string;
    playerName?: string;
    teamTricode?: string;
    excludeGameIds?: string;
    excludeDates?: string;
    group?: string;
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
    const fallbackGameDate = dateInSeason(today, selectedSeason)
      ? today
      : defaultDateForSeason(selectedSeason);
    return (
      <PageShell
        initialMode="player"
        season={selectedSeason}
        selectedDate={fallbackGameDate}
        gameDate={fallbackGameDate}
      />
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

  const {
    games,
    apiError: gamesApiError,
    apiErrorMessage: gamesApiErrorMessage,
  } = await getGames(selectedDate);

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
    if (params.quarter)
      canonical.set("quarter", canonicalMultiValue(params.quarter));
    if (params.result) canonical.set("result", params.result);
    if (params.shotValue) canonical.set("shotValue", params.shotValue);
    if (params.subType)
      canonical.set("subType", canonicalMultiValue(params.subType));
    if (params.distanceBucket)
      canonical.set(
        "distanceBucket",
        canonicalMultiValue(params.distanceBucket),
      );
    // Keep gameId only if it resolves to a real game; drop player/team/actionNumber when gameId is dropped
    if (gameIdIsValid && params.gameId) {
      canonical.set("gameId", params.gameId);
      if (params.player)
        canonical.set("player", canonicalMultiValue(params.player));
      if (params.team) canonical.set("team", canonicalMultiValue(params.team));
      if (params.actionNumber)
        canonical.set("actionNumber", params.actionNumber);
    }
    if (params.group) canonical.set("group", params.group);
    redirect(`/?${cleanSearchString(canonical)}`);
  }

  const limitParam = Number(params.limit ?? "12");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 12;

  const selectedGameId = params.gameId || games[0]?.gameId || "";
  const resultFilter = params.result || DEFAULT_RESULT;
  const playerFilter = params.player || "";
  const playType = params.playType || DEFAULT_PLAY_TYPE;
  const quarter = params.quarter || "";
  const team = params.team || "";
  const shotValue = params.shotValue || "";
  const subType = params.subType || "";
  const distanceBucket = params.distanceBucket || "";
  const group = params.group || "";

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
    <PageShell
      initialMode="game"
      season={selectedSeason}
      selectedDate={selectedDate}
      games={games}
      selectedGameId={selectedGameId}
      gamesApiError={gamesApiError}
      gameDate={selectedDate}
    >
      <Suspense fallback={<ClipsFallback />}>
        <ClipsSection
          gameId={selectedGameId}
          gamesApiError={gamesApiError}
          gamesApiErrorMessage={gamesApiErrorMessage}
          limit={limit}
          player={playerFilter}
          result={resultFilter}
          playType={playType}
          quarter={quarter}
          team={team}
          teams={teams}
          shotValue={shotValue}
          subType={subType}
          distanceBucket={distanceBucket}
          actionNumber={actionNumber}
          homeTeamTricode={selectedGame?.homeTeam?.teamTricode}
          matchup={selectedGame?.matchup ?? ""}
          group={group}
        />
      </Suspense>
    </PageShell>
  );
}
