import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { getGamesByDate } from "./nba";

vi.mock("axios", () => {
  const get = vi.fn();
  return {
    default: {
      get,
      isAxiosError: vi.fn(() => false),
    },
  };
});

const mockedAxios = vi.mocked(axios, true);

describe("getGamesByDate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});