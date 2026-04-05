import type { PlayerSearchResult, PlayerModeFilterState } from "./types";

export const DEFAULT_PLAY_TYPE = "shots";
export const DEFAULT_RESULT = "all";

type ClipQueryParams = {
  gameId: string;
  limit: number;
  offset: number;
  player?: string;
  result?: string;
  playType?: string;
  quarter?: string;
  team?: string;
  actionNumber?: number | null;
};

export function buildClipSearchParams(
  params: ClipQueryParams,
): URLSearchParams {
  const search = new URLSearchParams();
  search.set("gameId", params.gameId);
  search.set("limit", String(params.limit));
  search.set("offset", String(params.offset));
  if (params.player) search.set("player", params.player);
  if (params.result && params.result !== DEFAULT_RESULT)
    search.set("result", params.result);
  if (params.playType) search.set("playType", params.playType);
  if (params.quarter) search.set("quarter", params.quarter);
  if (params.team) search.set("team", params.team);
  if (params.actionNumber)
    search.set("actionNumber", String(params.actionNumber));
  return search;
}

type PlayerClipQueryParams = {
  personId: number;
  season: string;
  limit: number;
  offset: number;
  playType?: string;
  result?: string;
  quarter?: string;
  excludeDates?: string[];
  excludeGameIds?: string[];
  actionNumber?: number | null;
};

export function buildPlayerClipSearchParams(
  params: PlayerClipQueryParams,
): URLSearchParams {
  const search = new URLSearchParams();
  search.set("personId", String(params.personId));
  search.set("season", params.season);
  search.set("limit", String(params.limit));
  search.set("offset", String(params.offset));
  if (params.playType) search.set("playType", params.playType);
  if (params.result && params.result !== DEFAULT_RESULT)
    search.set("result", params.result);
  if (params.quarter) search.set("quarter", params.quarter);
  if (params.excludeDates && params.excludeDates.length > 0)
    search.set("excludeDates", params.excludeDates.join(","));
  if (params.excludeGameIds && params.excludeGameIds.length > 0)
    search.set("excludeGameIds", params.excludeGameIds.join(","));
  if (params.actionNumber)
    search.set("actionNumber", String(params.actionNumber));
  return search;
}

function parseCommaSeparatedSet(value: string | null): Set<string> {
  if (!value) return new Set();
  return new Set(value.split(",").filter(Boolean));
}

export function parsePlayerModeParams(
  params: URLSearchParams,
): PlayerModeFilterState {
  const personId = params.get("personId");
  const playerName = params.get("playerName");
  const actionNumberStr = params.get("actionNumber");

  return {
    player:
      personId && playerName
        ? {
            personId: Number(personId),
            displayName: playerName,
            teamTricode: params.get("teamTricode") || "",
          }
        : null,
    playType: params.get("playType") || DEFAULT_PLAY_TYPE,
    result: params.get("result") || DEFAULT_RESULT,
    quarter: params.get("quarter") || "",
    excludedGameIds: parseCommaSeparatedSet(params.get("excludeGameIds")),
    excludedDates: parseCommaSeparatedSet(params.get("excludeDates")),
    actionNumber: actionNumberStr ? Number(actionNumberStr) : null,
  };
}

export function buildPlayerModeUrl(
  season: string,
  state: PlayerModeFilterState,
): string {
  const search = new URLSearchParams();
  search.set("mode", "player");
  search.set("season", season);

  if (state.player) {
    search.set("personId", String(state.player.personId));
    search.set("playerName", state.player.displayName);
    if (state.player.teamTricode)
      search.set("teamTricode", state.player.teamTricode);
  }

  if (state.playType && state.playType !== DEFAULT_PLAY_TYPE)
    search.set("playType", state.playType);
  if (state.result && state.result !== DEFAULT_RESULT)
    search.set("result", state.result);
  if (state.quarter) search.set("quarter", state.quarter);

  const gameIds = [...state.excludedGameIds].filter(Boolean);
  if (gameIds.length > 0) search.set("excludeGameIds", gameIds.join(","));
  const dates = [...state.excludedDates].filter(Boolean);
  if (dates.length > 0) search.set("excludeDates", dates.join(","));

  if (state.actionNumber !== null)
    search.set("actionNumber", String(state.actionNumber));

  return `/?${search.toString()}`;
}
