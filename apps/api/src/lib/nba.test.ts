import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import {
  getGamesByDate,
  getPlayByPlay,
  getPlayerNameMapForGame,
  getTodaysGames,
} from "./nba";

vi.mock("axios", () => {
  const get = vi.fn();
  return {
    default: {
      get,
      isAxiosError: vi.fn(() => false),
    },
  };
});

// nba.ts now issues requests through `nbaGet` (browser-like TLS signature)
// rather than axios directly. These tests cover nba.ts's retry, denial and
// payload-validation logic, not the transport, so route the transport back
// through the same spy the assertions below already drive.
vi.mock("./nbaHttp", async () => {
  const { default: mockedAxiosModule } = await import("axios");
  return {
    nbaGet: (url: string, opts?: unknown) =>
      (
        mockedAxiosModule as unknown as {
          get: (u: string, o?: unknown) => unknown;
        }
      ).get(url, opts),
  };
});

const mockedAxios = vi.mocked(axios, true);

function mockResponse(data: unknown, overrides: Record<string, unknown> = {}) {
  return {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
    data,
    ...overrides,
  };
}

function makeAxiosError(
  status: number,
  data: unknown,
  headers: Record<string, string> = {
    "content-type": "application/json",
  },
) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: {
      status,
      data,
      headers,
    },
  });
}

describe("getGamesByDate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.isAxiosError.mockImplementation(
      (error: unknown): error is Error & { isAxiosError: true } =>
        Boolean((error as { isAxiosError?: boolean } | null)?.isAxiosError),
    );
  });

  it("sends the ISO date unchanged to scoreboardv3", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        scoreboard: {
          games: [
            {
              gameId: "0042500202",
              gameCode: "20260507/CLEDET",
              gameStatusText: "Final",
              homeTeam: {
                teamName: "Pistons",
                teamTricode: "DET",
              },
              awayTeam: {
                teamName: "Cavaliers",
                teamTricode: "CLE",
              },
            },
          ],
        },
      },
    });

    const games = await getGamesByDate("2026-05-07");

    expect(mockedAxios.get).toHaveBeenCalledWith(
      "https://stats.nba.com/stats/scoreboardv3",
      expect.objectContaining({
        params: {
          GameDate: "2026-05-07",
          LeagueID: "00",
        },
      }),
    );

    expect(games).toEqual([
      {
        gameId: "0042500202",
        gameCode: "20260507/CLEDET",
        gameStatusText: "Final",
        homeTeam: {
          teamName: "Pistons",
          teamTricode: "DET",
        },
        awayTeam: {
          teamName: "Cavaliers",
          teamTricode: "CLE",
        },
      },
    ]);
  });

  it("returns play-by-play actions on the first CDN attempt", async () => {
    mockedAxios.get.mockResolvedValueOnce(
      mockResponse({
        game: {
          actions: [{ actionNumber: 14 }],
        },
      }),
    );

    await expect(getPlayByPlay("0042500204")).resolves.toEqual([
      { actionNumber: 14 },
    ]);

    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      "https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_0042500204.json",
      expect.objectContaining({
        headers: {
          Accept: "application/json, text/plain, */*",
        },
        timeout: 20000,
      }),
    );
  });

  it("retries play-by-play with browser-like CDN headers after denial", async () => {
    mockedAxios.get
      .mockRejectedValueOnce(
        makeAxiosError(403, "<html>Access Denied</html>", {
          "content-type": "text/html",
        }),
      )
      .mockResolvedValueOnce(
        mockResponse({
          game: {
            actions: [{ actionNumber: 27 }],
          },
        }),
      );

    await expect(getPlayByPlay("0042500204")).resolves.toEqual([
      { actionNumber: 27 },
    ]);

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    expect(mockedAxios.get.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json, text/plain, */*",
          Referer: "https://www.nba.com/",
          Origin: "https://www.nba.com",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": expect.stringContaining("Mozilla/5.0"),
        }),
        timeout: 20000,
      }),
    );
  });

  it("throws when both CDN play-by-play attempts are denied", async () => {
    mockedAxios.get
      .mockRejectedValueOnce(
        makeAxiosError(403, "<html>Access Denied</html>", {
          "content-type": "text/html",
        }),
      )
      .mockRejectedValueOnce(
        makeAxiosError(403, "<Error><Code>AccessDenied</Code></Error>", {
          "content-type": "application/xml",
        }),
      );

    await expect(getPlayByPlay("0042500205")).rejects.toThrow(
      /browser-like CDN retry/i,
    );

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid play-by-play payloads instead of returning bad data", async () => {
    mockedAxios.get.mockResolvedValueOnce(
      mockResponse({
        game: {
          actions: null,
        },
      }),
    );

    await expect(getPlayByPlay("0042500204")).rejects.toThrow(
      "Invalid NBA play-by-play response",
    );

    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it("retries boxscore fetches after CDN denial", async () => {
    mockedAxios.get
      .mockResolvedValueOnce(
        mockResponse("<Error><Code>AccessDenied</Code></Error>", {
          headers: {
            "content-type": "application/xml",
          },
        }),
      )
      .mockResolvedValueOnce(
        mockResponse({
          game: {
            homeTeam: {
              players: [
                {
                  personId: 1,
                  firstName: "Jalen",
                  familyName: "Brunson",
                },
              ],
            },
            awayTeam: {
              players: [],
            },
          },
        }),
      );

    const playerMap = await getPlayerNameMapForGame("0042500204");

    expect(playerMap.get(1)).toBe("Jalen Brunson");
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it("retries todays scoreboard fetches after CDN denial", async () => {
    mockedAxios.get
      .mockRejectedValueOnce(
        makeAxiosError(403, "Access Denied", {
          "content-type": "text/html",
        }),
      )
      .mockResolvedValueOnce(
        mockResponse(
          JSON.stringify({
            scoreboard: {
              games: [
                {
                  gameId: "0042500204",
                  gameCode: "20260513/NYKBOS",
                  gameStatusText: "Final",
                  homeTeam: {
                    teamName: "Celtics",
                    teamTricode: "BOS",
                  },
                  awayTeam: {
                    teamName: "Knicks",
                    teamTricode: "NYK",
                  },
                },
              ],
            },
          }),
          {
            headers: {
              "content-type": "text/plain",
            },
          },
        ),
      );

    await expect(getTodaysGames()).resolves.toEqual([
      {
        gameId: "0042500204",
        gameCode: "20260513/NYKBOS",
        gameStatusText: "Final",
        homeTeam: {
          teamName: "Celtics",
          teamTricode: "BOS",
        },
        awayTeam: {
          teamName: "Knicks",
          teamTricode: "NYK",
        },
      },
    ]);

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });
});
