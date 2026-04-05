import type { PlayerSearchResult, PlayerModeFilterState } from "./types";

export const DEFAULT_PLAY_TYPE = "shots";
export const DEFAULT_RESULT = "all";

// ── Multi-select helpers ────────────────────────────────────────────
// Multi-select params use comma-separated values in URLs: team=LAL,GSW

/** Split a comma-separated URL value into individual values. */
export function splitMultiValue(val: string): string[] {
  return val
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Check if a value is present in a comma-separated string. */
export function hasMultiValue(current: string, value: string): boolean {
  return splitMultiValue(current).includes(value);
}

/** Sort multi-select values for canonical URL ordering. */
function sortedJoin(values: string[]): string {
  return values.slice().sort().join(",");
}

/** Toggle a value in a comma-separated string. Returns the updated (sorted) string. */
export function toggleMultiValue(current: string, value: string): string {
  const values = splitMultiValue(current);
  const idx = values.indexOf(value);
  if (idx >= 0) {
    values.splice(idx, 1);
  } else {
    values.push(value);
  }
  return sortedJoin(values);
}

/** Remove a specific value from a comma-separated string. */
export function removeMultiValue(current: string, value: string): string {
  return sortedJoin(splitMultiValue(current).filter((v) => v !== value));
}

/** Canonicalize a comma-separated multi-select value (sort + dedupe). */
export function canonicalMultiValue(val: string): string {
  return sortedJoin([...new Set(splitMultiValue(val))]);
}

/** Clean URL string: decode commas that URLSearchParams encodes. */
export function cleanSearchString(search: URLSearchParams): string {
  return search.toString().replace(/%2C/g, ",");
}

type ClipQueryParams = {
  gameId: string;
  limit: number;
  offset: number;
  player?: string;
  result?: string;
  playType?: string;
  quarter?: string;
  team?: string;
  shotValue?: string;
  subType?: string;
  distanceBucket?: string;
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
  if (params.shotValue) search.set("shotValue", params.shotValue);
  if (params.subType) search.set("subType", params.subType);
  if (params.distanceBucket)
    search.set("distanceBucket", params.distanceBucket);
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
  shotValue?: string;
  subType?: string;
  distanceBucket?: string;
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
  if (params.shotValue) search.set("shotValue", params.shotValue);
  if (params.subType) search.set("subType", params.subType);
  if (params.distanceBucket)
    search.set("distanceBucket", params.distanceBucket);
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
    shotValue: params.get("shotValue") || "",
    subType: params.get("subType") || "",
    distanceBucket: params.get("distanceBucket") || "",
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
  if (state.quarter) search.set("quarter", canonicalMultiValue(state.quarter));
  if (state.shotValue) search.set("shotValue", state.shotValue);
  if (state.subType) search.set("subType", canonicalMultiValue(state.subType));
  if (state.distanceBucket)
    search.set("distanceBucket", canonicalMultiValue(state.distanceBucket));

  const gameIds = [...state.excludedGameIds].filter(Boolean).sort();
  if (gameIds.length > 0) search.set("excludeGameIds", gameIds.join(","));
  const dates = [...state.excludedDates].filter(Boolean).sort();
  if (dates.length > 0) search.set("excludeDates", dates.join(","));

  if (state.actionNumber !== null)
    search.set("actionNumber", String(state.actionNumber));

  return `/?${cleanSearchString(search)}`;
}
