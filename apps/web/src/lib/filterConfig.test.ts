import { describe, it, expect } from "vitest";
import {
  PLAY_TYPES,
  PLAY_TYPE_LABELS,
  PLAY_TYPE_FILTERS,
  PLAY_TYPE_SPECIFIC_PARAMS,
  FILTER_PRESETS,
  getFiltersForPlayType,
} from "./filterConfig";

describe("PLAY_TYPES", () => {
  it("contains expected play types", () => {
    expect(PLAY_TYPES).toContain("all");
    expect(PLAY_TYPES).toContain("shots");
    expect(PLAY_TYPES).toContain("assists");
    expect(PLAY_TYPES).toContain("rebounds");
    expect(PLAY_TYPES).toContain("turnovers");
    expect(PLAY_TYPES).toContain("fouls");
    expect(PLAY_TYPES).toContain("steals");
    expect(PLAY_TYPES).toContain("blocks");
  });

  it("includes aggregate types", () => {
    expect(PLAY_TYPES).toContain("all-offense");
    expect(PLAY_TYPES).toContain("all-defense");
    expect(PLAY_TYPES).toContain("good-plays");
    expect(PLAY_TYPES).toContain("bad-plays");
  });
});

describe("PLAY_TYPE_LABELS", () => {
  it("has a label for every play type", () => {
    for (const pt of PLAY_TYPES) {
      expect(PLAY_TYPE_LABELS[pt]).toBeDefined();
      expect(typeof PLAY_TYPE_LABELS[pt]).toBe("string");
      expect(PLAY_TYPE_LABELS[pt].length).toBeGreaterThan(0);
    }
  });
});

describe("PLAY_TYPE_SPECIFIC_PARAMS", () => {
  it("contains expected params", () => {
    expect(PLAY_TYPE_SPECIFIC_PARAMS).toContain("result");
    expect(PLAY_TYPE_SPECIFIC_PARAMS).toContain("shotValue");
    expect(PLAY_TYPE_SPECIFIC_PARAMS).toContain("subType");
    expect(PLAY_TYPE_SPECIFIC_PARAMS).toContain("distanceBucket");
  });
});

describe("getFiltersForPlayType", () => {
  it("returns filter definitions for shots", () => {
    const filters = getFiltersForPlayType("shots");
    expect(filters.length).toBeGreaterThan(0);
    const ids = filters.map((f) => f.id);
    expect(ids).toContain("result");
    expect(ids).toContain("shotValue");
    expect(ids).toContain("shotSubType");
    expect(ids).toContain("distanceBucket");
  });

  it("returns filter definitions for rebounds", () => {
    const filters = getFiltersForPlayType("rebounds");
    expect(filters.length).toBeGreaterThan(0);
    const ids = filters.map((f) => f.id);
    expect(ids).toContain("subType");
  });

  it("returns filter definitions for fouls", () => {
    const filters = getFiltersForPlayType("fouls");
    expect(filters.length).toBeGreaterThan(0);
  });

  it("returns filter definitions for turnovers", () => {
    const filters = getFiltersForPlayType("turnovers");
    expect(filters.length).toBeGreaterThan(0);
  });

  it("returns empty array for play types without extra filters", () => {
    expect(getFiltersForPlayType("assists")).toEqual([]);
    expect(getFiltersForPlayType("steals")).toEqual([]);
    expect(getFiltersForPlayType("blocks")).toEqual([]);
    expect(getFiltersForPlayType("all")).toEqual([]);
  });

  it("returns empty array for unknown play type", () => {
    expect(getFiltersForPlayType("unknown")).toEqual([]);
  });

  it("each filter definition has required properties", () => {
    for (const [, filters] of Object.entries(PLAY_TYPE_FILTERS)) {
      if (!filters) continue;
      for (const filter of filters) {
        expect(filter.id).toBeDefined();
        expect(filter.param).toBeDefined();
        expect(filter.label).toBeDefined();
        expect(filter.style).toMatch(/^(buttons|select)$/);
        expect(Array.isArray(filter.options)).toBe(true);
        expect(filter.options.length).toBeGreaterThan(0);
        // Each option should have label and value
        for (const opt of filter.options) {
          expect(typeof opt.label).toBe("string");
          expect(typeof opt.value).toBe("string");
        }
      }
    }
  });
});

describe("FILTER_PRESETS", () => {
  it("each preset has an id, label, and params with playType", () => {
    for (const preset of FILTER_PRESETS) {
      expect(preset.id).toBeDefined();
      expect(preset.label).toBeDefined();
      expect(preset.params.playType).toBeDefined();
    }
  });

  it("preset ids are unique", () => {
    const ids = FILTER_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contains expected presets", () => {
    const ids = FILTER_PRESETS.map((p) => p.id);
    expect(ids).toContain("made-3s");
    expect(ids).toContain("dunks");
    expect(ids).toContain("layups-rim");
  });
});
