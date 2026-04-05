// Shared filter model: defines which controls appear for each play type,
// what their URL param names are, and what their options are.
// FilterBar and PlayerModeBrowser both import from here — no one-off logic.

export const PLAY_TYPES = [
  "shots",
  "assists",
  "rebounds",
  "turnovers",
  "fouls",
  "steals",
  "blocks",
] as const;

export type PlayType = (typeof PLAY_TYPES)[number];

export type FilterOption = {
  label: string;
  value: string; // "" = "all" / no filter active
};

export type FilterDef = {
  id: string;
  param: string; // URL search-param name
  label: string;
  defaultValue: string; // "" = off
  style: "buttons" | "select";
  options: FilterOption[];
  multiSelect?: boolean;
};

// Params that are play-type-specific.
// When playType changes, every param in this list must be cleared to "".
export const PLAY_TYPE_SPECIFIC_PARAMS = [
  "result",
  "shotValue",
  "subType",
  "distanceBucket",
] as const;

// Per-play-type extra filter definitions.
// "team", "player", "quarter" are universal and NOT listed here.
//
// Option values for subType filters are normalized group keys (e.g. "layup",
// "offensive"). The backend uses apps/api/src/lib/subtypeGroups.ts to map
// raw NBA subType strings into these keys. This keeps the UI config clean
// while the backend owns the matching rules.
export const PLAY_TYPE_FILTERS: Partial<Record<PlayType, FilterDef[]>> = {
  shots: [
    {
      id: "result",
      param: "result",
      label: "Result",
      defaultValue: "all",
      style: "buttons",
      options: [
        { label: "All", value: "all" },
        { label: "Made", value: "Made" },
        { label: "Missed", value: "Missed" },
      ],
    },
    {
      id: "shotValue",
      param: "shotValue",
      label: "Value",
      defaultValue: "",
      style: "buttons",
      options: [
        { label: "All", value: "" },
        { label: "2PT", value: "2pt" },
        { label: "3PT", value: "3pt" },
      ],
    },
    {
      id: "shotSubType",
      param: "subType",
      label: "Shot Type",
      defaultValue: "",
      style: "select",
      multiSelect: true,
      options: [
        { label: "All Shot Types", value: "" },
        { label: "Layup", value: "layup" },
        { label: "Dunk", value: "dunk" },
        { label: "Jump Shot", value: "jump-shot" },
        { label: "Hook Shot", value: "hook" },
        { label: "Fadeaway", value: "fadeaway" },
        { label: "Pull-up", value: "pullup" },
        { label: "Floater", value: "floater" },
        { label: "Step Back", value: "stepback" },
        { label: "Tip Shot", value: "tip" },
        { label: "Bank Shot", value: "bank" },
        { label: "Other", value: "other" },
      ],
    },
    {
      id: "distanceBucket",
      param: "distanceBucket",
      label: "Distance",
      defaultValue: "",
      style: "select",
      multiSelect: true,
      options: [
        { label: "All Distances", value: "" },
        { label: "0–9 ft", value: "0-9" },
        { label: "10–19 ft", value: "10-19" },
        { label: "20–29 ft", value: "20-29" },
        { label: "30+ ft", value: "30+" },
      ],
    },
  ],

  rebounds: [
    {
      id: "subType",
      param: "subType",
      label: "Type",
      defaultValue: "",
      style: "buttons",
      multiSelect: true,
      options: [
        { label: "All", value: "" },
        { label: "Off", value: "offensive" },
        { label: "Def", value: "defensive" },
        { label: "Other", value: "other" },
      ],
    },
  ],

  fouls: [
    {
      id: "subType",
      param: "subType",
      label: "Foul Type",
      defaultValue: "",
      style: "select",
      multiSelect: true,
      options: [
        { label: "All Fouls", value: "" },
        { label: "Personal", value: "personal" },
        { label: "Technical", value: "technical" },
        { label: "Flagrant 1", value: "flagrant-1" },
        { label: "Flagrant 2", value: "flagrant-2" },
        { label: "Loose Ball", value: "loose-ball" },
        { label: "Offensive", value: "offensive" },
        { label: "Other", value: "other" },
      ],
    },
  ],

  turnovers: [
    {
      id: "subType",
      param: "subType",
      label: "Type",
      defaultValue: "",
      style: "select",
      multiSelect: true,
      options: [
        { label: "All Turnovers", value: "" },
        { label: "Bad Pass", value: "bad-pass" },
        { label: "Lost Ball", value: "lost-ball" },
        { label: "Traveling", value: "traveling" },
        { label: "Out of Bounds", value: "out-of-bounds" },
        { label: "Offensive Foul", value: "offensive-foul" },
        { label: "Other", value: "other" },
      ],
    },
  ],

  // assists / steals / blocks: no play-type-specific extra filters
};

export function getFiltersForPlayType(playType: string): FilterDef[] {
  return PLAY_TYPE_FILTERS[playType as PlayType] ?? [];
}
