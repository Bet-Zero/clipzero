import axios from "axios";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getWithRetries<T>(
  url: string,
  opts: any = {},
  maxAttempts = 3,
  retryOnTimeout = true,
): Promise<import("axios").AxiosResponse<T>> {
  let attempt = 0;
  let delay = 300;
  while (true) {
    attempt += 1;
    try {
      return await axios.get<T>(url, opts);
    } catch (err: any) {
      const isAxios = axios.isAxiosError(err);
      const status = isAxios ? err.response?.status : undefined;
      const isTimeout = isAxios && err.code === "ECONNABORTED";

      // Do not retry on 403 (forbidden) — treat as a hard failure.
      const shouldRetry = isAxios
        ? (isTimeout && retryOnTimeout) ||
          status === 429 ||
          (status && status >= 500)
        : true;

      if (!shouldRetry || attempt >= maxAttempts) throw err;

      await sleep(delay);
      delay *= 2;
    }
  }
}

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
  area?: string;
  areaDetail?: string;
  descriptor?: string;
  qualifiers?: string[];
  foulDrawnPersonId?: number;
  foulDrawnPlayerName?: string;
};

export type ClipRecord = {
  gameId: string;
  actionNumber?: number;
  videoActionNumber?: number;
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
  area?: string;
  areaDetail?: string;
  descriptor?: string;
  qualifiers?: string[];
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

export type TeamDirectoryEntry = {
  teamId: number;
  tricode: string;
  city: string;
  name: string;
  fullName: string;
};

export const NBA_TEAMS: TeamDirectoryEntry[] = [
  {
    teamId: 1610612737,
    tricode: "ATL",
    city: "Atlanta",
    name: "Hawks",
    fullName: "Atlanta Hawks",
  },
  {
    teamId: 1610612738,
    tricode: "BOS",
    city: "Boston",
    name: "Celtics",
    fullName: "Boston Celtics",
  },
  {
    teamId: 1610612751,
    tricode: "BKN",
    city: "Brooklyn",
    name: "Nets",
    fullName: "Brooklyn Nets",
  },
  {
    teamId: 1610612766,
    tricode: "CHA",
    city: "Charlotte",
    name: "Hornets",
    fullName: "Charlotte Hornets",
  },
  {
    teamId: 1610612741,
    tricode: "CHI",
    city: "Chicago",
    name: "Bulls",
    fullName: "Chicago Bulls",
  },
  {
    teamId: 1610612739,
    tricode: "CLE",
    city: "Cleveland",
    name: "Cavaliers",
    fullName: "Cleveland Cavaliers",
  },
  {
    teamId: 1610612742,
    tricode: "DAL",
    city: "Dallas",
    name: "Mavericks",
    fullName: "Dallas Mavericks",
  },
  {
    teamId: 1610612743,
    tricode: "DEN",
    city: "Denver",
    name: "Nuggets",
    fullName: "Denver Nuggets",
  },
  {
    teamId: 1610612765,
    tricode: "DET",
    city: "Detroit",
    name: "Pistons",
    fullName: "Detroit Pistons",
  },
  {
    teamId: 1610612744,
    tricode: "GSW",
    city: "Golden State",
    name: "Warriors",
    fullName: "Golden State Warriors",
  },
  {
    teamId: 1610612745,
    tricode: "HOU",
    city: "Houston",
    name: "Rockets",
    fullName: "Houston Rockets",
  },
  {
    teamId: 1610612754,
    tricode: "IND",
    city: "Indiana",
    name: "Pacers",
    fullName: "Indiana Pacers",
  },
  {
    teamId: 1610612746,
    tricode: "LAC",
    city: "LA",
    name: "Clippers",
    fullName: "LA Clippers",
  },
  {
    teamId: 1610612747,
    tricode: "LAL",
    city: "Los Angeles",
    name: "Lakers",
    fullName: "Los Angeles Lakers",
  },
  {
    teamId: 1610612763,
    tricode: "MEM",
    city: "Memphis",
    name: "Grizzlies",
    fullName: "Memphis Grizzlies",
  },
  {
    teamId: 1610612748,
    tricode: "MIA",
    city: "Miami",
    name: "Heat",
    fullName: "Miami Heat",
  },
  {
    teamId: 1610612749,
    tricode: "MIL",
    city: "Milwaukee",
    name: "Bucks",
    fullName: "Milwaukee Bucks",
  },
  {
    teamId: 1610612750,
    tricode: "MIN",
    city: "Minnesota",
    name: "Timberwolves",
    fullName: "Minnesota Timberwolves",
  },
  {
    teamId: 1610612740,
    tricode: "NOP",
    city: "New Orleans",
    name: "Pelicans",
    fullName: "New Orleans Pelicans",
  },
  {
    teamId: 1610612752,
    tricode: "NYK",
    city: "New York",
    name: "Knicks",
    fullName: "New York Knicks",
  },
  {
    teamId: 1610612760,
    tricode: "OKC",
    city: "Oklahoma City",
    name: "Thunder",
    fullName: "Oklahoma City Thunder",
  },
  {
    teamId: 1610612753,
    tricode: "ORL",
    city: "Orlando",
    name: "Magic",
    fullName: "Orlando Magic",
  },
  {
    teamId: 1610612755,
    tricode: "PHI",
    city: "Philadelphia",
    name: "76ers",
    fullName: "Philadelphia 76ers",
  },
  {
    teamId: 1610612756,
    tricode: "PHX",
    city: "Phoenix",
    name: "Suns",
    fullName: "Phoenix Suns",
  },
  {
    teamId: 1610612757,
    tricode: "POR",
    city: "Portland",
    name: "Trail Blazers",
    fullName: "Portland Trail Blazers",
  },
  {
    teamId: 1610612758,
    tricode: "SAC",
    city: "Sacramento",
    name: "Kings",
    fullName: "Sacramento Kings",
  },
  {
    teamId: 1610612759,
    tricode: "SAS",
    city: "San Antonio",
    name: "Spurs",
    fullName: "San Antonio Spurs",
  },
  {
    teamId: 1610612761,
    tricode: "TOR",
    city: "Toronto",
    name: "Raptors",
    fullName: "Toronto Raptors",
  },
  {
    teamId: 1610612762,
    tricode: "UTA",
    city: "Utah",
    name: "Jazz",
    fullName: "Utah Jazz",
  },
  {
    teamId: 1610612764,
    tricode: "WAS",
    city: "Washington",
    name: "Wizards",
    fullName: "Washington Wizards",
  },
];

export function getTeamByTricode(
  tricode: string,
): TeamDirectoryEntry | undefined {
  const normalized = tricode.trim().toUpperCase();
  return NBA_TEAMS.find((team) => team.tricode === normalized);
}

type ScoreboardResponse = {
  scoreboard?: {
    games?: ScoreboardGame[];
  };
};

type PlayByPlayResponse = {
  game?: {
    gameId?: string;
    actions?: RawAction[];
  };
};

type CdnJsonFetchOptions = {
  timeout?: number;
  label?: string;
};

type CdnJsonAttemptResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string; error?: unknown };

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

// Headers to use when calling stats.nba.com endpoints (these tend to
// expect browser-like headers and x-nba-stats tokens).
const STATS_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

// Minimal headers remain the first attempt for CDN / static JSON endpoints.
// Some liveData objects now require a browser-like retry, but videos.nba.com
// probe traffic still needs to stay minimal to avoid misleading placeholder
// behavior.
const CDN_HEADERS = {
  Accept: "application/json, text/plain, */*",
};

const CDN_BROWSER_LIKE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

function getHeaderValue(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== "object") return undefined;

  if ("get" in headers && typeof headers.get === "function") {
    const value = headers.get(name);
    return typeof value === "string" ? value : undefined;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== name.toLowerCase()) continue;
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "string") return value;
  }

  return undefined;
}

function getBodyText(data: unknown): string {
  if (typeof data === "string") return data;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
    return data.toString("utf8");
  }
  return "";
}

function getCdnAccessDeniedReasonFromResponse(
  response?: import("axios").AxiosResponse<unknown>,
): string | null {
  if (!response) return null;

  if (response.status === 403) {
    return "status 403";
  }

  const contentType =
    getHeaderValue(response.headers, "content-type")?.toLowerCase() ?? "";

  if (contentType.includes("text/html")) {
    return `content-type ${contentType}`;
  }

  if (contentType.includes("xml")) {
    return `content-type ${contentType}`;
  }

  const body = getBodyText(response.data).toLowerCase();

  if (body.includes("<code>accessdenied</code>")) {
    return "body contains <Code>AccessDenied</Code>";
  }

  if (body.includes("access denied")) {
    return "body contains Access Denied";
  }

  return null;
}

function getCdnAccessDeniedReason(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null;
  return getCdnAccessDeniedReasonFromResponse(error.response);
}

function parseCdnJsonData<T>(data: unknown, label: string): T {
  if (typeof data === "string") {
    const trimmed = data.trim();

    if (!trimmed) {
      throw new Error(`Invalid ${label} response`);
    }

    try {
      return JSON.parse(trimmed) as T;
    } catch {
      throw new Error(`Invalid ${label} response`);
    }
  }

  if (typeof data === "object" && data !== null) {
    return data as T;
  }

  throw new Error(`Invalid ${label} response`);
}

function annotateError(error: unknown, message: string): Error {
  if (error instanceof Error) {
    error.message = message;
    return error;
  }

  return new Error(message);
}

async function fetchCdnJsonAttempt<T>(
  url: string,
  headers: Record<string, string>,
  timeout: number,
  label: string,
): Promise<CdnJsonAttemptResult<T>> {
  try {
    const response = await axios.get<T | string>(url, {
      headers,
      timeout,
    });

    const deniedReason = getCdnAccessDeniedReasonFromResponse(response);
    if (deniedReason) {
      return { ok: false, reason: deniedReason };
    }

    return {
      ok: true,
      data: parseCdnJsonData<T>(response.data, label),
    };
  } catch (error) {
    const deniedReason = getCdnAccessDeniedReason(error);
    if (deniedReason) {
      return { ok: false, reason: deniedReason, error };
    }

    throw error;
  }
}

async function getCdnJsonWithBrowserRetry<T>(
  url: string,
  opts: CdnJsonFetchOptions = {},
): Promise<T> {
  const timeout = opts.timeout ?? 20000;
  const label = opts.label ?? "NBA CDN JSON";

  const firstAttempt = await fetchCdnJsonAttempt<T>(
    url,
    CDN_HEADERS,
    timeout,
    label,
  );

  if (firstAttempt.ok) {
    return firstAttempt.data;
  }

  let retryAttempt: CdnJsonAttemptResult<T>;
  try {
    retryAttempt = await fetchCdnJsonAttempt<T>(
      url,
      CDN_BROWSER_LIKE_HEADERS,
      timeout,
      label,
    );
  } catch (error) {
    throw annotateError(
      error,
      `${label} request failed after browser-like CDN retry (initial response denied: ${firstAttempt.reason})`,
    );
  }

  if (retryAttempt.ok) {
    return retryAttempt.data;
  }

  throw annotateError(
    retryAttempt.error,
    `${label} request failed after browser-like CDN retry (initial response denied: ${firstAttempt.reason}; retry response denied: ${retryAttempt.reason})`,
  );
}

export async function getPlayByPlay(gameId: string): Promise<RawAction[]> {
  const url = `https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${gameId}.json`;

  const data = await getCdnJsonWithBrowserRetry<PlayByPlayResponse>(url, {
    timeout: 20000,
    label: "NBA play-by-play",
  });

  const actions = data.game?.actions;
  if (!Array.isArray(actions)) {
    throw new Error("Invalid NBA play-by-play response");
  }

  return actions;
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

  function makeRecord(
    action: RawAction,
    overrides?: { playerName?: string; personId?: number },
  ) {
    return {
      gameId,
      actionNumber: action.actionNumber,
      period: action.period,
      clock: action.clock,
      teamId: action.teamId,
      teamTricode: action.teamTricode,
      personId: overrides?.personId ?? action.personId,
      playerName: overrides?.playerName ?? action.playerName,
      actionType: action.actionType,
      subType: action.subType,
      shotResult: action.shotResult,
      shotDistance: action.shotDistance,
      x: action.x,
      y: action.y,
      description: action.description,
      scoreHome: action.scoreHome,
      scoreAway: action.scoreAway,
      area: action.area,
      areaDetail: action.areaDetail,
      descriptor: action.descriptor,
      qualifiers: action.qualifiers,
    };
  }

  return actions.flatMap((action, index) => {
    const actionType = action.actionType?.toLowerCase() ?? "";
    const description = action.description ?? "";
    const isShot = actionType === "2pt" || actionType === "3pt";
    const isStealOrBlock = actionType === "steal" || actionType === "block";
    const videoActionNumber = isStealOrBlock
      ? actions[index - 1]?.actionNumber
      : undefined;

    if (normalized === "all") {
      if (
        isShot ||
        actionType === "turnover" ||
        actionType === "steal" ||
        actionType === "block" ||
        actionType === "foul"
      )
        return [{ ...makeRecord(action), videoActionNumber }];
      return [];
    }

    if (normalized === "all-offense") {
      if (isShot || actionType === "turnover") return [makeRecord(action)];
      return [];
    }

    if (normalized === "all-defense") {
      if (actionType === "steal" || actionType === "block")
        return [{ ...makeRecord(action), videoActionNumber }];
      return [];
    }

    if (normalized === "good-plays") {
      if (actionType === "steal" || actionType === "block") {
        return [{ ...makeRecord(action), videoActionNumber }];
      }
      if (isShot && action.shotResult === "Made") {
        const records: ReturnType<typeof makeRecord>[] = [makeRecord(action)];
        const assisterName = parseAssistName(description);
        if (assisterName) {
          records.push(
            makeRecord(action, {
              playerName: assisterName,
              personId: undefined as unknown as number,
            }),
          );
        }
        return records;
      }
      return [];
    }

    if (normalized === "bad-plays") {
      if (
        (isShot && action.shotResult === "Missed") ||
        actionType === "turnover" ||
        actionType === "foul"
      )
        return [makeRecord(action)];
      return [];
    }

    if (normalized === "shots") {
      if (isShot) return [makeRecord(action)];
      return [];
    }

    if (normalized === "assists") {
      if (isShot && /\bAST\b/i.test(description)) {
        return [
          makeRecord(action, {
            playerName: parseAssistName(description) ?? action.playerName,
          }),
        ];
      }
      return [];
    }

    if (normalized === "rebounds") {
      if (actionType === "rebound") return [makeRecord(action)];
      return [];
    }

    if (normalized === "turnovers") {
      if (actionType === "turnover") return [makeRecord(action)];
      return [];
    }

    if (normalized === "steals") {
      if (actionType === "steal")
        return [{ ...makeRecord(action), videoActionNumber }];
      return [];
    }

    if (normalized === "blocks") {
      if (actionType === "block")
        return [{ ...makeRecord(action), videoActionNumber }];
      return [];
    }

    if (normalized === "fouls") {
      if (actionType === "foul") return [makeRecord(action)];
      return [];
    }

    if (normalized === "fouls-drawn") {
      if (actionType === "foul" && action.foulDrawnPersonId) {
        return [
          makeRecord(action, {
            personId: action.foulDrawnPersonId,
            playerName: action.foulDrawnPlayerName,
          }),
        ];
      }
      return [];
    }

    return [];
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
      area: action.area,
      areaDetail: action.areaDetail,
      descriptor: action.descriptor,
      qualifiers: action.qualifiers,
    }));
}

export async function getPlayerNameMapForGame(gameId: string) {
  const url = `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${gameId}.json`;

  const data = await getCdnJsonWithBrowserRetry<BoxScoreResponse>(url, {
    timeout: 60000,
    label: "NBA boxscore",
  });

  const homePlayers = data?.game?.homeTeam?.players ?? [];
  const awayPlayers = data?.game?.awayTeam?.players ?? [];
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

  // Short timeout, no retry on timeout: a stalled video-asset fetch must fail
  // fast so it doesn't block the whole clip batch (3 × 60 s = 3-minute hang).
  const response = await getWithRetries<any>(
    url,
    {
      headers: STATS_HEADERS,
      params: {
        GameID: gameId,
        GameEventID: gameEventId,
      },
      timeout: 12000,
    },
    2,
    false,
  );

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
      const selectedVideo =
        videoUrls.find(
          (video: { murl?: string }) =>
            typeof video?.murl === "string" &&
            video.murl.includes("_1280x720.mp4"),
        ) ??
        videoUrls.find(
          (video: { murl?: string }) => typeof video?.murl === "string",
        );

      clipRecords.push({
        ...shot,
        videoUrl: selectedVideo?.murl ?? null,
        thumbnailUrl: selectedVideo?.mth ?? null,
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

export async function getGamesByDate(date: string): Promise<ScoreboardGame[]> {
  const url = "https://stats.nba.com/stats/scoreboardv3";

  const response = await getWithRetries<any>(url, {
    headers: STATS_HEADERS,
    params: {
      GameDate: date,
      LeagueID: "00",
    },
    timeout: 60000,
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

  const data = await getCdnJsonWithBrowserRetry<ScoreboardResponse>(url, {
    timeout: 10000,
    label: "NBA scoreboard",
  });

  const games = data.scoreboard?.games;
  if (!Array.isArray(games)) {
    throw new Error("Invalid NBA scoreboard response");
  }

  return games;
}

// --- Player-mode data sources ---

export type PlayerDirectoryEntry = {
  personId: number;
  displayName: string;
  teamId: number;
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

export type TeamGameLogEntry = {
  gameId: string;
  gameDate: string;
  matchup: string;
  wl: string;
  pts: number | null;
  plusMinus: number | null;
};

/**
 * Fetch the full player directory for a season from stats.nba.com.
 * Returns active players with personId, name, and team info.
 */
export async function getAllPlayers(
  season: string,
): Promise<PlayerDirectoryEntry[]> {
  const url = "https://stats.nba.com/stats/commonallplayers";

  const response = await getWithRetries<any>(url, {
    headers: STATS_HEADERS,
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
  const iPosition = idx("POSITION");

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
      position: iPosition !== -1 ? ((row[iPosition] as string) ?? "") : "",
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

  const response = await getWithRetries<any>(url, {
    headers: STATS_HEADERS,
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

/**
 * Fetch a team's game log for a season from stats.nba.com.
 * Used by Matchup mode to discover head-to-head games.
 */
export async function getTeamGameLog(
  teamId: number,
  season: string,
): Promise<TeamGameLogEntry[]> {
  const url = "https://stats.nba.com/stats/teamgamelog";

  const response = await getWithRetries<any>(url, {
    headers: STATS_HEADERS,
    params: {
      TeamID: teamId,
      Season: season,
      SeasonType: "Regular Season",
      LeagueID: "00",
    },
    timeout: 30000,
  });

  const resultSet = response.data?.resultSets?.[0] ?? response.data?.resultSet;
  if (!resultSet) return [];

  const headers: string[] = resultSet.headers ?? [];
  const rows: unknown[][] = resultSet.rowSet ?? [];

  const idx = (...names: string[]) => {
    for (const name of names) {
      const index = headers.indexOf(name);
      if (index !== -1) return index;
    }
    return -1;
  };

  const iGameId = idx("Game_ID", "GAME_ID");
  const iGameDate = idx("GAME_DATE", "Game_Date");
  const iMatchup = idx("MATCHUP", "Matchup");
  const iWL = idx("WL", "W/L");
  const iPts = idx("PTS");
  const iPlusMinus = idx("PLUS_MINUS");

  if (iGameId === -1 || iGameDate === -1 || iMatchup === -1) return [];

  return rows.map((row) => {
    const pts = iPts !== -1 ? (row[iPts] as number | null) : null;
    const plusMinus =
      iPlusMinus !== -1 ? (row[iPlusMinus] as number | null) : null;
    return {
      gameId: row[iGameId] as string,
      gameDate: (row[iGameDate] as string) ?? "",
      matchup: (row[iMatchup] as string) ?? "",
      wl: iWL !== -1 ? ((row[iWL] as string) ?? "") : "",
      pts: typeof pts === "number" ? pts : null,
      plusMinus: typeof plusMinus === "number" ? plusMinus : null,
    };
  });
}
