import http from "node:http";
import { URL } from "node:url";

const port = Number(process.env.MOCK_API_PORT || 4100);

const games = [
  {
    gameId: "game-lal-bos",
    gameCode: "20260115/LALBOS",
    gameStatusText: "Final",
    matchup: "LAL @ BOS",
    homeTeam: { teamTricode: "BOS" },
    awayTeam: { teamTricode: "LAL" },
  },
  {
    gameId: "game-nyk-mia",
    gameCode: "20260115/NYKMIA",
    gameStatusText: "Final",
    matchup: "NYK @ MIA",
    homeTeam: { teamTricode: "MIA" },
    awayTeam: { teamTricode: "NYK" },
  },
];

const gameModePlayers = [
  { name: "Anthony Davis", teamTricode: "LAL" },
  { name: "LeBron James", teamTricode: "LAL" },
  { name: "Zach LaVine", teamTricode: "CHI" },
];

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
  });
  res.end(JSON.stringify(body));
}

function buildGameClip(searchParams) {
  const gameId = searchParams.get("gameId") || games[0].gameId;
  const playType = searchParams.get("playType") || "all";
  const result = searchParams.get("result") || "all";
  const shotValue = searchParams.get("shotValue") || "";
  const subType = searchParams.get("subType") || "";

  if (playType === "turnovers") {
    return {
      gameId,
      actionNumber: 301,
      period: 3,
      clock: "PT06M12.00S",
      teamTricode: "LAL",
      playerName: "LeBron James",
      actionType: "turnover",
      subType: subType || "bad-pass",
      description: "LeBron James bad pass turnover",
      scoreHome: "61",
      scoreAway: "58",
      videoUrl: null,
      thumbnailUrl: null,
    };
  }

  return {
    gameId,
    actionNumber: 101,
    period: 1,
    clock: "PT10M00.00S",
    teamTricode: "LAL",
    playerName: "Anthony Davis",
    actionType: shotValue === "3pt" ? "3PT" : "2PT",
    subType: subType || "layup",
    shotResult: result === "all" ? "Made" : result,
    shotDistance: shotValue === "3pt" ? 24 : 4,
    description:
      shotValue === "3pt"
        ? "Anthony Davis makes 3pt jump shot"
        : "Anthony Davis makes layup",
    scoreHome: "2",
    scoreAway: "0",
    videoUrl: null,
    thumbnailUrl: null,
  };
}

function buildPlayerClips(searchParams) {
  const opponent = searchParams.get("opponent") || "";
  const excludeGameIds = new Set(
    (searchParams.get("excludeGameIds") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  if (excludeGameIds.has("game-1") && excludeGameIds.has("game-2")) {
    return {
      personId: 2544,
      season: "2025-26",
      playType: "all",
      result: "all",
      quarter: "all",
      count: 0,
      total: 0,
      offset: 0,
      limit: 12,
      hasMore: false,
      nextOffset: null,
      gamesIncluded: 0,
      gamesExcluded: 2,
      exclusions: [],
      clips: [],
    };
  }

  const clips =
    opponent === "BOS"
      ? [
          {
            gameId: "game-1",
            gameDate: "2026-01-15",
            matchup: "LAL vs. BOS",
            actionNumber: 101,
            period: 1,
            clock: "PT10M00.00S",
            teamTricode: "LAL",
            personId: 2544,
            playerName: "LeBron James",
            actionType: "2PT",
            subType: "layup",
            shotResult: "Made",
            shotDistance: 3,
            description: "LeBron James makes layup",
            scoreHome: "2",
            scoreAway: "0",
            videoUrl: null,
            thumbnailUrl: null,
          },
        ]
      : [
          {
            gameId: "game-2",
            gameDate: "2026-01-18",
            matchup: "LAL @ DAL",
            actionNumber: 202,
            period: 2,
            clock: "PT08M30.00S",
            teamTricode: "LAL",
            personId: 2544,
            playerName: "LeBron James",
            actionType: "3PT",
            subType: "jump-shot",
            shotResult: "Made",
            shotDistance: 25,
            description: "LeBron James makes 3pt jump shot",
            scoreHome: "12",
            scoreAway: "15",
            videoUrl: null,
            thumbnailUrl: null,
          },
        ];

  return {
    personId: 2544,
    season: "2025-26",
    playType: "all",
    result: "all",
    quarter: "all",
    count: clips.length,
    total: clips.length,
    offset: 0,
    limit: 12,
    hasMore: false,
    nextOffset: null,
    gamesIncluded: clips.length,
    gamesExcluded: 0,
    exclusions: [],
    clips,
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (url.pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/games") {
    const date = url.searchParams.get("date");
    const payloadGames = date === "2025-10-01" ? [] : games;
    sendJson(res, 200, {
      count: payloadGames.length,
      games: payloadGames,
    });
    return;
  }

  if (url.pathname === "/clips/game") {
    const clip = buildGameClip(url.searchParams);
    sendJson(res, 200, {
      total: 1,
      offset: Number(url.searchParams.get("offset") || 0),
      limit: Number(url.searchParams.get("limit") || 12),
      hasMore: false,
      nextOffset: null,
      players: gameModePlayers,
      clips: [clip],
    });
    return;
  }

  if (url.pathname === "/players") {
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const players =
      q.length >= 2 && q.includes("lebron")
        ? [
            {
              personId: 2544,
              displayName: "LeBron James",
              teamTricode: "LAL",
              position: "F",
            },
          ]
        : [];

    sendJson(res, 200, {
      count: players.length,
      totalMatches: players.length,
      players,
    });
    return;
  }

  if (url.pathname === "/players/2544/games") {
    sendJson(res, 200, {
      personId: 2544,
      season: "2025-26",
      count: 2,
      games: [
        {
          gameId: "game-1",
          gameDate: "2026-01-15",
          matchup: "LAL vs. BOS",
          wl: "W",
          min: 35,
          pts: 28,
          reb: 8,
          ast: 9,
        },
        {
          gameId: "game-2",
          gameDate: "2026-01-18",
          matchup: "LAL @ DAL",
          wl: "L",
          min: 37,
          pts: 31,
          reb: 7,
          ast: 10,
        },
      ],
    });
    return;
  }

  if (url.pathname === "/groups/positions") {
    sendJson(res, 200, {
      positions: ["G", "F", "C", "G-F", "F-C", "F-G", "C-F"],
    });
    return;
  }

  if (url.pathname === "/clips/player") {
    sendJson(res, 200, buildPlayerClips(url.searchParams));
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Mock API listening on http://127.0.0.1:${port}`);
});
