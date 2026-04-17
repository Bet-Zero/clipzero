const axios = require("axios");

async function main() {
  const realUrl = "https://videos.nba.com/nba/pbp/media/2026/04/15/0052500131/7/ca4454f8-95aa-c64c-ec48-524ad4617825_960x540.mp4";
  const fakeUrl = "https://videos.nba.com/nba/pbp/media/2026/04/15/0052500131/7/totally-fake-nonexistent-uuid_960x540.mp4";

  // Test 1: Real URL headers
  let r = await axios.head(realUrl, { timeout: 10000 });
  console.log("Real URL  - ETag:", r.headers.etag, "Size:", r.headers["content-length"]);

  // Test 2: With NBA Referer
  r = await axios.head(realUrl, {
    timeout: 10000,
    headers: { Referer: "https://www.nba.com/", Origin: "https://www.nba.com" },
  });
  console.log("NBA hdrs  - ETag:", r.headers.etag, "Size:", r.headers["content-length"]);

  // Test 3: Completely fake/nonexistent URL
  try {
    r = await axios.head(fakeUrl, { timeout: 10000 });
    console.log("Fake URL  - Status:", r.status, "ETag:", r.headers.etag, "Size:", r.headers["content-length"]);
  } catch (e) {
    console.log("Fake URL  - Status:", e.response?.status || e.message);
  }

  // Test 4: Download first 512 bytes of the real URL
  r = await axios.get(realUrl, {
    timeout: 10000,
    headers: { Range: "bytes=0-511" },
    responseType: "arraybuffer",
  });
  const buf = Buffer.from(r.data);
  const ftypIdx = buf.indexOf("ftyp");
  console.log("File starts with ftyp at offset:", ftypIdx);
  console.log("First 40 bytes (hex):", buf.subarray(0, 40).toString("hex"));

  // Test 5: Check if an older season URL (2024-25) also returns placeholder
  const oldSeasonUrl = "https://videos.nba.com/nba/pbp/media/2024/12/25/0022400428/7/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee_960x540.mp4";
  try {
    r = await axios.head(oldSeasonUrl, { timeout: 10000 });
    console.log("Old season fake - Status:", r.status, "ETag:", r.headers.etag, "Size:", r.headers["content-length"]);
  } catch (e) {
    console.log("Old season fake - Status:", e.response?.status || e.message);
  }
}

main().catch(console.error);
