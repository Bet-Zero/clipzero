import axios from "axios";

const H = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
  Accept: "application/json",
};

async function main() {
  // Test 1: videodetailsasset endpoint (what nba.com stats page uses)
  try {
    console.log("=== Trying videodetailsasset ===");
    const r = await axios.get("https://stats.nba.com/stats/videodetailsasset", {
      headers: H,
      params: {
        LeagueID: "00",
        Season: "2025-26",
        SeasonType: "Playoffs",
        GameID: "0052500131",
        ContextMeasure: "FGA",
        PlayerID: 0,
        TeamID: 0,
        StartPeriod: 0,
        EndPeriod: 0,
        StartRange: 0,
        EndRange: 28800,
        RangeType: 0,
      },
      timeout: 60000,
    });
    const str = JSON.stringify(r.data);
    const urls = str.match(/https?:\/\/[^"]+\.(mp4|m3u8)/g) || [];
    console.log("Found video URLs:", urls.slice(0, 3));
    console.log(
      "Response structure:",
      JSON.stringify(r.data, null, 2).slice(0, 2000),
    );
  } catch (e) {
    console.log("videodetailsasset failed:", e.response?.status || e.message);
  }

  // Test 2: Check what CDN domain real videos use now
  try {
    console.log("\n=== Checking CDN domains ===");
    // Try the direct-path CDN that some newer NBA tools use
    const testUrl =
      "https://videos.nba.com/nba/pbp/media/2026/04/15/0052500131/7/ca4454f8-95aa-c64c-ec48-524ad4617825_960x540.mp4";
    const head = await axios.head(testUrl, { timeout: 10000 });
    console.log("videos.nba.com ETag:", head.headers.etag);
    console.log(
      "videos.nba.com Content-Length:",
      head.headers["content-length"],
    );
  } catch (e) {
    console.log("CDN check failed:", e.message);
  }

  // Test 3: Try videoeventsasset and look at all URL fields
  try {
    console.log("\n=== videoeventsasset full response ===");
    const r = await axios.get("https://stats.nba.com/stats/videoeventsasset", {
      headers: H,
      params: { GameID: "0052500131", GameEventID: 7 },
      timeout: 60000,
    });
    console.log(JSON.stringify(r.data, null, 2));
  } catch (e) {
    console.log("videoeventsasset failed:", e.response?.status || e.message);
  }
}

main().catch(console.error);
