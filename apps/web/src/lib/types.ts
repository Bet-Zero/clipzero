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
};

export type ClipsResponse = {
  clips: Clip[];
  total: number;
  players: Player[];
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number | null;
};
