import cors from "cors";
import express from "express";
import { getPlayByPlay, getShotActions, getVideoEventAsset } from "./lib/nba";

const app = express();
const port = 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
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

app.get("/clips/game", async (_req, res) => {
  try {
    const gameId = "0022501115";

    const actions = await getPlayByPlay(gameId);
    const shots = getShotActions(gameId, actions).slice(0, 5);

    const clips = [];

    for (const shot of shots) {
      if (!shot.actionNumber) continue;

      try {
        const asset = await getVideoEventAsset(gameId, shot.actionNumber);
        const firstVideo = asset?.resultSets?.Meta?.videoUrls?.[0];

        clips.push({
          ...shot,
          videoUrl: firstVideo?.murl ?? null,
          thumbnailUrl: firstVideo?.mth ?? null,
        });
      } catch {
        clips.push({
          ...shot,
          videoUrl: null,
          thumbnailUrl: null,
        });
      }
    }

    res.json({
      gameId,
      count: clips.length,
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
