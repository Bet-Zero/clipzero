import { describe, it, expect } from "vitest";
import {
  splitMultiValue,
  hasMultiValue,
  toggleMultiValue,
  removeMultiValue,
  canonicalMultiValue,
  cleanSearchString,
  buildClipSearchParams,
  buildPlayerClipSearchParams,
  parsePlayerModeParams,
  buildPlayerModeUrl,
  DEFAULT_PLAY_TYPE,
  DEFAULT_RESULT,
} from "./filters";

// ── splitMultiValue ─────────────────────────────────────────────────

describe("splitMultiValue", () => {
  it("splits comma-separated values", () => {
    expect(splitMultiValue("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("trims whitespace", () => {
    expect(splitMultiValue(" a , b , c ")).toEqual(["a", "b", "c"]);
  });

  it("filters empty segments", () => {
    expect(splitMultiValue("a,,b,")).toEqual(["a", "b"]);
  });

  it("returns empty array for empty string", () => {
    expect(splitMultiValue("")).toEqual([]);
  });

  it("returns single value for non-comma string", () => {
    expect(splitMultiValue("abc")).toEqual(["abc"]);
  });
});

// ── hasMultiValue ───────────────────────────────────────────────────

describe("hasMultiValue", () => {
  it("returns true when value is present", () => {
    expect(hasMultiValue("a,b,c", "b")).toBe(true);
  });

  it("returns false when value is absent", () => {
    expect(hasMultiValue("a,b,c", "d")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(hasMultiValue("", "a")).toBe(false);
  });

  it("returns true for single matching value", () => {
    expect(hasMultiValue("a", "a")).toBe(true);
  });
});

// ── toggleMultiValue ────────────────────────────────────────────────

describe("toggleMultiValue", () => {
  it("adds a value when not present", () => {
    expect(toggleMultiValue("a,b", "c")).toBe("a,b,c");
  });

  it("removes a value when present", () => {
    expect(toggleMultiValue("a,b,c", "b")).toBe("a,c");
  });

  it("adds to empty string", () => {
    expect(toggleMultiValue("", "a")).toBe("a");
  });

  it("removes last value to empty", () => {
    expect(toggleMultiValue("a", "a")).toBe("");
  });

  it("returns sorted result", () => {
    expect(toggleMultiValue("c,a", "b")).toBe("a,b,c");
  });
});

// ── removeMultiValue ────────────────────────────────────────────────

describe("removeMultiValue", () => {
  it("removes a value", () => {
    expect(removeMultiValue("a,b,c", "b")).toBe("a,c");
  });

  it("does nothing if value is not present", () => {
    expect(removeMultiValue("a,b", "c")).toBe("a,b");
  });

  it("returns empty for last value", () => {
    expect(removeMultiValue("a", "a")).toBe("");
  });
});

// ── canonicalMultiValue ─────────────────────────────────────────────

describe("canonicalMultiValue", () => {
  it("sorts values", () => {
    expect(canonicalMultiValue("c,a,b")).toBe("a,b,c");
  });

  it("deduplicates values", () => {
    expect(canonicalMultiValue("a,b,a,c,b")).toBe("a,b,c");
  });

  it("handles empty string", () => {
    expect(canonicalMultiValue("")).toBe("");
  });

  it("handles single value", () => {
    expect(canonicalMultiValue("a")).toBe("a");
  });
});

// ── cleanSearchString ───────────────────────────────────────────────

describe("cleanSearchString", () => {
  it("decodes encoded commas", () => {
    const params = new URLSearchParams();
    params.set("team", "LAL,GSW");
    const result = cleanSearchString(params);
    expect(result).toContain("LAL,GSW");
    expect(result).not.toContain("%2C");
  });

  it("leaves other encoded chars intact", () => {
    const params = new URLSearchParams();
    params.set("name", "hello world");
    const result = cleanSearchString(params);
    expect(result).toContain("hello");
  });
});

// ── buildClipSearchParams ───────────────────────────────────────────

describe("buildClipSearchParams", () => {
  it("sets required params", () => {
    const params = buildClipSearchParams({
      gameId: "0022501115",
      limit: 20,
      offset: 0,
    });
    expect(params.get("gameId")).toBe("0022501115");
    expect(params.get("limit")).toBe("20");
    expect(params.get("offset")).toBe("0");
  });

  it("sets optional params when provided", () => {
    const params = buildClipSearchParams({
      gameId: "123",
      limit: 10,
      offset: 5,
      player: "LeBron",
      result: "Made",
      playType: "shots",
      quarter: "1",
      team: "LAL",
      shotValue: "3pt",
      subType: "dunk",
      distanceBucket: "0-9",
      actionNumber: 42,
    });
    expect(params.get("player")).toBe("LeBron");
    expect(params.get("result")).toBe("Made");
    expect(params.get("playType")).toBe("shots");
    expect(params.get("quarter")).toBe("1");
    expect(params.get("team")).toBe("LAL");
    expect(params.get("shotValue")).toBe("3pt");
    expect(params.get("subType")).toBe("dunk");
    expect(params.get("distanceBucket")).toBe("0-9");
    expect(params.get("actionNumber")).toBe("42");
  });

  it("omits optional params when not provided", () => {
    const params = buildClipSearchParams({
      gameId: "123",
      limit: 10,
      offset: 0,
    });
    expect(params.has("player")).toBe(false);
    expect(params.has("result")).toBe(false);
    expect(params.has("playType")).toBe(false);
    expect(params.has("actionNumber")).toBe(false);
  });

  it("omits result when it equals DEFAULT_RESULT", () => {
    const params = buildClipSearchParams({
      gameId: "123",
      limit: 10,
      offset: 0,
      result: DEFAULT_RESULT,
    });
    expect(params.has("result")).toBe(false);
  });
});

// ── buildPlayerClipSearchParams ─────────────────────────────────────

describe("buildPlayerClipSearchParams", () => {
  it("sets required params", () => {
    const params = buildPlayerClipSearchParams({
      personId: 2544,
      season: "2024-25",
      limit: 20,
      offset: 0,
    });
    expect(params.get("personId")).toBe("2544");
    expect(params.get("season")).toBe("2024-25");
    expect(params.get("limit")).toBe("20");
    expect(params.get("offset")).toBe("0");
  });

  it("sets optional params when provided", () => {
    const params = buildPlayerClipSearchParams({
      personId: 2544,
      season: "2024-25",
      limit: 10,
      offset: 0,
      playType: "shots",
      result: "Made",
      quarter: "3",
      shotValue: "2pt",
      subType: "layup",
      distanceBucket: "0-9",
      opponent: "GSW",
      excludeDates: ["2024-01-01", "2024-01-02"],
      excludeGameIds: ["game1", "game2"],
      actionNumber: 7,
    });
    expect(params.get("playType")).toBe("shots");
    expect(params.get("result")).toBe("Made");
    expect(params.get("quarter")).toBe("3");
    expect(params.get("opponent")).toBe("GSW");
    expect(params.get("excludeDates")).toBe("2024-01-01,2024-01-02");
    expect(params.get("excludeGameIds")).toBe("game1,game2");
    expect(params.get("actionNumber")).toBe("7");
  });

  it("omits excludeDates/excludeGameIds when empty", () => {
    const params = buildPlayerClipSearchParams({
      personId: 1,
      season: "2024-25",
      limit: 10,
      offset: 0,
      excludeDates: [],
      excludeGameIds: [],
    });
    expect(params.has("excludeDates")).toBe(false);
    expect(params.has("excludeGameIds")).toBe(false);
  });
});

// ── parsePlayerModeParams ───────────────────────────────────────────

describe("parsePlayerModeParams", () => {
  it("parses full player mode params", () => {
    const params = new URLSearchParams({
      personId: "2544",
      playerName: "LeBron James",
      teamTricode: "LAL",
      playType: "shots",
      result: "Made",
      quarter: "4",
      shotValue: "3pt",
      subType: "jump-shot",
      distanceBucket: "20-29",
      opponent: "GSW",
      excludeGameIds: "g1,g2",
      excludeDates: "2024-01-01,2024-01-02",
      actionNumber: "42",
    });

    const state = parsePlayerModeParams(params);
    expect(state.player).toEqual({
      personId: 2544,
      displayName: "LeBron James",
      teamTricode: "LAL",
    });
    expect(state.playType).toBe("shots");
    expect(state.result).toBe("Made");
    expect(state.quarter).toBe("4");
    expect(state.shotValue).toBe("3pt");
    expect(state.subType).toBe("jump-shot");
    expect(state.distanceBucket).toBe("20-29");
    expect(state.opponent).toBe("GSW");
    expect(state.excludedGameIds).toEqual(new Set(["g1", "g2"]));
    expect(state.excludedDates).toEqual(
      new Set(["2024-01-01", "2024-01-02"]),
    );
    expect(state.actionNumber).toBe(42);
  });

  it("returns defaults for empty params", () => {
    const params = new URLSearchParams();
    const state = parsePlayerModeParams(params);
    expect(state.player).toBeNull();
    expect(state.playType).toBe(DEFAULT_PLAY_TYPE);
    expect(state.result).toBe(DEFAULT_RESULT);
    expect(state.quarter).toBe("");
    expect(state.shotValue).toBe("");
    expect(state.subType).toBe("");
    expect(state.distanceBucket).toBe("");
    expect(state.opponent).toBe("");
    expect(state.excludedGameIds).toEqual(new Set());
    expect(state.excludedDates).toEqual(new Set());
    expect(state.actionNumber).toBeNull();
  });

  it("returns null player when only personId is provided (no playerName)", () => {
    const params = new URLSearchParams({ personId: "2544" });
    const state = parsePlayerModeParams(params);
    expect(state.player).toBeNull();
  });
});

// ── buildPlayerModeUrl ──────────────────────────────────────────────

describe("buildPlayerModeUrl", () => {
  it("builds URL with player info", () => {
    const url = buildPlayerModeUrl("2024-25", {
      player: {
        personId: 2544,
        displayName: "LeBron James",
        teamTricode: "LAL",
      },
      playType: DEFAULT_PLAY_TYPE,
      result: DEFAULT_RESULT,
      quarter: "",
      shotValue: "",
      subType: "",
      distanceBucket: "",
      opponent: "",
      excludedGameIds: new Set(),
      excludedDates: new Set(),
      actionNumber: null,
    });
    expect(url).toContain("mode=player");
    expect(url).toContain("season=2024-25");
    expect(url).toContain("personId=2544");
    expect(url).toContain("playerName=LeBron+James");
    expect(url).toContain("teamTricode=LAL");
    // Default play type and result should be omitted
    expect(url).not.toContain("playType=");
    expect(url).not.toContain("result=");
  });

  it("builds URL with filters", () => {
    const url = buildPlayerModeUrl("2024-25", {
      player: {
        personId: 1,
        displayName: "Player",
        teamTricode: "BOS",
      },
      playType: "shots",
      result: "Made",
      quarter: "1,4",
      shotValue: "3pt",
      subType: "dunk,layup",
      distanceBucket: "0-9,10-19",
      opponent: "GSW",
      excludedGameIds: new Set(["g2", "g1"]),
      excludedDates: new Set(["2024-01-02", "2024-01-01"]),
      actionNumber: 7,
    });
    expect(url).toContain("playType=shots");
    expect(url).toContain("result=Made");
    expect(url).toContain("quarter=1,4");
    expect(url).toContain("shotValue=3pt");
    expect(url).toContain("subType=dunk,layup");
    expect(url).toContain("distanceBucket=0-9,10-19");
    expect(url).toContain("opponent=GSW");
    // Excluded game IDs should be sorted
    expect(url).toContain("excludeGameIds=g1,g2");
    expect(url).toContain("excludeDates=2024-01-01,2024-01-02");
    expect(url).toContain("actionNumber=7");
  });

  it("builds minimal URL without player", () => {
    const url = buildPlayerModeUrl("2024-25", {
      player: null,
      playType: DEFAULT_PLAY_TYPE,
      result: DEFAULT_RESULT,
      quarter: "",
      shotValue: "",
      subType: "",
      distanceBucket: "",
      opponent: "",
      excludedGameIds: new Set(),
      excludedDates: new Set(),
      actionNumber: null,
    });
    expect(url).toContain("mode=player");
    expect(url).toContain("season=2024-25");
    expect(url).not.toContain("personId=");
    expect(url).not.toContain("playerName=");
  });
});
