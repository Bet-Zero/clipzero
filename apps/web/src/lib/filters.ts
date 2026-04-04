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
};

export function buildClipSearchParams(params: ClipQueryParams): URLSearchParams {
  const search = new URLSearchParams();
  search.set("gameId", params.gameId);
  search.set("limit", String(params.limit));
  search.set("offset", String(params.offset));
  if (params.player) search.set("player", params.player);
  if (params.result && params.result !== DEFAULT_RESULT) search.set("result", params.result);
  if (params.playType) search.set("playType", params.playType);
  if (params.quarter) search.set("quarter", params.quarter);
  if (params.team) search.set("team", params.team);
  return search;
}
