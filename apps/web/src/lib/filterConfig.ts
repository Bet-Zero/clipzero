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
// "result" (Made / Missed) is rendered by existing buttons in FilterBar for shots — not listed here.
export const PLAY_TYPE_FILTERS: Partial<Record<PlayType, FilterDef[]>> = {
  shots: [
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
      id: "distanceBucket",
      param: "distanceBucket",
      label: "Distance",
      defaultValue: "",
      style: "select",
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
      options: [
        { label: "All", value: "" },
        { label: "Off", value: "Offensive" },
        { label: "Def", value: "Defensive" },
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
      options: [
        { label: "All Fouls", value: "" },
        { label: "Personal", value: "Personal" },
        { label: "Technical", value: "Technical" },
        { label: "Flagrant 1", value: "Flagrant1" },
        { label: "Flagrant 2", value: "Flagrant2" },
        { label: "Loose Ball", value: "Loose Ball" },
        { label: "Offensive", value: "Offensive" },
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
      options: [
        { label: "All Turnovers", value: "" },
        { label: "Bad Pass", value: "Bad Pass" },
        { label: "Lost Ball", value: "Lost Ball" },
        { label: "Traveling", value: "Traveling" },
        { label: "Out of Bounds", value: "Step Out of Bounds" },
        { label: "Offensive Foul", value: "Offensive Foul" },
      ],
    },
  ],

  // assists / steals / blocks: no play-type-specific extra filters
};

export function getFiltersForPlayType(playType: string): FilterDef[] {
  return PLAY_TYPE_FILTERS[playType as PlayType] ?? [];
}
