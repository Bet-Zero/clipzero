import cors from "cors";
import express from "express";
import { getCachedGames, setCachedGames } from "./lib/gamesCache";
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

const app = express();
const port = 4000;
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

async function getCachedPlayByPlay(gameId: string): Promise<RawAction[]> {
  const cached = playByPlayCache.get(gameId);
  if (cached) return cached;
  const actions = await getPlayByPlay(gameId);
  playByPlayCache.set(gameId, actions);
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
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );

  return results;
}

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
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

    const team =
      typeof req.query.team === "string" ? req.query.team.trim() : "";

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
        : "shots";

    const quarterParam =
      typeof req.query.quarter === "string" ? Number(req.query.quarter) : 0;

    const quarter =
      Number.isFinite(quarterParam) && quarterParam > 0 ? quarterParam : 0;

    const actionNumberParam =
      typeof req.query.actionNumber === "string"
        ? Number(req.query.actionNumber)
        : NaN;
    const targetActionNumber =
      Number.isFinite(actionNumberParam) && actionNumberParam > 0
        ? actionNumberParam
        : null;

    const cacheKey = `${gameId}:${player}:${team}:${result}:${playType}:${quarter}:${limit}:${offset}`;
    // Bypass response cache when an actionNumber lookup is requested,
    // since targetIndex is not part of the cached payload.
    if (!targetActionNumber) {
      const cached = clipCache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    const actions = await getPlayByPlay(gameId);
    const allShots = getFilteredActions(gameId, actions, playType);

    const playerNameMap = await getPlayerNameMapForGame(gameId);

    const normalizedShots = allShots.map((shot) => ({
      ...shot,
      playerName:
        (shot.personId ? playerNameMap.get(shot.personId) : undefined) ??
        shot.playerName,
    }));

    const playerOptionPool = normalizedShots.filter((shot) => {
      const matchesTeam = !team || shot.teamTricode === team;
      // result filter is only meaningful for shots; ignore it for other play types
      const matchesResult =
        playType !== "shots" || result === "all" || shot.shotResult === result;
      const matchesQuarter = !quarter || shot.period === quarter;
      return matchesTeam && matchesResult && matchesQuarter;
    });

    const players = Array.from(
      new Set(playerOptionPool.map((shot) => shot.playerName).filter(Boolean)),
    ).map((name) => ({ name }));

    const filteredShots = playerOptionPool.filter((shot) => {
      const matchesPlayer = !player || shot.playerName === player;
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

      const assetCacheKey = `${gameId}:${shot.actionNumber}`;
      const cachedAsset = videoAssetCache.get(assetCacheKey);

      if (cachedAsset) {
        assetCacheHits += 1;
        return {
          ...shot,
          videoUrl: cachedAsset.videoUrl,
          thumbnailUrl: cachedAsset.thumbnailUrl,
        };
      }

      try {
        assetCacheMisses += 1;
        const asset = await getVideoEventAsset(gameId, shot.actionNumber);
        const firstVideo = asset?.resultSets?.Meta?.videoUrls?.[0];

        const cachedValue = {
          videoUrl: firstVideo?.murl ?? null,
          thumbnailUrl: firstVideo?.mth ?? null,
        };

        videoAssetCache.set(assetCacheKey, cachedValue);

        return {
          ...shot,
          ...cachedValue,
        };
      } catch {
        const cachedValue = {
          videoUrl: null,
          thumbnailUrl: null,
        };

        videoAssetCache.set(assetCacheKey, cachedValue);

        return {
          ...shot,
          ...cachedValue,
        };
      }
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

    console.log(
      `[clips] game=${gameId} playType=${playType} quarter=${quarter || "all"} team=${team || "all"} player=${player || "all"} result=${result} offset=${offset} count=${clips.length}/${filteredShots.length} hasMore=${hasMore} nextOffset=${nextOffset} assetHits=${assetCacheHits} assetMisses=${assetCacheMisses} time=${msSince(startedAt)}`,
    );
    res.json(payload);
  } catch (error: any) {
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

    let directory = playerDirectoryCache.get(season);
    if (!directory) {
      directory = await getAllPlayers(season);
      playerDirectoryCache.set(season, directory);
    }

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

    const cacheKey = `${personId}:${season}`;
    let gameLog = playerGameLogCache.get(cacheKey);
    if (!gameLog) {
      gameLog = await getPlayerGameLog(personId, season);
      playerGameLogCache.set(cacheKey, gameLog);
    }

    res.json({
      personId,
      season,
      count: gameLog.length,
      games: gameLog,
    });
  } catch (error: any) {
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
        : "shots";

    const result =
      typeof req.query.result === "string" && req.query.result.trim() !== ""
        ? req.query.result.trim()
        : "all";

    const quarterParam =
      typeof req.query.quarter === "string" ? Number(req.query.quarter) : 0;
    const quarter =
      Number.isFinite(quarterParam) && quarterParam > 0 ? quarterParam : 0;

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
    const cacheKey = `${personId}:${season}:${playType}:${result}:${quarter}:${limit}:${offset}:${[...excludeDates].sort().join(",")}:${[...excludeGameIds].sort().join(",")}`;
    if (!targetActionNumber) {
      const cached = playerClipCache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    // 1. Get the player's game log
    const gameLogCacheKey = `${personId}:${season}`;
    let gameLog = playerGameLogCache.get(gameLogCacheKey);
    if (!gameLog) {
      gameLog = await getPlayerGameLog(personId, season);
      playerGameLogCache.set(gameLogCacheKey, gameLog);
    }

    // 2. Get or build season-level actions cache
    //    Keyed by personId:season:playType — reused across result/quarter/exclusion/page changes
    const seasonCacheKey = `${personId}:${season}:${playType}`;
    const seasonCacheHit = playerSeasonActionsCache.has(seasonCacheKey);
    let seasonActions = playerSeasonActionsCache.get(seasonCacheKey);

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
          console.warn(
            `[clips/player] Failed to fetch game ${game.gameId}: ${err instanceof Error ? err.message : "unknown"}`,
          );
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
      playerSeasonActionsCache.set(seasonCacheKey, seasonActions);
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
      // result filter is only meaningful for shots; ignore it for other play types
      const matchesResult =
        playType !== "shots" || result === "all" || action.shotResult === result;
      const matchesQuarter = !quarter || action.period === quarter;
      return matchesResult && matchesQuarter;
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

      const assetCacheKey = `${action.gameId}:${action.actionNumber}`;
      const cachedAsset = videoAssetCache.get(assetCacheKey);
      if (cachedAsset) {
        assetCacheHits += 1;
        return { ...action, ...cachedAsset };
      }

      try {
        assetCacheMisses += 1;
        const asset = await getVideoEventAsset(
          action.gameId,
          action.actionNumber,
        );
        const firstVideo = asset?.resultSets?.Meta?.videoUrls?.[0];
        const cachedValue = {
          videoUrl: firstVideo?.murl ?? null,
          thumbnailUrl: firstVideo?.mth ?? null,
        };
        videoAssetCache.set(assetCacheKey, cachedValue);
        return { ...action, ...cachedValue };
      } catch {
        const cachedValue = { videoUrl: null, thumbnailUrl: null };
        videoAssetCache.set(assetCacheKey, cachedValue);
        return { ...action, ...cachedValue };
      }
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
      quarter: quarter || "all",
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

    console.log(
      `[clips/player] personId=${personId} season=${season} playType=${playType} result=${result} quarter=${quarter || "all"} games=${gameLog.length - excludedGames.length}/${gameLog.length} offset=${offset} count=${clips.length}/${total} hasMore=${hasMore} assetHits=${assetCacheHits} assetMisses=${assetCacheMisses} seasonCache=${seasonCacheHit ? "hit" : "miss"} time=${msSince(startedAt)}`,
    );

    res.json(payload);
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to fetch player clips",
      details: error?.response?.status ?? error?.message ?? "unknown error",
    });
  }
});

app.listen(port, () => {
  console.log(`ClipZero API running on http://localhost:${port}`);
});
