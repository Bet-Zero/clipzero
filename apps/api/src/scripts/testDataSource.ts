import { getVideoEventAsset, selectVideoFromEventAsset } from "../lib/nba";

async function main() {
  const gameId = "0022501115";
  const gameEventId = 7;

  const asset = await getVideoEventAsset(gameId, gameEventId);
  const selected = selectVideoFromEventAsset(asset);

  console.log({
    success: Boolean(selected?.murl),
    videoUrl: selected?.murl ?? null,
    thumbnailUrl: selected?.mth ?? null,
  });
}

main().catch((error) => {
  console.error("request failed");
  console.error(error?.response?.status ?? error.message);
  process.exit(1);
});
