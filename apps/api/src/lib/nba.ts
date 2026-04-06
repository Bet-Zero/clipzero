import axios from "axios";

export type RawAction = {
  actionNumber?: number;
  clock?: string;
  period?: number;
  teamId?: number;
  teamTricode?: string;
  actionType?: string;
  subType?: string;
  personId?: number;
  playerName?: string;
  description?: string;
  shotResult?: string;
  shotDistance?: number;
  x?: number;
  y?: number;
  scoreHome?: string;
  scoreAway?: string;
};

export type ClipRecord = {
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
  scoreHome?: string;
  scoreAway?: string;
};

export type ScoreboardGame = {
  gameId: string;
  gameCode: string;
  gameStatusText: string;
  homeTeam: {
    teamName: string;
    teamTricode: string;
  };
  awayTeam: {
    teamName: string;
    teamTricode: string;
  };
};

type ScoreboardResponse = {
  scoreboard: {
    games: ScoreboardGame[];
  };
};

type PlayByPlayResponse = {
  game: {
    gameId: string;
    actions: RawAction[];
  };
};

type BoxScorePlayer = {
  personId?: number;
  firstName?: string;
  familyName?: string;
  name?: string;
};

type BoxScoreResponse = {
  game?: {
    homeTeam?: {
      players?: BoxScorePlayer[];
    };
    awayTeam?: {
      players?: BoxScorePlayer[];
    };
  };
};

const NBA_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
};

export async function getPlayByPlay(gameId: string): Promise<RawAction[]> {
  const url = `https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${gameId}.json`;

  const response = await axios.get<PlayByPlayResponse>(url, {
    headers: NBA_HEADERS,
    timeout: 20000,
  });

  return response.data.game.actions;
}

export function getFilteredActions(
  gameId: string,
  actions: RawAction[],
  playType: string,
) {
  const normalized = playType.toLowerCase();

  function parseAssistName(description?: string) {
    if (!description) return null;
    const match = description.match(/\(([^()]+?)\s+\d+\s+AST\)/i);
    return match?.[1]?.trim() ?? null;
  }

  return actions
    .filter((action) => {
      const actionType = action.actionType?.toLowerCase() ?? "";
      const description = action.description ?? "";
      const isShot = actionType === "2pt" || actionType === "3pt";

      if (normalized === "all") {
        return (
          isShot ||
          actionType === "turnover" ||
          actionType === "steal" ||
          actionType === "block" ||
          actionType === "foul"
        );
      }

      if (normalized === "shots") {
        return isShot;
      }

      if (normalized === "assists") {
        return isShot && /\bAST\b/i.test(description);
      }

      if (normalized === "rebounds") {
        return actionType === "rebound";
      }

      if (normalized === "turnovers") {
        return actionType === "turnover";
      }

      if (normalized === "steals") {
        return actionType === "steal";
      }

      if (normalized === "blocks") {
        return actionType === "block";
      }

      if (normalized === "fouls") {
        return actionType === "foul";
      }

      return false;
    })
    .map((action) => {
      const description = action.description;

      let playerName = action.playerName;

      if (normalized === "assists") {
        playerName = parseAssistName(description) ?? action.playerName;
      }

      return {
        gameId,
        actionNumber: action.actionNumber,
        period: action.period,
        clock: action.clock,
        teamId: action.teamId,
        teamTricode: action.teamTricode,
        personId: action.personId,
        playerName,
        actionType: action.actionType,
        subType: action.subType,
        shotResult: action.shotResult,
        shotDistance: action.shotDistance,
        x: action.x,
        y: action.y,
        description: action.description,
        scoreHome: action.scoreHome,
        scoreAway: action.scoreAway,
      };
    });
}

function getShotActions(gameId: string, actions: RawAction[]) {
  return actions
    .filter(
      (action) => action.actionType === "2pt" || action.actionType === "3pt",
    )
    .map((action) => ({
      gameId,
      actionNumber: action.actionNumber,
      period: action.period,
      clock: action.clock,
      teamId: action.teamId,
      teamTricode: action.teamTricode,
      personId: action.personId,
      playerName: action.playerName,
      actionType: action.actionType,
      subType: action.subType,
      shotResult: action.shotResult,
      shotDistance: action.shotDistance,
      x: action.x,
      y: action.y,
      description: action.description,
      scoreHome: action.scoreHome,
      scoreAway: action.scoreAway,
    }));
}

export async function getPlayerNameMapForGame(gameId: string) {
  const url = `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${gameId}.json`;

  const response = await axios.get<BoxScoreResponse>(url, {
    headers: NBA_HEADERS,
    timeout: 20000,
  });

  const homePlayers = response.data?.game?.homeTeam?.players ?? [];
  const awayPlayers = response.data?.game?.awayTeam?.players ?? [];
  const allPlayers = [...homePlayers, ...awayPlayers];

  const playerMap = new Map<number, string>();

  for (const player of allPlayers) {
    const id = player.personId;
    if (!id) continue;

    const fullName =
      `${player.firstName ?? ""} ${player.familyName ?? ""}`.trim() ||
      player.name?.trim() ||
      "";

    if (fullName) {
      playerMap.set(id, fullName);
    }
  }

  return playerMap;
}

export async function getVideoEventAsset(gameId: string, gameEventId: number) {
  const url = "https://stats.nba.com/stats/videoeventsasset";

  const response = await axios.get(url, {
    headers: NBA_HEADERS,
    params: {
      GameID: gameId,
      GameEventID: gameEventId,
    },
    timeout: 20000,
  });

  return response.data;
}

export async function getClipRecordsForGame(
  gameId: string,
): Promise<ClipRecord[]> {
  const actions = await getPlayByPlay(gameId);
  const shotActions = getShotActions(gameId, actions).slice(0, 10);

  const clipRecords: ClipRecord[] = [];

  for (const shot of shotActions) {
    if (!shot.actionNumber) {
      clipRecords.push({
        ...shot,
        videoUrl: null,
        thumbnailUrl: null,
      } as ClipRecord);
      continue;
    }

    try {
      const asset = await getVideoEventAsset(gameId, shot.actionNumber);
      const videoUrls = asset?.resultSets?.Meta?.videoUrls ?? [];
      const firstVideo = videoUrls[0];

      clipRecords.push({
        ...shot,
        videoUrl: firstVideo?.murl ?? null,
        thumbnailUrl: firstVideo?.mth ?? null,
      } as ClipRecord);
    } catch {
      clipRecords.push({
        ...shot,
        videoUrl: null,
        thumbnailUrl: null,
      } as ClipRecord);
    }
  }

  return clipRecords;
}

function formatDateForNba(date: string) {
  const [year, month, day] = date.split("-");
  return `${month}/${day}/${year}`;
}

export async function getGamesByDate(date: string): Promise<ScoreboardGame[]> {
  const url = "https://stats.nba.com/stats/scoreboardv3";

  const response = await axios.get(url, {
    headers: NBA_HEADERS,
    params: {
      GameDate: formatDateForNba(date),
      LeagueID: "00",
    },
    timeout: 20000,
  });

  const games = response.data?.scoreboard?.games ?? [];

  return games.map((game: any) => ({
    gameId: game.gameId,
    gameCode: game.gameCode,
    gameStatusText: game.gameStatusText,
    homeTeam: {
      teamName: game.homeTeam?.teamName ?? "",
      teamTricode: game.homeTeam?.teamTricode ?? "",
    },
    awayTeam: {
      teamName: game.awayTeam?.teamName ?? "",
      teamTricode: game.awayTeam?.teamTricode ?? "",
    },
  }));
}

export async function getTodaysGames(): Promise<ScoreboardGame[]> {
  const url =
    "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json";

  const response = await axios.get<ScoreboardResponse>(url, {
    headers: NBA_HEADERS,
  });

  return response.data.scoreboard.games;
}

// --- Player-mode data sources ---

export type PlayerDirectoryEntry = {
  personId: number;
  displayName: string;
  teamId: number;
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

/**
 * Fetch the full player directory for a season from stats.nba.com.
 * Returns active players with personId, name, and team info.
 */
export async function getAllPlayers(
  season: string,
): Promise<PlayerDirectoryEntry[]> {
  const url = "https://stats.nba.com/stats/commonallplayers";

  const response = await axios.get(url, {
    headers: NBA_HEADERS,
    params: {
      LeagueID: "00",
      Season: season,
      IsOnlyCurrentSeason: 1,
    },
    timeout: 30000,
  });

  const resultSet = response.data?.resultSets?.[0];
  if (!resultSet) return [];

  const headers: string[] = resultSet.headers ?? [];
  const rows: unknown[][] = resultSet.rowSet ?? [];

  const idx = (name: string) => headers.indexOf(name);
  const iPersonId = idx("PERSON_ID");
  const iDisplayName = idx("DISPLAY_FIRST_LAST");
  const iTeamId = idx("TEAM_ID");
  const iTeamAbbr = idx("TEAM_ABBREVIATION");

  if (iPersonId === -1 || iDisplayName === -1) return [];

  return rows
    .filter((row) => {
      const teamId = row[iTeamId];
      return typeof teamId === "number" && teamId > 0;
    })
    .map((row) => ({
      personId: row[iPersonId] as number,
      displayName: row[iDisplayName] as string,
      teamId: (row[iTeamId] as number) ?? 0,
      teamTricode: (row[iTeamAbbr] as string) ?? "",
    }));
}

/**
 * Fetch a player's game log for a season from stats.nba.com.
 * Returns games played with date, matchup, and basic stats.
 */
export async function getPlayerGameLog(
  playerId: number,
  season: string,
): Promise<PlayerGameLogEntry[]> {
  const url = "https://stats.nba.com/stats/playergamelog";

  const response = await axios.get(url, {
    headers: NBA_HEADERS,
    params: {
      PlayerID: playerId,
      Season: season,
      SeasonType: "Regular Season",
    },
    timeout: 30000,
  });

  const resultSet = response.data?.resultSets?.[0];
  if (!resultSet) return [];

  const headers: string[] = resultSet.headers ?? [];
  const rows: unknown[][] = resultSet.rowSet ?? [];

  const idx = (name: string) => headers.indexOf(name);
  const iGameId = idx("Game_ID");
  const iGameDate = idx("GAME_DATE");
  const iMatchup = idx("MATCHUP");
  const iWL = idx("WL");
  const iMin = idx("MIN");
  const iPts = idx("PTS");
  const iReb = idx("REB");
  const iAst = idx("AST");

  if (iGameId === -1 || iGameDate === -1) return [];

  return rows.map((row) => ({
    gameId: row[iGameId] as string,
    gameDate: row[iGameDate] as string,
    matchup: (row[iMatchup] as string) ?? "",
    wl: (row[iWL] as string) ?? "",
    min: (row[iMin] as number) ?? 0,
    pts: (row[iPts] as number) ?? 0,
    reb: (row[iReb] as number) ?? 0,
    ast: (row[iAst] as number) ?? 0,
  }));
}
