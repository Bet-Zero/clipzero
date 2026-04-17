export type Clip = {
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
  gameDate?: string;
  matchup?: string;
  scoreHome?: string;
  scoreAway?: string;
};

export type Game = {
  gameId: string;
  matchup: string;
  homeTeam?: {
    teamTricode: string;
  };
  awayTeam?: {
    teamTricode: string;
  };
};

export type TeamSummary = {
  teamId: number;
  tricode: string;
  fullName: string;
};

export type MatchupGame = {
  gameId: string;
  gameDate: string;
  matchup: string;
  wl?: string;
  homeTeam: TeamSummary;
  awayTeam: TeamSummary;
  homeScore?: number | null;
  awayScore?: number | null;
};

export type Player = {
  name: string;
  teamTricode?: string;
};

export type ClipsResponse = {
  clips: Clip[];
  total: number;
  players: Player[];
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number | null;
  videoCdnAvailable?: boolean;
  targetIndex?: number | null;
};

// Player-mode types

export type PlayerSearchResult = {
  personId: number;
  displayName: string;
  teamTricode: string;
  position: string;
};

export type PlayerGameLogEntry = {
  gameId: string;
  gameDate: string;
  matchup: string;
  wl: string;
  min: number;
  pts: number;
  reb: number;
  ast: number;
};

export type PlayerClipsResponse = {
  personId: number;
  season: string;
  playType: string;
  result: string;
  quarter: string | number;
  count: number;
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number | null;
  gamesIncluded: number;
  gamesExcluded: number;
  exclusions: { gameId: string; gameDate: string; reason: string }[];
  videoCdnAvailable?: boolean;
  clips: Clip[];
  targetIndex?: number | null;
};

export type MatchupClipsResponse = {
  season: string;
  teamA: TeamSummary;
  teamB: TeamSummary;
  count: number;
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number | null;
  gamesIncluded: number;
  gamesExcluded: number;
  games: MatchupGame[];
  videoCdnAvailable?: boolean;
  clips: Clip[];
  targetIndex?: number | null;
};

export type PlayerModeFilterState = {
  player: PlayerSearchResult | null;
  playType: string;
  result: string;
  quarter: string;
  shotValue: string;
  subType: string;
  distanceBucket: string;
  opponent: string;
  excludedGameIds: Set<string>;
  excludedDates: Set<string>;
  actionNumber: number | null;
};

export type MatchupModeFilterState = {
  teamA: string;
  teamB: string;
  team: string;
  playType: string;
  result: string;
  quarter: string;
  shotValue: string;
  subType: string;
  distanceBucket: string;
  excludedGameIds: Set<string>;
  actionNumber: number | null;
};

// ── Player grouping types ──

export type PlayerGroupType = "trait" | "custom";

/** A saved player group — either trait-based (resolved dynamically) or custom (explicit player list). */
export type PlayerGroup = {
  id: string; // e.g. "position:C", "custom:my-bigs"
  name: string; // display label e.g. "Centers", "My Bigs"
  type: PlayerGroupType;
  /** For trait groups: the trait field (e.g. "position") */
  traitField?: string;
  /** For trait groups: the trait value (e.g. "C") */
  traitValue?: string;
  /** For custom groups: explicitly selected player IDs */
  playerIds?: number[];
  /** For custom groups: display names for offline rendering */
  playerNames?: string[];
};
