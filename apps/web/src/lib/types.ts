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
  targetIndex?: number | null;
};

// Player-mode types

export type PlayerSearchResult = {
  personId: number;
  displayName: string;
  teamTricode: string;
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
  excludedGameIds: Set<string>;
  excludedDates: Set<string>;
  actionNumber: number | null;
};
