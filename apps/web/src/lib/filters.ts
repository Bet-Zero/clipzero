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
