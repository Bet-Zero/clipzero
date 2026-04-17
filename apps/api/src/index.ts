import axios from "axios";
import cors from "cors";
import express from "express";
import helmet from "helmet";
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
  getTeamByTricode,
  getTeamGameLog,
} from "./lib/nba";
import type {
  PlayerDirectoryEntry,
  PlayerGameLogEntry,
  RawAction,
  TeamDirectoryEntry,
  TeamGameLogEntry,
} from "./lib/nba";
import { getPersistentValue, setPersistentValue } from "./lib/persistentCache";
import { createRateLimiter } from "./lib/rateLimit";
import { matchesNormalizedGroup } from "./lib/subtypeGroups";

// ---------------------------------------------------------------------------
// NBA video CDN health check
// ---------------------------------------------------------------------------
// The NBA CDN (videos.nba.com) can return misleading metadata for HEAD requests.
// Use a tiny ranged GET against a deliberately non-existent path instead. Real
// video paths return 206 with clip-specific ETags; fake paths should not return
// a partial MP4. If a fake path ever does return 200/206, treat that as a
// catch-all placeholder condition and stop handing video URLs to the frontend.
//
// We re-check periodically so the app self-heals when the CDN comes back.
// ---------------------------------------------------------------------------
const NBA_VIDEO_CDN_PROBE_URL =
  "https://videos.nba.com/nba/pbp/media/0000/00/00/0000000000/0/00000000-0000-0000-0000-000000000000_960x540.mp4";
const NBA_VIDEO_CDN_CHECK_INTERVAL_MS = 60_000;

let nbaVideoCdnAvailable = true;
let lastNbaVideoCdnCheck = 0;
let nbaVideoCdnCheckInFlight: Promise<boolean> | null = null;

async function refreshNbaVideoCdnHealth(): Promise<boolean> {
  try {
    const res = await axios.get(NBA_VIDEO_CDN_PROBE_URL, {
      headers: {
        Range: "bytes=0-0",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://www.nba.com/",
        Origin: "https://www.nba.com",
      },
      responseType: "arraybuffer",
      timeout: 8000,
      validateStatus: () => true,
    });
    const available = res.status !== 200 && res.status !== 206;
    if (available !== nbaVideoCdnAvailable) {
      logger.info("nba_video_cdn_health_changed", {
        available,
        statusCode: res.status,
        etag: res.headers.etag,
        contentLength: res.headers["content-length"],
      });
    }
    nbaVideoCdnAvailable = available;
  } catch (error) {
    // Fail open: if the probe itself fails, do not hide potentially working
    // videos because we could not verify the placeholder condition.
    if (!nbaVideoCdnAvailable) {
      logger.info("nba_video_cdn_health_changed", { available: true });
    }
    nbaVideoCdnAvailable = true;
    logger.warn("nba_video_cdn_health_probe_failed", serializeError(error));
  } finally {
    lastNbaVideoCdnCheck = Date.now();
  }

  return nbaVideoCdnAvailable;
}

async function checkNbaVideoCdnHealth(): Promise<boolean> {
  // Do not block NBA URLs based on synthetic CDN probes. The CDN returns
  // misleading responses for fake paths, while real clip URLs can still play.
  // The source of truth is whether videoeventsasset returns a clip URL.
  return true;
}

// Fire-and-forget initial check so we know the state early.
void checkNbaVideoCdnHealth();

const app = express();
// Only trust proxy when explicitly configured (e.g. behind Cloudflare/nginx).
// When self-hosting directly, trusting proxy headers lets attackers spoof IPs
// to bypass rate limiting via X-Forwarded-For.
app.set("trust proxy", process.env.CLIPZERO_TRUST_PROXY === "1");
const port = apiConfig.port;
const clipCache = new Map<string, unknown>();
const gamesCache = new Map<string, unknown>();
const videoAssetCache = new Map<
  string,
  { videoUrl: string | null; thumbnailUrl: string | null }
>();
const playerDirectoryCache = new Map<string, PlayerDirectoryEntry[]>();
const playerGameLogCache = new Map<string, PlayerGameLogEntry[]>();
const teamGameLogCache = new Map<string, TeamGameLogEntry[]>();
const matchupGamesCache = new Map<string, MatchupGame[]>();
const playerClipCache = new Map<string, unknown>();
const matchupClipCache = new Map<string, unknown>();
const playByPlayCache = new Map<string, RawAction[]>();
const boxScoreCache = new Map<string, Map<number, string>>();

const emptyVideoAsset = {
  videoUrl: null,
  thumbnailUrl: null,
} as const;

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
  area?: string | undefined;
  areaDetail?: string | undefined;
  descriptor?: string | undefined;
  qualifiers?: string[] | undefined;
  videoActionNumber?: number | undefined;
};

type MatchupGame = {
  gameId: string;
  gameDate: string;
  matchup: string;
  wl: string;
  homeTeam: Pick<TeamDirectoryEntry, "teamId" | "tricode" | "fullName">;
  awayTeam: Pick<TeamDirectoryEntry, "teamId" | "tricode" | "fullName">;
  homeScore: number | null;
  awayScore: number | null;
};

type SeasonActionsBundle = {
  actions: PlayerActionWithGame[];
  scannedGameIds: string[];
};

const playerSeasonActionsCache = new Map<string, SeasonActionsBundle>();

// How many games to scan per request when the season actions cache is cold or
// partially built.  Keeping this small prevents a burst of 60–80 simultaneous
// PBP requests to cdn.nba.com on the first player selection, which can trip
// rate-limiting and cause the endpoint to fail or time out.
const SEASON_SCAN_BATCH_SIZE = 15;

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

  // When the CDN is down (serving placeholder for all paths), don't use cached
  // URLs because they will play the placeholder.  Also don't fetch new ones —
  // they would be equally useless and we'd risk persisting them to disk.
  const videoCdnAvailable = await checkNbaVideoCdnHealth();
  if (!videoCdnAvailable) {
    return emptyVideoAsset;
  }

  const memoryCached = videoAssetCache.get(cacheKey);
  if (memoryCached) return memoryCached;

  const persisted = await getPersistentValue<{
    videoUrl: string | null;
    thumbnailUrl: string | null;
  }>("video-assets", cacheKey);
  // Only use persisted value if it has a valid URL — don't serve stale nulls
  // from previously failed fetches.
  if (persisted && (persisted.videoUrl || persisted.thumbnailUrl)) {
    videoAssetCache.set(cacheKey, persisted);
    return persisted;
  }

  function persistCachedValue(cachedValue: {
    videoUrl: string | null;
    thumbnailUrl: string | null;
  }) {
    void setPersistentValue("video-assets", cacheKey, cachedValue).catch(
      (error) => {
        logger.warn("persistent_cache_write_failed", {
          cacheName: "video-assets",
          cacheKey,
          gameId,
          actionNumber,
          ...serializeError(error),
        });
      },
    );
  }

  try {
    const asset = await getVideoEventAsset(gameId, actionNumber);
    const firstVideo = asset?.resultSets?.Meta?.videoUrls?.[0];
    const cachedValue = {
      videoUrl: firstVideo?.murl ?? null,
      thumbnailUrl: firstVideo?.mth ?? null,
    };
    videoAssetCache.set(cacheKey, cachedValue);
    // Only persist to disk when we have a valid URL — don't permanently cache
    // failures or empty results so they can be retried on future requests.
    if (cachedValue.videoUrl || cachedValue.thumbnailUrl) {
      persistCachedValue(cachedValue);
    }
    return cachedValue;
  } catch {
    // Don't cache failures at all — allow retry on every subsequent request.
    return { videoUrl: null, thumbnailUrl: null };
  }
}

function persistValueBestEffort<T>(
  cacheName: string,
  cacheKey: string,
  value: T,
): void {
  void setPersistentValue(cacheName, cacheKey, value).catch((error) => {
    logger.warn("persistent_cache_write_failed", {
      cacheName,
      cacheKey,
      ...serializeError(error),
    });
  });
}

async function getCachedPlayByPlay(gameId: string): Promise<RawAction[]> {
  const cached = playByPlayCache.get(gameId);
  if (cached) return cached;

  const persisted = await getPersistentValue<RawAction[]>(
    "play-by-play",
    gameId,
  );
  if (persisted) {
    playByPlayCache.set(gameId, persisted);
    return persisted;
  }

  const actions = await getPlayByPlay(gameId);
  playByPlayCache.set(gameId, actions);
  persistValueBestEffort("play-by-play", gameId, actions);
  return actions;
}

async function getCachedPlayerNameMap(
  gameId: string,
): Promise<Map<number, string>> {
  const cached = boxScoreCache.get(gameId);
  if (cached) return cached;

  try {
    const nameMap = await Promise.race([
      getPlayerNameMapForGame(gameId),
      new Promise<Map<number, string>>((_, reject) => {
        setTimeout(() => reject(new Error("boxscore name map timeout")), 5000);
      }),
    ]);
    boxScoreCache.set(gameId, nameMap);
    return nameMap;
  } catch (error) {
    logger.warn("boxscore_name_map_unavailable", {
      gameId,
      ...serializeError(error),
    });
    return new Map();
  }
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
  persistValueBestEffort("player-directory", season, directory);
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
  persistValueBestEffort("player-game-logs", cacheKey, gameLog);
  return gameLog;
}

async function getCachedTeamGameLogForSeason(
  team: TeamDirectoryEntry,
  season: string,
): Promise<TeamGameLogEntry[]> {
  const cacheKey = `${team.tricode}:${season}`;
  const cached = teamGameLogCache.get(cacheKey);
  if (cached) return cached;

  const persisted = await getPersistentValue<TeamGameLogEntry[]>(
    "team-game-logs",
    cacheKey,
  );
  if (persisted) {
    teamGameLogCache.set(cacheKey, persisted);
    return persisted;
  }

  const gameLog = await getTeamGameLog(team.teamId, season);
  teamGameLogCache.set(cacheKey, gameLog);
  persistValueBestEffort("team-game-logs", cacheKey, gameLog);
  return gameLog;
}

function teamLite(team: TeamDirectoryEntry): MatchupGame["homeTeam"] {
  return {
    teamId: team.teamId,
    tricode: team.tricode,
    fullName: team.fullName,
  };
}

function buildMatchupGame(
  entry: TeamGameLogEntry,
  perspectiveTeam: TeamDirectoryEntry,
  opponentTeam: TeamDirectoryEntry,
): MatchupGame | null {
  const matchup = entry.matchup.toUpperCase();
  const isAway = /\s@\s/.test(matchup);
  const isHome = /\sVS\.?\s/.test(matchup);

  if (!matchup.includes(opponentTeam.tricode)) return null;
  if (!isAway && !isHome) return null;

  const awayTeam = isAway ? perspectiveTeam : opponentTeam;
  const homeTeam = isHome ? perspectiveTeam : opponentTeam;

  // Compute scores: the game log gives us the perspective team's pts and
  // plusMinus, so opponentScore = pts - plusMinus.
  let perspectiveScore: number | null = null;
  let opponentScore: number | null = null;
  if (entry.pts !== null && entry.plusMinus !== null) {
    perspectiveScore = entry.pts;
    opponentScore = entry.pts - entry.plusMinus;
  }
  const awayScore = isAway ? perspectiveScore : opponentScore;
  const homeScore = isHome ? perspectiveScore : opponentScore;

  return {
    gameId: entry.gameId,
    gameDate: normalizeDate(entry.gameDate),
    matchup: `${awayTeam.tricode} @ ${homeTeam.tricode}`,
    wl: entry.wl,
    awayTeam: teamLite(awayTeam),
    homeTeam: teamLite(homeTeam),
    awayScore,
    homeScore,
  };
}

async function getCachedMatchupGamesForSeason(
  teamA: TeamDirectoryEntry,
  teamB: TeamDirectoryEntry,
  season: string,
): Promise<MatchupGame[]> {
  const cacheKey = `${season}:${teamA.tricode}:${teamB.tricode}`;
  const cached = matchupGamesCache.get(cacheKey);
  if (cached) return cached;

  const log = await getCachedTeamGameLogForSeason(teamA, season);
  const byGameId = new Map<string, MatchupGame>();

  for (const entry of log) {
    const game = buildMatchupGame(entry, teamA, teamB);
    if (game) byGameId.set(game.gameId, game);
  }

  const games = [...byGameId.values()].sort((a, b) => {
    const dateCompare = a.gameDate.localeCompare(b.gameDate);
    return dateCompare !== 0 ? dateCompare : a.gameId.localeCompare(b.gameId);
  });

  matchupGamesCache.set(cacheKey, games);
  return games;
}

async function getCachedSeasonActionsBundle(
  cacheKey: string,
): Promise<SeasonActionsBundle | null> {
  const cached = playerSeasonActionsCache.get(cacheKey);
  if (cached) return cached;

  const persisted = await getPersistentValue<unknown>(
    "player-season-actions",
    cacheKey,
  );
  // Accept only the new bundle format; silently ignore legacy plain arrays
  // written by older versions of the server.
  if (
    persisted !== null &&
    typeof persisted === "object" &&
    !Array.isArray(persisted) &&
    Array.isArray((persisted as SeasonActionsBundle).actions) &&
    Array.isArray((persisted as SeasonActionsBundle).scannedGameIds)
  ) {
    const bundle = persisted as SeasonActionsBundle;
    playerSeasonActionsCache.set(cacheKey, bundle);
    return bundle;
  }

  return null;
}

async function setCachedSeasonActionsBundle(
  cacheKey: string,
  bundle: SeasonActionsBundle,
): Promise<void> {
  playerSeasonActionsCache.set(cacheKey, bundle);
  persistValueBestEffort("player-season-actions", cacheKey, bundle);
}

function getRequestIp(req: express.Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function logRouteError(
  route: string,
  error: unknown,
  meta: Record<string, unknown>,
) {
  logger.error(`${route}_failed`, {
    ...meta,
    ...serializeError(error),
  });
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "same-origin" },
    referrerPolicy: { policy: "no-referrer" },
  }),
);
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
app.use(express.json({ limit: "100kb" }));
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
  "/clips/matchup",
  createRateLimiter({
    name: "clips-matchup",
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

app.get("/health", async (_req, res) => {
  const videoCdnAvailable = await checkNbaVideoCdnHealth();
  res.json({
    ok: true,
    disabled: apiConfig.disabled,
    videoCdnAvailable,
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

    const todayUtc = new Date().toISOString().slice(0, 10);
    // Use the fast CDN scoreboard for today's date; the slower stats.nba.com
    // endpoint is only used for historical dates to reduce latency risk.
    const games =
      !date || date === todayUtc
        ? await getTodaysGames()
        : await getGamesByDate(date);

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
    });
  }
});

app.get("/matchups", async (req, res) => {
  try {
    const season =
      typeof req.query.season === "string" && req.query.season.trim() !== ""
        ? req.query.season.trim()
        : "2025-26";
    const teamA = getTeamByTricode(
      typeof req.query.teamA === "string" ? req.query.teamA : "",
    );
    const teamB = getTeamByTricode(
      typeof req.query.teamB === "string" ? req.query.teamB : "",
    );

    if (!teamA || !teamB) {
      return res.status(400).json({ error: "Valid teamA and teamB required" });
    }

    if (teamA.tricode === teamB.tricode) {
      return res.status(400).json({ error: "Teams must be different" });
    }

    const games = await getCachedMatchupGamesForSeason(teamA, teamB, season);

    res.json({
      season,
      teamA: teamLite(teamA),
      teamB: teamLite(teamB),
      count: games.length,
      games,
    });
  } catch (error: any) {
    logRouteError("matchups", error, {
      season: typeof req.query.season === "string" ? req.query.season : "",
      teamA: typeof req.query.teamA === "string" ? req.query.teamA : "",
      teamB: typeof req.query.teamB === "string" ? req.query.teamB : "",
    });
    res.status(500).json({
      error: "Failed to fetch matchup games",
    });
  }
});

app.get("/clips/test", async (_req, res) => {
  try {
    const gameId = "0022501115";
    const gameEventId = 7;
    const videoCdnAvailable = await checkNbaVideoCdnHealth();

    const asset = await getVideoEventAsset(gameId, gameEventId);
    const firstVideo = asset?.resultSets?.Meta?.videoUrls?.[0];

    res.json({
      gameId,
      gameEventId,
      success: Boolean(videoCdnAvailable && firstVideo?.murl),
      videoCdnAvailable,
      videoUrl: videoCdnAvailable ? (firstVideo?.murl ?? null) : null,
      thumbnailUrl: videoCdnAvailable ? (firstVideo?.mth ?? null) : null,
    });
  } catch (error: any) {
    logRouteError("clips_test", error, {});
    res.status(500).json({
      error: "Failed to fetch test clip",
    });
  }
});

app.get("/clips/game", async (req, res) => {
  try {
    const startedAt = Date.now();
    let assetUrlsResolved = 0;
    let assetUrlsUnresolved = 0;
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
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, 100)
        : 12;

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

    const area =
      typeof req.query.area === "string" ? req.query.area.trim() : "";
    const areaValues = area
      ? area
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
      : [];

    const descriptor =
      typeof req.query.descriptor === "string"
        ? req.query.descriptor.trim().toLowerCase()
        : "";
    const descriptorValues = descriptor
      ? descriptor
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean)
      : [];

    const qualifier =
      typeof req.query.qualifier === "string"
        ? req.query.qualifier.trim().toLowerCase()
        : "";
    const qualifierValues = qualifier
      ? qualifier
          .split(",")
          .map((q) => q.trim())
          .filter(Boolean)
      : [];

    // playerIds: explicit set of personIds to filter by (used by custom groups)
    const playerIdsParam =
      typeof req.query.playerIds === "string" ? req.query.playerIds.trim() : "";
    const playerIdValues = playerIdsParam
      ? new Set(
          playerIdsParam
            .split(",")
            .map((id) => Number(id.trim()))
            .filter((n) => Number.isFinite(n) && n > 0),
        )
      : null;

    // positionGroup: filter by player position (e.g. "G", "F", "C")
    const positionGroup =
      typeof req.query.positionGroup === "string"
        ? req.query.positionGroup.trim().toUpperCase()
        : "";

    // Season used for positionGroup resolution and cache keying
    const season =
      typeof req.query.season === "string" && req.query.season.trim() !== ""
        ? req.query.season.trim()
        : "2025-26";

    // Resolve positionGroup → set of personIds
    let positionPlayerIds: Set<number> | null = null;
    if (positionGroup) {
      const directory = await getCachedPlayerDirectory(season);
      positionPlayerIds = new Set(
        directory
          .filter((p) => {
            // Inclusive match: "C" matches "C", "F-C", "C-F"
            const parts = (p.position ?? "").split("-").map((s) => s.trim());
            return parts.includes(positionGroup);
          })
          .map((p) => p.personId),
      );
    }

    // Merge playerIds and positionPlayerIds into a single filter set.
    // When both are present, we union them (OR semantics) — this allows
    // combining a position filter with explicit player IDs. In practice,
    // the frontend only sends one at a time (positionGroup for trait groups,
    // playerIds for custom groups), so the union is a safe default.
    const personIdFilter =
      playerIdValues || positionPlayerIds
        ? new Set([...(playerIdValues ?? []), ...(positionPlayerIds ?? [])])
        : null;

    const actionNumberParam =
      typeof req.query.actionNumber === "string"
        ? Number(req.query.actionNumber)
        : NaN;
    const targetActionNumber =
      Number.isFinite(actionNumberParam) && actionNumberParam > 0
        ? actionNumberParam
        : null;

    const cacheKey = `${gameId}:${player}:${team}:${result}:${playType}:${quarterParam}:${shotValue}:${subType}:${distanceBucket}:${area}:${descriptor}:${qualifier}:${playerIdsParam}:${positionGroup}:${season}:${limit}:${offset}`;
    const videoCdnAvailable = await checkNbaVideoCdnHealth();
    // Bypass response cache when an actionNumber lookup is requested,
    // since targetIndex is not part of the cached payload.
    // Also bypass while the NBA video CDN is serving placeholders; cached
    // payloads can contain otherwise valid URLs that currently resolve to the
    // placeholder MP4.
    if (!targetActionNumber && videoCdnAvailable) {
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
      // personId-based group filter (playerIds / positionGroup)
      const matchesPersonIdFilter =
        !personIdFilter || personIdFilter.has(shot.personId ?? 0);
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
      const matchesArea =
        areaValues.length === 0 ||
        !isShot ||
        areaValues.includes(shot.area ?? "");
      const matchesDescriptor =
        descriptorValues.length === 0 ||
        !isShot ||
        descriptorValues.some((d) => (shot.descriptor ?? "").includes(d));
      const matchesQualifier =
        qualifierValues.length === 0 ||
        !isShot ||
        qualifierValues.some((q) => (shot.qualifiers ?? []).includes(q));
      return (
        matchesTeam &&
        matchesPersonIdFilter &&
        matchesResult &&
        matchesQuarter &&
        matchesShotValue &&
        matchesSubType &&
        matchesDistance &&
        matchesArea &&
        matchesDescriptor &&
        matchesQualifier
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

    const clips = await mapWithConcurrency(shots, 3, async (shot) => {
      if (!shot.actionNumber) {
        return {
          ...shot,
          videoUrl: null,
          thumbnailUrl: null,
        };
      }

      const videoEventId =
        (shot as { videoActionNumber?: number }).videoActionNumber ??
        shot.actionNumber;
      const cachedAsset = videoCdnAvailable
        ? await getCachedVideoAsset(gameId, videoEventId)
        : emptyVideoAsset;
      if (cachedAsset.videoUrl || cachedAsset.thumbnailUrl) {
        assetUrlsResolved += 1;
        return {
          ...shot,
          videoUrl: cachedAsset.videoUrl,
          thumbnailUrl: cachedAsset.thumbnailUrl,
        };
      }

      assetUrlsUnresolved += 1;
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
      videoCdnAvailable,
      clips,
      ...(targetIndex !== undefined ? { targetIndex } : {}),
    };

    // Only cache when no actionNumber lookup and all video assets resolved —
    // don't lock in a response with missing clips that could be retried.
    if (!targetActionNumber && videoCdnAvailable && assetUrlsUnresolved === 0) {
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
      assetUrlsResolved,
      assetUrlsUnresolved,
      videoCdnAvailable,
      time: msSince(startedAt),
    });
    res.json(payload);
  } catch (error: any) {
    logRouteError("clips_game", error, {
      gameId: typeof req.query.gameId === "string" ? req.query.gameId : "",
    });
    res.status(500).json({
      error: "Failed to fetch game clips",
    });
  }
});

app.get("/clips/matchup", async (req, res) => {
  try {
    const startedAt = Date.now();
    let assetUrlsResolved = 0;
    let assetUrlsUnresolved = 0;

    const season =
      typeof req.query.season === "string" && req.query.season.trim() !== ""
        ? req.query.season.trim()
        : "2025-26";
    const teamA = getTeamByTricode(
      typeof req.query.teamA === "string" ? req.query.teamA : "",
    );
    const teamB = getTeamByTricode(
      typeof req.query.teamB === "string" ? req.query.teamB : "",
    );

    if (!teamA || !teamB) {
      return res.status(400).json({ error: "Valid teamA and teamB required" });
    }

    if (teamA.tricode === teamB.tricode) {
      return res.status(400).json({ error: "Teams must be different" });
    }

    const team =
      typeof req.query.team === "string"
        ? req.query.team.trim().toUpperCase()
        : "";
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
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, 100)
        : 12;

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

    const area =
      typeof req.query.area === "string" ? req.query.area.trim() : "";
    const areaValues = area
      ? area
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
      : [];

    const descriptor =
      typeof req.query.descriptor === "string"
        ? req.query.descriptor.trim().toLowerCase()
        : "";
    const descriptorValues = descriptor
      ? descriptor
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean)
      : [];

    const qualifier =
      typeof req.query.qualifier === "string"
        ? req.query.qualifier.trim().toLowerCase()
        : "";
    const qualifierValues = qualifier
      ? qualifier
          .split(",")
          .map((q) => q.trim())
          .filter(Boolean)
      : [];

    const excludeGameIdsParam =
      typeof req.query.excludeGameIds === "string"
        ? req.query.excludeGameIds.trim()
        : "";
    const excludeGameIds = new Set(
      excludeGameIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    );

    const actionNumberParam =
      typeof req.query.actionNumber === "string"
        ? Number(req.query.actionNumber)
        : NaN;
    const targetActionNumber =
      Number.isFinite(actionNumberParam) && actionNumberParam > 0
        ? actionNumberParam
        : null;

    const normalizedExcludeKey = [...excludeGameIds].sort().join(",");
    const cacheKey = `${season}:${teamA.tricode}:${teamB.tricode}:${normalizedExcludeKey}:${team}:${result}:${playType}:${quarterParam}:${shotValue}:${subType}:${distanceBucket}:${area}:${descriptor}:${qualifier}:${limit}:${offset}`;
    const videoCdnAvailable = await checkNbaVideoCdnHealth();
    if (!targetActionNumber && videoCdnAvailable) {
      const cached = matchupClipCache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    const matchupGames = await getCachedMatchupGamesForSeason(
      teamA,
      teamB,
      season,
    );
    const includedGames = matchupGames.filter(
      (game) => !excludeGameIds.has(game.gameId),
    );

    const gameActionGroups = await mapWithConcurrency(
      includedGames,
      3,
      async (game) => {
        try {
          const [actions, playerNameMap] = await Promise.all([
            getCachedPlayByPlay(game.gameId),
            getCachedPlayerNameMap(game.gameId),
          ]);

          return getFilteredActions(game.gameId, actions, playType).map(
            (action) => ({
              ...action,
              gameDate: game.gameDate,
              matchup: game.matchup,
              playerName:
                (action.personId
                  ? playerNameMap.get(action.personId)
                  : undefined) ?? action.playerName,
            }),
          );
        } catch (error) {
          logger.warn("clips_matchup_game_fetch_failed", {
            gameId: game.gameId,
            matchup: game.matchup,
            ...serializeError(error),
          });
          return [] as PlayerActionWithGame[];
        }
      },
    );

    const allActions: PlayerActionWithGame[] = gameActionGroups.flat();
    const filteredActions = allActions.filter((action) => {
      const matchesTeam =
        teamValues.length === 0 ||
        teamValues.includes(action.teamTricode ?? "");
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
      const matchesArea =
        areaValues.length === 0 ||
        !isShot ||
        areaValues.includes(action.area ?? "");
      const matchesDescriptor =
        descriptorValues.length === 0 ||
        !isShot ||
        descriptorValues.some((d) => (action.descriptor ?? "").includes(d));
      const matchesQualifier =
        qualifierValues.length === 0 ||
        !isShot ||
        qualifierValues.some((q) => (action.qualifiers ?? []).includes(q));

      return (
        matchesTeam &&
        matchesResult &&
        matchesQuarter &&
        matchesShotValue &&
        matchesSubType &&
        matchesDistance &&
        matchesArea &&
        matchesDescriptor &&
        matchesQualifier
      );
    });

    const pageActions = filteredActions.slice(offset, offset + limit);
    const clips = await mapWithConcurrency(pageActions, 3, async (action) => {
      if (!action.actionNumber) {
        return {
          ...action,
          videoUrl: null,
          thumbnailUrl: null,
        };
      }

      const videoEventId =
        (action as { videoActionNumber?: number }).videoActionNumber ??
        action.actionNumber;
      const cachedAsset = videoCdnAvailable
        ? await getCachedVideoAsset(action.gameId, videoEventId)
        : emptyVideoAsset;

      if (cachedAsset.videoUrl || cachedAsset.thumbnailUrl) {
        assetUrlsResolved += 1;
        return {
          ...action,
          videoUrl: cachedAsset.videoUrl,
          thumbnailUrl: cachedAsset.thumbnailUrl,
        };
      }

      assetUrlsUnresolved += 1;
      return {
        ...action,
        ...cachedAsset,
      };
    });

    const hasMore = offset + clips.length < filteredActions.length;
    const nextOffset = hasMore ? offset + clips.length : null;

    let targetIndex: number | null | undefined;
    if (targetActionNumber !== null) {
      const idx = filteredActions.findIndex(
        (action) => action.actionNumber === targetActionNumber,
      );
      targetIndex = idx >= 0 ? idx : null;
    }

    const payload = {
      season,
      teamA: teamLite(teamA),
      teamB: teamLite(teamB),
      count: clips.length,
      total: filteredActions.length,
      offset,
      limit,
      hasMore,
      nextOffset,
      gamesIncluded: includedGames.length,
      gamesExcluded: excludeGameIds.size,
      games: includedGames,
      videoCdnAvailable,
      clips,
      ...(targetIndex !== undefined ? { targetIndex } : {}),
    };

    if (!targetActionNumber && videoCdnAvailable && assetUrlsUnresolved === 0) {
      matchupClipCache.set(cacheKey, payload);
    }

    logger.info("clips_matchup_ready", {
      season,
      teamA: teamA.tricode,
      teamB: teamB.tricode,
      playType,
      quarter: quarterParam || "all",
      team: team || "all",
      result,
      offset,
      clipCount: clips.length,
      totalCount: filteredActions.length,
      gamesIncluded: includedGames.length,
      gamesExcluded: excludeGameIds.size,
      hasMore,
      nextOffset,
      assetUrlsResolved,
      assetUrlsUnresolved,
      videoCdnAvailable,
      time: msSince(startedAt),
    });

    res.json(payload);
  } catch (error: any) {
    logRouteError("clips_matchup", error, {
      season: typeof req.query.season === "string" ? req.query.season : "",
      teamA: typeof req.query.teamA === "string" ? req.query.teamA : "",
      teamB: typeof req.query.teamB === "string" ? req.query.teamB : "",
    });
    res.status(500).json({
      error: "Failed to fetch matchup clips",
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
        position: p.position,
      })),
    });
  } catch (error: any) {
    logRouteError("players", error, {
      season:
        typeof req.query.season === "string"
          ? req.query.season.trim()
          : "2025-26",
    });
    res.status(500).json({
      error: "Failed to fetch players",
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

    const area =
      typeof req.query.area === "string" ? req.query.area.trim() : "";
    const areaValues = area
      ? area
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
      : [];

    const descriptor =
      typeof req.query.descriptor === "string"
        ? req.query.descriptor.trim().toLowerCase()
        : "";
    const descriptorValues = descriptor
      ? descriptor
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean)
      : [];

    const qualifier =
      typeof req.query.qualifier === "string"
        ? req.query.qualifier.trim().toLowerCase()
        : "";
    const qualifierValues = qualifier
      ? qualifier
          .split(",")
          .map((q) => q.trim())
          .filter(Boolean)
      : [];

    const opponent =
      typeof req.query.opponent === "string"
        ? req.query.opponent.trim().toUpperCase()
        : "";

    const limitParam =
      typeof req.query.limit === "string" ? Number(req.query.limit) : 12;
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, 100)
        : 12;

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
    const cacheKey = `${personId}:${season}:${playType}:${result}:${quarterParam}:${shotValue}:${subType}:${distanceBucket}:${area}:${descriptor}:${qualifier}:${opponent}:${limit}:${offset}:${[...excludeDates].sort().join(",")}:${[...excludeGameIds].sort().join(",")}`;
    const videoCdnAvailable = await checkNbaVideoCdnHealth();
    if (!targetActionNumber && videoCdnAvailable) {
      const cached = playerClipCache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    // 1. Get the player's game log
    const gameLog = await getCachedPlayerGameLogForSeason(personId, season);

    // 2. Get or build season-level actions cache (incremental — one batch per
    //    request).  Keyed by personId:season:playType so result/quarter/
    //    exclusion/page changes all share the same scanned data.
    const seasonCacheKey = `${personId}:${season}:${playType}`;
    let bundle = await getCachedSeasonActionsBundle(seasonCacheKey);
    const seasonCacheHit = bundle !== null;

    // Determine which games haven't been scanned yet.
    const scannedSet = new Set(bundle?.scannedGameIds ?? []);
    const unscannedGames = gameLog.filter((g) => !scannedSet.has(g.gameId));

    // Scan the next batch of unscanned games (SEASON_SCAN_BATCH_SIZE at most).
    // Processing the full game log in one shot can send 60–80 simultaneous
    // requests to cdn.nba.com and trigger rate-limiting or request timeouts.
    // Instead we scan incrementally: each request extends coverage by one batch
    // until every game in the log has been processed.
    if (unscannedGames.length > 0) {
      const batchToScan = unscannedGames.slice(0, SEASON_SCAN_BATCH_SIZE);
      const newActions: PlayerActionWithGame[] = [];

      await mapWithConcurrency(batchToScan, 5, async (game) => {
        // Mark as scanned regardless of outcome so a persistently failing game
        // (e.g. cdn.nba.com 404 for historical liveData paths) is not retried
        // on every subsequent request.
        scannedSet.add(game.gameId);
        try {
          const gameDateNorm = normalizeDate(game.gameDate);

          const [actions, playerNameMap] = await Promise.all([
            getCachedPlayByPlay(game.gameId),
            getCachedPlayerNameMap(game.gameId),
          ]);

          const filtered = getFilteredActions(game.gameId, actions, playType);

          const targetPlayerName = playerNameMap.get(personId);
          const playerActions = filtered
            .map((action) => ({
              ...action,
              playerName:
                (action.personId
                  ? playerNameMap.get(action.personId)
                  : undefined) ?? action.playerName,
            }))
            .filter(
              (action) =>
                action.personId === personId ||
                (!action.personId &&
                  targetPlayerName &&
                  action.playerName === targetPlayerName),
            )
            .map((action) => ({
              ...action,
              gameDate: gameDateNorm,
              matchup: game.matchup,
            }));

          newActions.push(...playerActions);
        } catch (err) {
          logger.warn("clips_player_game_fetch_failed", {
            gameId: game.gameId,
            personId,
            season,
            errorMessage: err instanceof Error ? err.message : "unknown",
          });
        }
      });

      const mergedActions = [...(bundle?.actions ?? []), ...newActions];
      mergedActions.sort((a, b) => {
        const dateCompare = (b.gameDate ?? "").localeCompare(a.gameDate ?? "");
        if (dateCompare !== 0) return dateCompare;
        const periodCompare = (a.period ?? 0) - (b.period ?? 0);
        if (periodCompare !== 0) return periodCompare;
        return (b.clock ?? "").localeCompare(a.clock ?? "");
      });

      bundle = { actions: mergedActions, scannedGameIds: [...scannedSet] };
      await setCachedSeasonActionsBundle(seasonCacheKey, bundle);
    }

    const seasonActions = bundle?.actions ?? [];
    const seasonFullyScanned = scannedSet.size >= gameLog.length;

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
      const matchesArea =
        areaValues.length === 0 ||
        !isShot ||
        areaValues.includes(action.area ?? "");
      const matchesDescriptor =
        descriptorValues.length === 0 ||
        !isShot ||
        descriptorValues.some((d) => (action.descriptor ?? "").includes(d));
      const matchesQualifier =
        qualifierValues.length === 0 ||
        !isShot ||
        qualifierValues.some((q) => (action.qualifiers ?? []).includes(q));
      return (
        matchesResult &&
        matchesQuarter &&
        matchesShotValue &&
        matchesSubType &&
        matchesDistance &&
        matchesArea &&
        matchesDescriptor &&
        matchesQualifier
      );
    });

    const total = filteredActions.length;

    // 4. Paginate
    const pageActions = filteredActions.slice(offset, offset + limit);

    // 6. Resolve video URLs for the page
    let assetUrlsResolved = 0;
    let assetUrlsUnresolved = 0;

    const clips = await mapWithConcurrency(pageActions, 3, async (action) => {
      if (!action.actionNumber) {
        return { ...action, videoUrl: null, thumbnailUrl: null };
      }

      const videoEventId = action.videoActionNumber ?? action.actionNumber;
      const cachedAsset = videoCdnAvailable
        ? await getCachedVideoAsset(action.gameId, videoEventId)
        : emptyVideoAsset;
      if (cachedAsset.videoUrl || cachedAsset.thumbnailUrl) {
        assetUrlsResolved += 1;
        return { ...action, ...cachedAsset };
      }

      assetUrlsUnresolved += 1;
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
      seasonFullyScanned,
      videoCdnAvailable,
      clips,
      ...(targetIndex !== undefined ? { targetIndex } : {}),
    };

    // Only cache when no actionNumber lookup, all video assets resolved, and
    // the full season has been scanned — don't lock in a partial response that
    // would prevent future requests from extending the scan window.
    if (
      !targetActionNumber &&
      videoCdnAvailable &&
      assetUrlsUnresolved === 0 &&
      seasonFullyScanned
    ) {
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
      gamesScanned: scannedSet.size,
      seasonFullyScanned,
      offset,
      clipCount: clips.length,
      totalCount: total,
      hasMore,
      assetUrlsResolved,
      assetUrlsUnresolved,
      videoCdnAvailable,
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
