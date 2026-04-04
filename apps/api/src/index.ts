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
} from "./lib/nba";

const app = express();
const port = 4000;
const clipCache = new Map<string, unknown>();
const gamesCache = new Map<string, unknown>();
const videoAssetCache = new Map<
  string,
  { videoUrl: string | null; thumbnailUrl: string | null }
>();

function msSince(start: number) {
  return `${Date.now() - start}ms`;
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

    const cacheKey = `${gameId}:${player}:${team}:${result}:${playType}:${quarter}:${limit}:${offset}`;
    const cached = clipCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
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
      const matchesResult = result === "all" || shot.shotResult === result;
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
    };

    clipCache.set(cacheKey, payload);

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

app.listen(port, () => {
  console.log(`ClipZero API running on http://localhost:${port}`);
});
