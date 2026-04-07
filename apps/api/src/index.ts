import cors from "cors";
import express from "express";
import { apiConfig } from "./lib/config";
import { getCachedGames, setCachedGames } from "./lib/gamesCache";
import { logger, serializeError } from "./lib/logger";
import {
  getFilteredActions,
  getGamesByDate,
  getPlayByPlay,
  getPlayerNameMapForGame,
  getTodaysGames,
  getVideoEventAsset,
  getAllPlayers,
  getPlayerGameLog,
} from "./lib/nba";
import type {
  PlayerDirectoryEntry,
  PlayerGameLogEntry,
  RawAction,
} from "./lib/nba";
import {
  getPersistentValue,
  setPersistentValue,
} from "./lib/persistentCache";
import { createRateLimiter } from "./lib/rateLimit";
import { matchesNormalizedGroup } from "./lib/subtypeGroups";

const app = express();
const port = apiConfig.port;
const clipCache = new Map<string, unknown>();
const gamesCache = new Map<string, unknown>();
const videoAssetCache = new Map<
  string,
  { videoUrl: string | null; thumbnailUrl: string | null }
>();
const playerDirectoryCache = new Map<string, PlayerDirectoryEntry[]>();
const playerGameLogCache = new Map<string, PlayerGameLogEntry[]>();
const playerClipCache = new Map<string, unknown>();
const playByPlayCache = new Map<string, RawAction[]>();
const boxScoreCache = new Map<string, Map<number, string>>();

type PlayerActionWithGame = {
  gameId: string;
  gameDate: string;
  matchup: string;
  actionNumber?: number | undefined;
  period?: number | undefined;
  clock?: string | undefined;
  teamId?: number | undefined;
  teamTricode?: string | undefined;
  personId?: number | undefined;
  playerName?: string | undefined;
  actionType?: string | undefined;
  subType?: string | undefined;
  shotResult?: string | undefined;
  shotDistance?: number | undefined;
  x?: number | undefined;
  y?: number | undefined;
  description?: string | undefined;
  scoreHome?: string | undefined;
  scoreAway?: string | undefined;
};

const playerSeasonActionsCache = new Map<string, PlayerActionWithGame[]>();

function msSince(start: number) {
  return `${Date.now() - start}ms`;
}

function normalizeDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toISOString().slice(0, 10);
}

async function getCachedVideoAsset(
  gameId: string,
  actionNumber: number,
): Promise<{ videoUrl: string | null; thumbnailUrl: string | null }> {
  const cacheKey = `${gameId}:${actionNumber}`;
  const memoryCached = videoAssetCache.get(cacheKey);
  if (memoryCached) return memoryCached;

  const persisted = await getPersistentValue<{
    videoUrl: string | null;
    thumbnailUrl: string | null;
  }>("video-assets", cacheKey);
  if (persisted) {
    videoAssetCache.set(cacheKey, persisted);
    return persisted;
  }

  try {
    const asset = await getVideoEventAsset(gameId, actionNumber);
    const firstVideo = asset?.resultSets?.Meta?.videoUrls?.[0];
    const cachedValue = {
      videoUrl: firstVideo?.murl ?? null,
      thumbnailUrl: firstVideo?.mth ?? null,
    };
    videoAssetCache.set(cacheKey, cachedValue);
    await setPersistentValue("video-assets", cacheKey, cachedValue);
    return cachedValue;
  } catch {
    const cachedValue = { videoUrl: null, thumbnailUrl: null };
    videoAssetCache.set(cacheKey, cachedValue);
    await setPersistentValue("video-assets", cacheKey, cachedValue);
    return cachedValue;
  }
}

async function getCachedPlayByPlay(gameId: string): Promise<RawAction[]> {
  const cached = playByPlayCache.get(gameId);
  if (cached) return cached;

  const persisted = await getPersistentValue<RawAction[]>("play-by-play", gameId);
  if (persisted) {
    playByPlayCache.set(gameId, persisted);
    return persisted;
  }

  const actions = await getPlayByPlay(gameId);
  playByPlayCache.set(gameId, actions);
  await setPersistentValue("play-by-play", gameId, actions);
  return actions;
}

async function getCachedPlayerNameMap(
  gameId: string,
): Promise<Map<number, string>> {
  const cached = boxScoreCache.get(gameId);
  if (cached) return cached;
  const nameMap = await getPlayerNameMapForGame(gameId);
  boxScoreCache.set(gameId, nameMap);
  return nameMap;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function run() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const item = items[currentIndex] as T;
      results[currentIndex] = await worker(item);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );

  return results;
}

async function getCachedPlayerDirectory(
  season: string,
): Promise<PlayerDirectoryEntry[]> {
  const cached = playerDirectoryCache.get(season);
  if (cached) return cached;

  const persisted = await getPersistentValue<PlayerDirectoryEntry[]>(
    "player-directory",
    season,
  );
  if (persisted) {
    playerDirectoryCache.set(season, persisted);
    return persisted;
  }

  const directory = await getAllPlayers(season);
  playerDirectoryCache.set(season, directory);
  await setPersistentValue("player-directory", season, directory);
  return directory;
}

async function getCachedPlayerGameLogForSeason(
  personId: number,
  season: string,
): Promise<PlayerGameLogEntry[]> {
  const cacheKey = `${personId}:${season}`;
  const cached = playerGameLogCache.get(cacheKey);
  if (cached) return cached;

  const persisted = await getPersistentValue<PlayerGameLogEntry[]>(
    "player-game-logs",
    cacheKey,
  );
  if (persisted) {
    playerGameLogCache.set(cacheKey, persisted);
    return persisted;
  }

  const gameLog = await getPlayerGameLog(personId, season);
  playerGameLogCache.set(cacheKey, gameLog);
  await setPersistentValue("player-game-logs", cacheKey, gameLog);
  return gameLog;
}

async function getCachedSeasonActions(
  cacheKey: string,
): Promise<PlayerActionWithGame[] | null> {
  const cached = playerSeasonActionsCache.get(cacheKey);
  if (cached) return cached;

  const persisted = await getPersistentValue<PlayerActionWithGame[]>(
    "player-season-actions",
    cacheKey,
  );
  if (persisted) {
    playerSeasonActionsCache.set(cacheKey, persisted);
    return persisted;
  }

  return null;
}

async function setCachedSeasonActions(
  cacheKey: string,
  actions: PlayerActionWithGame[],
): Promise<void> {
  playerSeasonActionsCache.set(cacheKey, actions);
  await setPersistentValue("player-season-actions", cacheKey, actions);
}

function getRequestIp(req: express.Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function logRouteError(route: string, error: unknown, meta: Record<string, unknown>) {
  logger.error(`${route}_failed`, {
    ...meta,
    ...serializeError(error),
  });
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || apiConfig.allowedOrigins.length === 0) {
        callback(null, true);
        return;
      }

      if (apiConfig.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by ClipZero API"));
    },
  }),
);
app.use(express.json());
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    logger.info("request", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      ip: getRequestIp(req),
    });
  });
  next();
});
app.use((req, res, next) => {
  if (req.path === "/health") {
    next();
    return;
  }

  if (!apiConfig.disabled) {
    next();
    return;
  }

  res.status(503).json({
    error: "ClipZero access is temporarily disabled",
    details: "Disable the CLIPZERO_DISABLE_ACCESS switch to restore traffic",
  });
});
app.use(
  createRateLimiter({
    name: "global",
    windowMs: apiConfig.rateLimit.windowMs,
    max: apiConfig.rateLimit.max,
  }),
);
app.use(
  "/clips/game",
  createRateLimiter({
    name: "clips-game",
    windowMs: apiConfig.rateLimit.heavyWindowMs,
    max: apiConfig.rateLimit.heavyMax,
  }),
);
app.use(
  "/clips/player",
  createRateLimiter({
    name: "clips-player",
    windowMs: apiConfig.rateLimit.heavyWindowMs,
    max: apiConfig.rateLimit.heavyMax,
  }),
);
app.use(
  "/players",
  createRateLimiter({
    name: "players",
    windowMs: apiConfig.rateLimit.playersWindowMs,
    max: apiConfig.rateLimit.playersMax,
  }),
);

function matchesDistanceBucket(
  distance: number | undefined,
  bucket: string,
): boolean {
  if (distance === undefined || distance === null) return false;
  switch (bucket) {
    case "0-9":
      return distance >= 0 && distance <= 9;
    case "10-19":
      return distance >= 10 && distance <= 19;
    case "20-29":
      return distance >= 20 && distance <= 29;
    case "30+":
      return distance >= 30;
    default:
      return true;
  }
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    disabled: apiConfig.disabled,
    cacheDir: apiConfig.cacheDir,
    timestamp: new Date().toISOString(),
  });
});

app.get("/games", async (req, res) => {
  try {
    const date =
      typeof req.query.date === "string" && req.query.date.trim() !== ""
        ? req.query.date
        : "";

    const cacheKey = date || "today";

    const memoryCached = gamesCache.get(cacheKey);
    if (memoryCached) {
      return res.json(memoryCached);
    }

    const diskCached = await getCachedGames(cacheKey);
    if (diskCached) {
      gamesCache.set(cacheKey, diskCached);
      return res.json(diskCached);
    }

    const games = date ? await getGamesByDate(date) : await getTodaysGames();

    const payload = {
      count: games.length,
      games: games.map((game) => ({
        gameId: game.gameId,
        gameCode: game.gameCode,
        gameStatusText: game.gameStatusText,
        matchup: `${game.awayTeam.teamTricode} @ ${game.homeTeam.teamTricode}`,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
      })),
    };

    gamesCache.set(cacheKey, payload);
    await setCachedGames(cacheKey, payload);

    res.json(payload);
  } catch (error: any) {
    logRouteError("games", error, {
      date: typeof req.query.date === "string" ? req.query.date : "",
    });
    res.status(500).json({
      error: "Failed to fetch games",
      details: error?.response?.status ?? error?.message ?? "unknown error",
    });
  }
});

app.get("/clips/test", async (_req, res) => {
  try {
    const gameId = "0022501115";
    const gameEventId = 7;

    const asset = await getVideoEventAsset(gameId, gameEventId);
    const firstVideo = asset?.resultSets?.Meta?.videoUrls?.[0];

    res.json({
      gameId,
      gameEventId,
      success: Boolean(firstVideo?.murl),
      videoUrl: firstVideo?.murl ?? null,
      thumbnailUrl: firstVideo?.mth ?? null,
    });
  } catch (error: any) {
    logRouteError("clips_test", error, {});
    res.status(500).json({
      error: "Failed to fetch test clip",
      details: error?.response?.status ?? error?.message ?? "unknown error",
    });
  }
});

app.get("/clips/game", async (req, res) => {
  try {
    const startedAt = Date.now();
    let assetCacheHits = 0;
    let assetCacheMisses = 0;
    const gameId =
      typeof req.query.gameId === "string" && req.query.gameId.trim() !== ""
        ? req.query.gameId
        : "0022501115";

    const player =
      typeof req.query.player === "string" ? req.query.player.trim() : "";

    // Parse comma-separated multi-select player values into array.
    const playerValues = player
      ? player
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
      : [];

    const team =
      typeof req.query.team === "string" ? req.query.team.trim() : "";

    // Parse comma-separated multi-select values into arrays.
    // Empty string means "all" (no filter).
    const teamValues = team
      ? team
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const result =
      typeof req.query.result === "string" && req.query.result.trim() !== ""
        ? req.query.result
        : "all";

    const limitParam =
      typeof req.query.limit === "string" ? Number(req.query.limit) : 12;

    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 12;

    const offsetParam =
      typeof req.query.offset === "string" ? Number(req.query.offset) : 0;

    const offset =
      Number.isFinite(offsetParam) && offsetParam >= 0
        ? Math.floor(offsetParam)
        : 0;

    const playType =
      typeof req.query.playType === "string" && req.query.playType.trim() !== ""
        ? req.query.playType
        : "all";

    const quarterParam =
      typeof req.query.quarter === "string" ? req.query.quarter.trim() : "";

    const quarterValues = quarterParam
      ? quarterParam
          .split(",")
          .map((q) => Number(q.trim()))
          .filter((n) => Number.isFinite(n) && n > 0)
      : [];

    const shotValue =
      typeof req.query.shotValue === "string"
        ? req.query.shotValue.trim().toLowerCase()
        : "";

    const subType =
      typeof req.query.subType === "string"
        ? req.query.subType.trim().toLowerCase()
        : "";

    const subTypeValues = subType
      ? subType
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const distanceBucket =
      typeof req.query.distanceBucket === "string"
        ? req.query.distanceBucket.trim()
        : "";

    const distanceBucketValues = distanceBucket
      ? distanceBucket
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean)
      : [];

    const actionNumberParam =
      typeof req.query.actionNumber === "string"
        ? Number(req.query.actionNumber)
        : NaN;
    const targetActionNumber =
      Number.isFinite(actionNumberParam) && actionNumberParam > 0
        ? actionNumberParam
        : null;

    const cacheKey = `${gameId}:${player}:${team}:${result}:${playType}:${quarterParam}:${shotValue}:${subType}:${distanceBucket}:${limit}:${offset}`;
    // Bypass response cache when an actionNumber lookup is requested,
    // since targetIndex is not part of the cached payload.
    if (!targetActionNumber) {
      const cached = clipCache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    const actions = await getCachedPlayByPlay(gameId);
    const allShots = getFilteredActions(gameId, actions, playType);

    const playerNameMap = await getCachedPlayerNameMap(gameId);

    const normalizedShots = allShots.map((shot) => ({
      ...shot,
      playerName:
        (shot.personId ? playerNameMap.get(shot.personId) : undefined) ??
        shot.playerName,
    }));

    const playerOptionPool = normalizedShots.filter((shot) => {
      const matchesTeam =
        teamValues.length === 0 || teamValues.includes(shot.teamTricode ?? "");
      // result filter applies to shots; non-shot actions always pass
      const isShot =
        shot.actionType?.toLowerCase() === "2pt" ||
        shot.actionType?.toLowerCase() === "3pt";
      const matchesResult =
        result === "all" || !isShot || shot.shotResult === result;
      const matchesQuarter =
        quarterValues.length === 0 || quarterValues.includes(shot.period ?? 0);
      const matchesShotValue =
        !shotValue || shot.actionType?.toLowerCase() === shotValue;
      const matchesSubType =
        subTypeValues.length === 0 ||
        subTypeValues.some((st) =>
          matchesNormalizedGroup(playType, st, shot.subType, shot.description),
        );
      const matchesDistance =
        distanceBucketValues.length === 0 ||
        distanceBucketValues.some((db) =>
          matchesDistanceBucket(shot.shotDistance, db),
        );
      return (
        matchesTeam &&
        matchesResult &&
        matchesQuarter &&
        matchesShotValue &&
        matchesSubType &&
        matchesDistance
      );
    });

    const playerMap = new Map<string, { name: string; teamTricode: string }>();
    for (const shot of playerOptionPool) {
      if (shot.playerName && !playerMap.has(shot.playerName)) {
        playerMap.set(shot.playerName, {
          name: shot.playerName,
          teamTricode: shot.teamTricode ?? "",
        });
      }
    }
    const players = Array.from(playerMap.values());

    const filteredShots = playerOptionPool.filter((shot) => {
      const matchesPlayer =
        playerValues.length === 0 ||
        playerValues.includes(shot.playerName ?? "");
      return matchesPlayer;
    });

    const shots = filteredShots.slice(offset, offset + limit);

    const clips = await mapWithConcurrency(shots, 6, async (shot) => {
      if (!shot.actionNumber) {
        return {
          ...shot,
          videoUrl: null,
          thumbnailUrl: null,
        };
      }

      const cachedAsset = await getCachedVideoAsset(gameId, shot.actionNumber);
      if (cachedAsset.videoUrl || cachedAsset.thumbnailUrl) {
        assetCacheHits += 1;
        return {
          ...shot,
          videoUrl: cachedAsset.videoUrl,
          thumbnailUrl: cachedAsset.thumbnailUrl,
        };
      }

      assetCacheMisses += 1;
      return {
        ...shot,
        ...cachedAsset,
      };
    });

    const hasMore = offset + clips.length < filteredShots.length;
    const nextOffset = hasMore ? offset + clips.length : null;

    // Compute the index of the target actionNumber in the full filtered set
    let targetIndex: number | null | undefined;
    if (targetActionNumber !== null) {
      const idx = filteredShots.findIndex(
        (s) => s.actionNumber === targetActionNumber,
      );
      targetIndex = idx >= 0 ? idx : null;
    }

    const payload = {
      gameId,
      count: clips.length,
      total: filteredShots.length,
      offset,
      limit,
      hasMore,
      nextOffset,
      players,
      clips,
      ...(targetIndex !== undefined ? { targetIndex } : {}),
    };

    // Only cache when no actionNumber lookup (to keep cache entries stable)
    if (!targetActionNumber) {
      clipCache.set(cacheKey, payload);
    }

    logger.info("clips_game_ready", {
      gameId,
      playType,
      quarter: quarterParam || "all",
      team: team || "all",
      player: player || "all",
      result,
      offset,
      clipCount: clips.length,
      totalCount: filteredShots.length,
      hasMore,
      nextOffset,
      assetCacheHits,
      assetCacheMisses,
      time: msSince(startedAt),
    });
    res.json(payload);
  } catch (error: any) {
    logRouteError("clips_game", error, {
      gameId: typeof req.query.gameId === "string" ? req.query.gameId : "",
    });
    res.status(500).json({
      error: "Failed to fetch game clips",
      details: error?.response?.status ?? error?.message ?? "unknown error",
    });
  }
});

// ── Player-mode endpoints ────────────────────────────────────────────

/**
 * GET /players?q=<name>&season=<season>
 * Search the player directory for a season. Returns up to 15 matches.
 *
 * Response: { count, players: [{ personId, displayName, teamTricode }] }
 */
app.get("/players", async (req, res) => {
  try {
    const q =
      typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const season =
      typeof req.query.season === "string" && req.query.season.trim() !== ""
        ? req.query.season.trim()
        : "2025-26";

    const directory = await getCachedPlayerDirectory(season);

    let matches = directory;
    if (q) {
      const queryParts = q.split(/\s+/).filter(Boolean);
      matches = directory.filter((p) => {
        const name = p.displayName.toLowerCase();
        const nameParts = name.split(/\s+/);
        return queryParts.every((part) =>
          nameParts.some((np) => np.startsWith(part)),
        );
      });
    }

    const limited = matches.slice(0, 15);

    res.json({
      count: limited.length,
      totalMatches: matches.length,
      players: limited.map((p) => ({
        personId: p.personId,
        displayName: p.displayName,
        teamTricode: p.teamTricode,
      })),
    });
  } catch (error: any) {
    logRouteError("players", error, {
      season:
        typeof req.query.season === "string" ? req.query.season.trim() : "2025-26",
    });
    res.status(500).json({
      error: "Failed to fetch players",
      details: error?.response?.status ?? error?.message ?? "unknown error",
    });
  }
});

/**
 * GET /players/:personId/games?season=<season>
 * Fetch a player's game log for a season.
 *
 * Response: { personId, season, count, games: [{ gameId, gameDate, matchup, wl, min, pts, reb, ast }] }
 */
app.get("/players/:personId/games", async (req, res) => {
  try {
    const personId = Number(req.params.personId);
    if (!Number.isFinite(personId) || personId <= 0) {
      return res.status(400).json({ error: "Invalid personId" });
    }

    const season =
      typeof req.query.season === "string" && req.query.season.trim() !== ""
        ? req.query.season.trim()
        : "2025-26";

    const gameLog = await getCachedPlayerGameLogForSeason(personId, season);

    res.json({
      personId,
      season,
      count: gameLog.length,
      games: gameLog,
    });
  } catch (error: any) {
    logRouteError("player_games", error, {
      personId: req.params.personId,
    });
    res.status(500).json({
      error: "Failed to fetch player game log",
      details: error?.response?.status ?? error?.message ?? "unknown error",
    });
  }
});

/**
 * GET /clips/player
 * Aggregated clips for a player across multiple games in a season.
 *
 * Query params:
 *   personId   (required) — player's NBA person ID
 *   season     (optional) — e.g. "2025-26" (default)
 *   playType   (optional) — shots|assists|rebounds|turnovers|steals|blocks|fouls (default: shots)
 *   result     (optional) — all|Made|Missed (default: all)
 *   quarter    (optional) — 1-7, 0 = all
 *   limit      (optional) — max clips per page (default: 12)
 *   offset     (optional) — pagination offset (default: 0)
 *   excludeDates  (optional) — comma-separated YYYY-MM-DD dates to skip
 *   excludeGameIds (optional) — comma-separated gameIds to skip
 *
 * Response: {
 *   personId, season, count, total, offset, limit, hasMore, nextOffset,
 *   gamesIncluded, gamesExcluded, clips[]
 * }
 */
app.get("/clips/player", async (req, res) => {
  try {
    const startedAt = Date.now();

    const personId =
      typeof req.query.personId === "string" ? Number(req.query.personId) : NaN;
    if (!Number.isFinite(personId) || personId <= 0) {
      return res.status(400).json({ error: "personId is required" });
    }

    const season =
      typeof req.query.season === "string" && req.query.season.trim() !== ""
        ? req.query.season.trim()
        : "2025-26";

    const playType =
      typeof req.query.playType === "string" && req.query.playType.trim() !== ""
        ? req.query.playType.trim()
        : "all";

    const result =
      typeof req.query.result === "string" && req.query.result.trim() !== ""
        ? req.query.result.trim()
        : "all";

    const quarterParam =
      typeof req.query.quarter === "string" ? req.query.quarter.trim() : "";
    const quarterValues = quarterParam
      ? quarterParam
          .split(",")
          .map((q) => Number(q.trim()))
          .filter((n) => Number.isFinite(n) && n > 0)
      : [];

    const shotValue =
      typeof req.query.shotValue === "string"
        ? req.query.shotValue.trim().toLowerCase()
        : "";

    const subType =
      typeof req.query.subType === "string"
        ? req.query.subType.trim().toLowerCase()
        : "";

    const subTypeValues = subType
      ? subType
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const distanceBucket =
      typeof req.query.distanceBucket === "string"
        ? req.query.distanceBucket.trim()
        : "";

    const distanceBucketValues = distanceBucket
      ? distanceBucket
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean)
      : [];

    const opponent =
      typeof req.query.opponent === "string"
        ? req.query.opponent.trim().toUpperCase()
        : "";

    const limitParam =
      typeof req.query.limit === "string" ? Number(req.query.limit) : 12;
    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 12;

    const offsetParam =
      typeof req.query.offset === "string" ? Number(req.query.offset) : 0;
    const offset =
      Number.isFinite(offsetParam) && offsetParam >= 0
        ? Math.floor(offsetParam)
        : 0;

    const excludeDates = new Set(
      typeof req.query.excludeDates === "string" &&
        req.query.excludeDates.trim() !== ""
        ? req.query.excludeDates.split(",").map((d) => d.trim())
        : [],
    );

    const excludeGameIds = new Set(
      typeof req.query.excludeGameIds === "string" &&
        req.query.excludeGameIds.trim() !== ""
        ? req.query.excludeGameIds.split(",").map((g) => g.trim())
        : [],
    );

    const actionNumberParam =
      typeof req.query.actionNumber === "string"
        ? Number(req.query.actionNumber)
        : NaN;
    const targetActionNumber =
      Number.isFinite(actionNumberParam) && actionNumberParam > 0
        ? actionNumberParam
        : null;

    // Check response cache (bypass when actionNumber lookup is requested)
    const cacheKey = `${personId}:${season}:${playType}:${result}:${quarterParam}:${shotValue}:${subType}:${distanceBucket}:${opponent}:${limit}:${offset}:${[...excludeDates].sort().join(",")}:${[...excludeGameIds].sort().join(",")}`;
    if (!targetActionNumber) {
      const cached = playerClipCache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    // 1. Get the player's game log
    const gameLog = await getCachedPlayerGameLogForSeason(personId, season);

    // 2. Get or build season-level actions cache
    //    Keyed by personId:season:playType — reused across result/quarter/exclusion/page changes
    const seasonCacheKey = `${personId}:${season}:${playType}`;
    let seasonActions = await getCachedSeasonActions(seasonCacheKey);
    const seasonCacheHit = seasonActions !== null;

    if (!seasonActions) {
      const collected: PlayerActionWithGame[] = [];

      // Process ALL games (concurrency 5, parallel PBP+boxscore per game)
      await mapWithConcurrency(gameLog, 5, async (game) => {
        try {
          const gameDateNorm = normalizeDate(game.gameDate);

          const [actions, playerNameMap] = await Promise.all([
            getCachedPlayByPlay(game.gameId),
            getCachedPlayerNameMap(game.gameId),
          ]);

          const filtered = getFilteredActions(game.gameId, actions, playType);

          const playerActions = filtered
            .map((action) => ({
              ...action,
              playerName:
                (action.personId
                  ? playerNameMap.get(action.personId)
                  : undefined) ?? action.playerName,
            }))
            .filter((action) => action.personId === personId)
            .map((action) => ({
              ...action,
              gameDate: gameDateNorm,
              matchup: game.matchup,
            }));

          collected.push(...playerActions);
        } catch (err) {
          logger.warn("clips_player_game_fetch_failed", {
            gameId: game.gameId,
            personId,
            season,
            errorMessage: err instanceof Error ? err.message : "unknown",
          });
        }
      });

      collected.sort((a, b) => {
        const dateCompare = (b.gameDate ?? "").localeCompare(a.gameDate ?? "");
        if (dateCompare !== 0) return dateCompare;
        const periodCompare = (a.period ?? 0) - (b.period ?? 0);
        if (periodCompare !== 0) return periodCompare;
        return (b.clock ?? "").localeCompare(a.clock ?? "");
      });

      seasonActions = collected;
      await setCachedSeasonActions(seasonCacheKey, seasonActions);
    }

    // 3. Apply exclusions + result/quarter filters from cached season data
    const excludedGames: {
      gameId: string;
      gameDate: string;
      reason: string;
    }[] = [];
    const excludedGameIdSet = new Set<string>();

    for (const game of gameLog) {
      const nd = normalizeDate(game.gameDate);
      if (excludeGameIds.has(game.gameId)) {
        excludedGames.push({
          gameId: game.gameId,
          gameDate: nd,
          reason: "excludeGameIds",
        });
        excludedGameIdSet.add(game.gameId);
      } else if (excludeDates.has(nd)) {
        excludedGames.push({
          gameId: game.gameId,
          gameDate: nd,
          reason: "excludeDates",
        });
        excludedGameIdSet.add(game.gameId);
      }
    }

    const filteredActions = seasonActions.filter((action) => {
      if (excludedGameIdSet.has(action.gameId)) return false;
      // opponent filter: only include games where matchup contains the opponent tricode
      if (opponent && action.matchup && !action.matchup.includes(opponent))
        return false;
      // result filter applies to shots; non-shot actions always pass
      const isShot =
        action.actionType?.toLowerCase() === "2pt" ||
        action.actionType?.toLowerCase() === "3pt";
      const matchesResult =
        result === "all" || !isShot || action.shotResult === result;
      const matchesQuarter =
        quarterValues.length === 0 ||
        quarterValues.includes(action.period ?? 0);
      const matchesShotValue =
        !shotValue || action.actionType?.toLowerCase() === shotValue;
      const matchesSubType =
        subTypeValues.length === 0 ||
        subTypeValues.some((st) =>
          matchesNormalizedGroup(
            playType,
            st,
            action.subType,
            action.description,
          ),
        );
      const matchesDistance =
        distanceBucketValues.length === 0 ||
        distanceBucketValues.some((db) =>
          matchesDistanceBucket(action.shotDistance, db),
        );
      return (
        matchesResult &&
        matchesQuarter &&
        matchesShotValue &&
        matchesSubType &&
        matchesDistance
      );
    });

    const total = filteredActions.length;

    // 4. Paginate
    const pageActions = filteredActions.slice(offset, offset + limit);

    // 6. Resolve video URLs for the page
    let assetCacheHits = 0;
    let assetCacheMisses = 0;

    const clips = await mapWithConcurrency(pageActions, 6, async (action) => {
      if (!action.actionNumber) {
        return { ...action, videoUrl: null, thumbnailUrl: null };
      }

      const cachedAsset = await getCachedVideoAsset(
        action.gameId,
        action.actionNumber,
      );
      if (cachedAsset.videoUrl || cachedAsset.thumbnailUrl) {
        assetCacheHits += 1;
        return { ...action, ...cachedAsset };
      }

      assetCacheMisses += 1;
      return { ...action, ...cachedAsset };
    });

    const hasMore = offset + clips.length < total;
    const nextOffset = hasMore ? offset + clips.length : null;

    // Compute the index of the target actionNumber in the full filtered set
    let targetIndex: number | null | undefined;
    if (targetActionNumber !== null) {
      const idx = filteredActions.findIndex(
        (a) => a.actionNumber === targetActionNumber,
      );
      targetIndex = idx >= 0 ? idx : null;
    }

    const payload = {
      personId,
      season,
      playType,
      result,
      quarter: quarterParam || "all",
      count: clips.length,
      total,
      offset,
      limit,
      hasMore,
      nextOffset,
      gamesIncluded: gameLog.length - excludedGames.length,
      gamesExcluded: excludedGames.length,
      exclusions: excludedGames,
      clips,
      ...(targetIndex !== undefined ? { targetIndex } : {}),
    };

    // Only cache when no actionNumber lookup
    if (!targetActionNumber) {
      playerClipCache.set(cacheKey, payload);
    }

    logger.info("clips_player_ready", {
      personId,
      season,
      playType,
      result,
      quarter: quarterParam || "all",
      opponent: opponent || "all",
      gamesIncluded: gameLog.length - excludedGames.length,
      gamesTotal: gameLog.length,
      offset,
      clipCount: clips.length,
      totalCount: total,
      hasMore,
      assetCacheHits,
      assetCacheMisses,
      seasonCache: seasonCacheHit ? "hit" : "miss",
      time: msSince(startedAt),
    });

    res.json(payload);
  } catch (error: any) {
    logRouteError("clips_player", error, {
      personId:
        typeof req.query.personId === "string" ? req.query.personId : "",
    });
    res.status(500).json({
      error: "Failed to fetch player clips",
      details: error?.response?.status ?? error?.message ?? "unknown error",
    });
  }
});

app.listen(port, () => {
  logger.info("api_started", {
    port,
    cacheDir: apiConfig.cacheDir,
    disabled: apiConfig.disabled,
    allowedOrigins:
      apiConfig.allowedOrigins.length > 0 ? apiConfig.allowedOrigins : ["*"],
  });
});
