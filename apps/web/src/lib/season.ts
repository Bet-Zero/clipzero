export const SEASONS = ["2023-24", "2024-25", "2025-26"] as const;
export type Season = (typeof SEASONS)[number];

export const DEFAULT_SEASON: Season = SEASONS[SEASONS.length - 1];

/**
 * Parse a season label like "2024-25" into its calendar start/end dates.
 * Start = Oct 1 of the first year, End = Jun 30 of the second year.
 */
export function seasonBounds(season: Season): { start: string; end: string } {
  const startYear = parseInt(season.slice(0, 4), 10);
  return {
    start: `${startYear}-10-01`,
    end: `${startYear + 1}-06-30`,
  };
}

function normalizeIsoDate(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const [year, month, day] = date.split("-").map(Number);
  const normalized = new Date(Date.UTC(year!, month! - 1, day!));
  if (
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() !== month! - 1 ||
    normalized.getUTCDate() !== day
  ) {
    return null;
  }

  return normalized.toISOString().slice(0, 10);
}

/** Returns true if the YYYY-MM-DD date falls within the season window. */
export function dateInSeason(date: string, season: Season): boolean {
  const normalizedDate = normalizeIsoDate(date);
  if (!normalizedDate) {
    return false;
  }

  const { start, end } = seasonBounds(season);
  return normalizedDate >= start && normalizedDate <= end;
}

/**
 * Return the best-fit season for a given date.
 * Dates in the off-season window (Jul–Sep) fall back to DEFAULT_SEASON.
 */
export function seasonForDate(date: string): Season {
  for (const season of [...SEASONS].reverse()) {
    if (dateInSeason(date, season)) return season;
  }
  return DEFAULT_SEASON;
}

/** Mid-January of the second calendar year — a reliable in-season default. */
export function defaultDateForSeason(season: Season): string {
  const startYear = parseInt(season.slice(0, 4), 10);
  return `${startYear + 1}-01-15`;
}

/** Validate and coerce an arbitrary string to a known Season. */
export function parseSeason(value: string | undefined): Season {
  if (value && (SEASONS as readonly string[]).includes(value)) {
    return value as Season;
  }
  return DEFAULT_SEASON;
}
