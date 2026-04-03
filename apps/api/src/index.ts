import cors from "cors";
import express from "express";
import {
  getPlayByPlay,
  getShotActions,
  getTodaysGames,
  getVideoEventAsset,
} from "./lib/nba";

const app = express();
const port = 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/games", async (_req, res) => {
  try {
    const games = await getTodaysGames();

    res.json({
      count: games.length,
      games: games.map((game) => ({
        gameId: game.gameId,
        gameCode: game.gameCode,
        gameStatusText: game.gameStatusText,
        matchup: `${game.awayTeam.teamTricode} @ ${game.homeTeam.teamTricode}`,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
      })),
    });
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
    const gameId =
      typeof req.query.gameId === "string" && req.query.gameId.trim() !== ""
        ? req.query.gameId
        : "0022501115";

    const actions = await getPlayByPlay(gameId);
    const limitParam =
      typeof req.query.limit === "string" ? Number(req.query.limit) : 12;

    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 12;

    const allShots = getShotActions(gameId, actions);
    const shots = allShots.slice(0, limit);

    const clips = await Promise.all(
      shots.map(async (shot) => {
        if (!shot.actionNumber) {
          return {
            ...shot,
            videoUrl: null,
            thumbnailUrl: null,
          };
        }

        try {
          const asset = await getVideoEventAsset(gameId, shot.actionNumber);
          const firstVideo = asset?.resultSets?.Meta?.videoUrls?.[0];

          return {
            ...shot,
            videoUrl: firstVideo?.murl ?? null,
            thumbnailUrl: firstVideo?.mth ?? null,
          };
        } catch {
          return {
            ...shot,
            videoUrl: null,
            thumbnailUrl: null,
          };
        }
      }),
    );

    res.json({
      gameId,
      count: clips.length,
      total: allShots.length,
      clips,
    });
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
