import { describe, it, expect } from "vitest";
import { classifySubType, matchesNormalizedGroup } from "./subtypeGroups";

describe("classifySubType", () => {
  // ── Unknown play type → empty string ──────────────────────────────
  it("returns empty string for unknown play types", () => {
    expect(classifySubType("assists", "subtype", "desc")).toBe("");
    expect(classifySubType("blocks", "subtype", "desc")).toBe("");
    expect(classifySubType("steals", "subtype", "desc")).toBe("");
    expect(classifySubType("unknown", "subtype", "desc")).toBe("");
  });

  // ── Shots ─────────────────────────────────────────────────────────

  describe("shots", () => {
    it("classifies fadeaway shots", () => {
      expect(classifySubType("shots", "Fadeaway Jump Shot", "")).toBe(
        "fadeaway",
      );
      expect(
        classifySubType(
          "shots",
          "Turnaround Fadeaway Bank Jump Shot",
          "",
        ),
      ).toBe("fadeaway");
    });

    it("classifies pull-up shots", () => {
      expect(classifySubType("shots", "Pullup Jump Shot", "")).toBe("pullup");
      expect(
        classifySubType("shots", "Running Pull-Up Jump Shot", ""),
      ).toBe("pullup");
    });

    it("classifies floaters", () => {
      expect(
        classifySubType("shots", "Driving Floating Jump Shot", ""),
      ).toBe("floater");
      expect(classifySubType("shots", "Floating Jump Shot", "")).toBe(
        "floater",
      );
    });

    it("classifies step-back shots", () => {
      expect(classifySubType("shots", "Step Back Jump Shot", "")).toBe(
        "stepback",
      );
      expect(classifySubType("shots", "Step Back Bank Shot", "")).toBe(
        "stepback",
      );
    });

    it("classifies tip shots", () => {
      expect(classifySubType("shots", "Tip Shot", "")).toBe("tip");
      expect(classifySubType("shots", "Tip Layup Shot", "")).toBe("tip");
      expect(classifySubType("shots", "Tip Dunk Shot", "")).toBe("tip");
    });

    it("classifies layups", () => {
      expect(classifySubType("shots", "Driving Layup Shot", "")).toBe("layup");
      expect(classifySubType("shots", "Reverse Layup Shot", "")).toBe("layup");
      expect(
        classifySubType("shots", "Alley Oop Layup shot", ""),
      ).toBe("layup");
    });

    it("classifies dunks", () => {
      expect(classifySubType("shots", "Dunk Shot", "")).toBe("dunk");
      expect(classifySubType("shots", "Driving Dunk Shot", "")).toBe("dunk");
      expect(classifySubType("shots", "Putback Dunk Shot", "")).toBe("dunk");
    });

    it("classifies hook shots", () => {
      expect(classifySubType("shots", "Hook Shot", "")).toBe("hook");
      expect(classifySubType("shots", "Driving Bank Hook Shot", "")).toBe(
        "hook",
      );
      expect(classifySubType("shots", "Turnaround Hook Shot", "")).toBe(
        "hook",
      );
    });

    it("classifies bank shots", () => {
      expect(classifySubType("shots", "Jump Bank Shot", "")).toBe("bank");
      expect(classifySubType("shots", "Running Bank Shot", "")).toBe("bank");
      expect(classifySubType("shots", "Turnaround Bank Shot", "")).toBe(
        "bank",
      );
    });

    it("classifies jump shots", () => {
      expect(classifySubType("shots", "Jump Shot", "")).toBe("jump-shot");
      expect(classifySubType("shots", "Turnaround Jump Shot", "")).toBe(
        "jump-shot",
      );
      expect(classifySubType("shots", "Running Jump Shot", "")).toBe(
        "jump-shot",
      );
    });

    it("returns 'other' when no group matches", () => {
      expect(classifySubType("shots", "Unknown Shot Type", "")).toBe("other");
      expect(classifySubType("shots", "", "")).toBe("other");
    });

    it("handles undefined subType", () => {
      expect(classifySubType("shots", undefined, undefined)).toBe("other");
    });

    // Priority: fadeaway before jump-shot
    it("fadeaway takes priority over jump-shot", () => {
      expect(classifySubType("shots", "Fadeaway Jump Shot", "")).toBe(
        "fadeaway",
      );
    });

    // Priority: pullup before jump-shot
    it("pullup takes priority over jump-shot", () => {
      expect(classifySubType("shots", "Pullup Jump Shot", "")).toBe("pullup");
    });

    // Priority: step-back before bank
    it("step-back takes priority over bank", () => {
      expect(classifySubType("shots", "Step Back Bank Shot", "")).toBe(
        "stepback",
      );
    });
  });

  // ── Rebounds ───────────────────────────────────────────────────────

  describe("rebounds", () => {
    it("classifies offensive rebounds by subType", () => {
      expect(classifySubType("rebounds", "Offensive", "")).toBe("offensive");
    });

    it("classifies defensive rebounds by subType", () => {
      expect(classifySubType("rebounds", "Defensive", "")).toBe("defensive");
    });

    it("classifies offensive rebounds by description fallback", () => {
      expect(
        classifySubType("rebounds", "", "Player Offensive Rebound"),
      ).toBe("offensive");
    });

    it("classifies defensive rebounds by description fallback", () => {
      expect(
        classifySubType("rebounds", "", "Team Defensive Rebound"),
      ).toBe("defensive");
    });

    it("returns 'other' for unmatched rebounds", () => {
      expect(classifySubType("rebounds", "", "")).toBe("other");
    });
  });

  // ── Turnovers ─────────────────────────────────────────────────────

  describe("turnovers", () => {
    it("classifies bad pass turnovers", () => {
      expect(classifySubType("turnovers", "Bad Pass", "")).toBe("bad-pass");
    });

    it("classifies bad pass from description", () => {
      expect(
        classifySubType("turnovers", "", "Player Bad Pass Turnover"),
      ).toBe("bad-pass");
    });

    it("classifies lost ball turnovers", () => {
      expect(classifySubType("turnovers", "Lost Ball", "")).toBe("lost-ball");
    });

    it("classifies traveling", () => {
      expect(classifySubType("turnovers", "Traveling", "")).toBe("traveling");
    });

    it("classifies out of bounds", () => {
      expect(classifySubType("turnovers", "Out of Bounds", "")).toBe(
        "out-of-bounds",
      );
      expect(classifySubType("turnovers", "Step Out", "")).toBe(
        "out-of-bounds",
      );
    });

    it("classifies offensive foul turnovers", () => {
      expect(classifySubType("turnovers", "Offensive Foul", "")).toBe(
        "offensive-foul",
      );
    });

    it("returns 'other' for unmatched turnovers", () => {
      expect(classifySubType("turnovers", "Shot Clock", "")).toBe("other");
    });
  });

  // ── Fouls ─────────────────────────────────────────────────────────

  describe("fouls", () => {
    it("classifies personal fouls", () => {
      expect(classifySubType("fouls", "Personal Foul", "")).toBe("personal");
    });

    it("classifies shooting fouls as personal", () => {
      expect(classifySubType("fouls", "Shooting Foul", "")).toBe("personal");
    });

    it("classifies technical fouls", () => {
      expect(classifySubType("fouls", "Technical Foul", "")).toBe("technical");
    });

    it("classifies flagrant 1 fouls", () => {
      expect(classifySubType("fouls", "Flagrant Foul Type 1", "")).toBe(
        "flagrant-1",
      );
    });

    it("classifies flagrant 2 fouls", () => {
      expect(classifySubType("fouls", "Flagrant Foul Type 2", "")).toBe(
        "flagrant-2",
      );
    });

    it("classifies loose ball fouls", () => {
      expect(classifySubType("fouls", "Loose Ball Foul", "")).toBe(
        "loose-ball",
      );
    });

    it("loose ball is NOT classified as personal despite 'personal' not matching", () => {
      // "Loose Ball" contains neither "personal" nor "shooting" alone
      expect(classifySubType("fouls", "Loose Ball Foul", "")).toBe(
        "loose-ball",
      );
    });

    it("classifies offensive fouls", () => {
      expect(classifySubType("fouls", "Offensive Foul", "")).toBe("offensive");
    });

    it("returns 'other' for unmatched fouls", () => {
      expect(classifySubType("fouls", "Unknown Foul", "")).toBe("other");
    });
  });
});

describe("matchesNormalizedGroup", () => {
  it("returns true when groupKey is empty (no filter active)", () => {
    expect(matchesNormalizedGroup("shots", "", "Dunk Shot", "")).toBe(true);
    expect(matchesNormalizedGroup("rebounds", "", "Offensive", "")).toBe(true);
  });

  it("matches when classified group equals groupKey", () => {
    expect(matchesNormalizedGroup("shots", "dunk", "Dunk Shot", "")).toBe(true);
    expect(
      matchesNormalizedGroup("rebounds", "offensive", "Offensive", ""),
    ).toBe(true);
  });

  it("does not match when classified group differs", () => {
    expect(matchesNormalizedGroup("shots", "layup", "Dunk Shot", "")).toBe(
      false,
    );
    expect(
      matchesNormalizedGroup("rebounds", "defensive", "Offensive", ""),
    ).toBe(false);
  });

  it("matches 'other' group for unrecognized subtypes", () => {
    expect(
      matchesNormalizedGroup("shots", "other", "Unknown Shot", ""),
    ).toBe(true);
  });

  it("does not match named group for 'other' subtypes", () => {
    expect(
      matchesNormalizedGroup("shots", "dunk", "Unknown Shot", ""),
    ).toBe(false);
  });

  it("returns true for empty groupKey even with unknown play type", () => {
    expect(matchesNormalizedGroup("assists", "", "any", "any")).toBe(true);
  });
});
