import { getVideoEventAsset } from "../lib/nba";

async function main() {
  const gameId = "0022501115";
  const gameEventId = 7;

  const asset = await getVideoEventAsset(gameId, gameEventId);
  const firstVideo = asset?.resultSets?.Meta?.videoUrls?.[0];

  console.log({
    success: Boolean(firstVideo?.murl),
    videoUrl: firstVideo?.murl ?? null,
    thumbnailUrl: firstVideo?.mth ?? null,
  });
}

main().catch((error) => {
  console.error("request failed");
  console.error(error?.response?.status ?? error.message);
  process.exit(1);
});
