// Normalized subtype groups for each play type.
//
// The backend uses these rules to classify raw NBA subType values into stable
// UI groups. Each play type has an ordered list of groups — first match wins.
// If nothing matches, the action is classified as "other".
//
// The frontend (filterConfig) uses the group keys as URL param values.
// This keeps the backend as the single authority on matching while the
// frontend only needs to know group keys + labels.

type GroupMatcher = (subType: string, description: string) => boolean;

type SubTypeGroupDef = {
  key: string;
  match: GroupMatcher;
};

// ── Shots ──────────────────────────────────────────────────────────────
// Priority-ordered. Modifiers (fadeaway, pullup, floating, step-back)
// take precedence over base types (layup, dunk, hook, bank, jump shot).
//
// Examples of raw NBA subType values:
//   "Fadeaway Jump Shot", "Turnaround Fadeaway Bank Jump Shot",
//   "Pullup Jump Shot", "Running Pull-Up Jump Shot",
//   "Driving Floating Jump Shot", "Floating Jump Shot",
//   "Step Back Jump Shot", "Step Back Bank Jump Shot",
//   "Tip Shot", "Tip Layup Shot", "Tip Dunk Shot",
//   "Driving Layup Shot", "Reverse Layup Shot", "Alley Oop Layup shot",
//   "Dunk Shot", "Driving Dunk Shot", "Putback Dunk Shot",
//   "Hook Shot", "Driving Bank Hook Shot", "Turnaround Hook Shot",
//   "Jump Bank Shot", "Running Bank Shot", "Turnaround Bank Shot",
//   "Jump Shot", "Turnaround Jump Shot", "Running Jump Shot"

const SHOT_GROUPS: SubTypeGroupDef[] = [
  { key: "fadeaway", match: (st) => /fadeaway/i.test(st) },
  { key: "pullup", match: (st) => /pull[\s-]?up/i.test(st) },
  { key: "floater", match: (st) => /float(ing|er)/i.test(st) },
  { key: "stepback", match: (st) => /step[\s-]?back/i.test(st) },
  { key: "tip", match: (st) => /\btip\b/i.test(st) },
  { key: "layup", match: (st) => /layup/i.test(st) },
  { key: "dunk", match: (st) => /dunk/i.test(st) },
  { key: "hook", match: (st) => /hook/i.test(st) },
  { key: "bank", match: (st) => /bank/i.test(st) },
  { key: "jump-shot", match: (st) => /jump\s*shot|jumper/i.test(st) },
];

// ── Rebounds ────────────────────────────────────────────────────────────
// subType may be empty; fall back to description for off/def detection.

const REBOUND_GROUPS: SubTypeGroupDef[] = [
  {
    key: "offensive",
    match: (st, desc) =>
      /offensive/i.test(st) || /\boffensive\s*rebound\b/i.test(desc),
  },
  {
    key: "defensive",
    match: (st, desc) =>
      /defensive/i.test(st) || /\bdefensive\s*rebound\b/i.test(desc),
  },
];

// ── Turnovers ──────────────────────────────────────────────────────────

const TURNOVER_GROUPS: SubTypeGroupDef[] = [
  {
    key: "bad-pass",
    match: (st, desc) => /bad pass/i.test(st) || /bad pass/i.test(desc),
  },
  {
    key: "lost-ball",
    match: (st, desc) => /lost ball/i.test(st) || /lost ball/i.test(desc),
  },
  {
    key: "traveling",
    match: (st, desc) => /travel/i.test(st) || /travel/i.test(desc),
  },
  {
    key: "out-of-bounds",
    match: (st, desc) =>
      /out\s*of\s*bounds|step\s*out/i.test(st) ||
      /out\s*of\s*bounds|step\s*out/i.test(desc),
  },
  {
    key: "offensive-foul",
    match: (st, desc) =>
      /offensive\s*foul/i.test(st) || /offensive\s*foul/i.test(desc),
  },
];

// ── Fouls ──────────────────────────────────────────────────────────────
// "Shooting Foul" is grouped under "personal" — both are personal fouls.

const FOUL_GROUPS: SubTypeGroupDef[] = [
  {
    key: "personal",
    match: (st) =>
      (/personal/i.test(st) || /shooting/i.test(st)) && !/loose/i.test(st),
  },
  { key: "technical", match: (st) => /technical/i.test(st) },
  { key: "flagrant-1", match: (st) => /flagrant.*1/i.test(st) },
  { key: "flagrant-2", match: (st) => /flagrant.*2/i.test(st) },
  { key: "loose-ball", match: (st) => /loose\s*ball/i.test(st) },
  { key: "offensive", match: (st) => /offensive/i.test(st) },
];

// ── Registry ───────────────────────────────────────────────────────────

const GROUP_DEFS: Record<string, SubTypeGroupDef[]> = {
  shots: SHOT_GROUPS,
  rebounds: REBOUND_GROUPS,
  turnovers: TURNOVER_GROUPS,
  fouls: FOUL_GROUPS,
  "fouls-drawn": FOUL_GROUPS,
};

/**
 * Classify a raw action into a normalized group key.
 * Returns the group key (e.g. "layup", "offensive") or "other" if the play
 * type has groups but none matched, or "" if the play type has no groups.
 */
export function classifySubType(
  playType: string,
  subType: string | undefined,
  description: string | undefined,
): string {
  const groups = GROUP_DEFS[playType];
  if (!groups) return "";

  const st = subType ?? "";
  const desc = description ?? "";

  for (const group of groups) {
    if (group.match(st, desc)) return group.key;
  }

  return "other";
}

/**
 * Check if a raw action matches a specific normalized group key.
 *
 * - groupKey "" → matches everything (no filter active)
 * - groupKey "other" → matches actions that don't fit any named group
 * - any other key → matches actions classified into that group
 */
export function matchesNormalizedGroup(
  playType: string,
  groupKey: string,
  subType: string | undefined,
  description: string | undefined,
): boolean {
  if (!groupKey) return true;

  const classified = classifySubType(playType, subType, description);
  return classified === groupKey;
}
