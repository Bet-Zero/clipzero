import { describe, it, expect } from "vitest";
import {
  SEASONS,
  DEFAULT_SEASON,
  seasonBounds,
  dateInSeason,
  seasonForDate,
  defaultDateForSeason,
  parseSeason,
} from "./season";

describe("SEASONS constant", () => {
  it("contains expected seasons", () => {
    expect(SEASONS).toContain("2023-24");
    expect(SEASONS).toContain("2024-25");
    expect(SEASONS).toContain("2025-26");
  });

  it("DEFAULT_SEASON is the last season", () => {
    expect(DEFAULT_SEASON).toBe(SEASONS[SEASONS.length - 1]);
  });
});

describe("seasonBounds", () => {
  it("returns Oct 1 to Jun 30 for 2024-25", () => {
    const bounds = seasonBounds("2024-25");
    expect(bounds.start).toBe("2024-10-01");
    expect(bounds.end).toBe("2025-06-30");
  });

  it("returns Oct 1 to Jun 30 for 2023-24", () => {
    const bounds = seasonBounds("2023-24");
    expect(bounds.start).toBe("2023-10-01");
    expect(bounds.end).toBe("2024-06-30");
  });

  it("returns Oct 1 to Jun 30 for 2025-26", () => {
    const bounds = seasonBounds("2025-26");
    expect(bounds.start).toBe("2025-10-01");
    expect(bounds.end).toBe("2026-06-30");
  });
});

describe("dateInSeason", () => {
  it("returns true for date within season", () => {
    expect(dateInSeason("2025-01-15", "2024-25")).toBe(true);
  });

  it("returns true for start date (Oct 1)", () => {
    expect(dateInSeason("2024-10-01", "2024-25")).toBe(true);
  });

  it("returns true for end date (Jun 30)", () => {
    expect(dateInSeason("2025-06-30", "2024-25")).toBe(true);
  });

  it("returns false for date before season start", () => {
    expect(dateInSeason("2024-09-30", "2024-25")).toBe(false);
  });

  it("returns false for date after season end", () => {
    expect(dateInSeason("2025-07-01", "2024-25")).toBe(false);
  });

  it("returns false for off-season date", () => {
    expect(dateInSeason("2025-08-15", "2024-25")).toBe(false);
  });

  it("returns false for malformed dates", () => {
    expect(dateInSeason("2025-2-1", "2024-25")).toBe(false);
    expect(dateInSeason("2025-02-30", "2024-25")).toBe(false);
    expect(dateInSeason("not-a-date", "2024-25")).toBe(false);
  });
});

describe("seasonForDate", () => {
  it("returns correct season for mid-season date", () => {
    expect(seasonForDate("2025-01-15")).toBe("2024-25");
  });

  it("returns correct season for opening month", () => {
    expect(seasonForDate("2024-10-15")).toBe("2024-25");
  });

  it("returns correct season for finals month", () => {
    expect(seasonForDate("2025-06-15")).toBe("2024-25");
  });

  it("returns DEFAULT_SEASON for off-season date", () => {
    expect(seasonForDate("2025-08-15")).toBe(DEFAULT_SEASON);
  });

  it("returns DEFAULT_SEASON for date not in any season", () => {
    expect(seasonForDate("2020-01-01")).toBe(DEFAULT_SEASON);
  });

  it("returns DEFAULT_SEASON for malformed dates", () => {
    expect(seasonForDate("2025-02-30")).toBe(DEFAULT_SEASON);
    expect(seasonForDate("not-a-date")).toBe(DEFAULT_SEASON);
  });

  it("prefers the latest season when date falls in multiple", () => {
    // This shouldn't happen with NBA seasons, but tests the reverse iteration
    expect(seasonForDate("2025-11-01")).toBe("2025-26");
  });
});

describe("defaultDateForSeason", () => {
  it("returns Jan 15 of the second year for 2024-25", () => {
    expect(defaultDateForSeason("2024-25")).toBe("2025-01-15");
  });

  it("returns Jan 15 of the second year for 2023-24", () => {
    expect(defaultDateForSeason("2023-24")).toBe("2024-01-15");
  });
});

describe("parseSeason", () => {
  it("returns valid season as-is", () => {
    expect(parseSeason("2024-25")).toBe("2024-25");
  });

  it("returns DEFAULT_SEASON for invalid season", () => {
    expect(parseSeason("2019-20")).toBe(DEFAULT_SEASON);
  });

  it("returns DEFAULT_SEASON for undefined", () => {
    expect(parseSeason(undefined)).toBe(DEFAULT_SEASON);
  });

  it("returns DEFAULT_SEASON for empty string", () => {
    expect(parseSeason("")).toBe(DEFAULT_SEASON);
  });

  it("returns DEFAULT_SEASON for random string", () => {
    expect(parseSeason("not-a-season")).toBe(DEFAULT_SEASON);
  });

  it("accepts all defined seasons", () => {
    for (const season of SEASONS) {
      expect(parseSeason(season)).toBe(season);
    }
  });
});
