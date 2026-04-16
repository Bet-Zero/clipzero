import type { PlayerGroup } from "./types";

const STORAGE_KEY = "clipzero:playerGroups";

// ── Built-in position groups ──
// These are always available regardless of localStorage.

export const POSITION_GROUPS: PlayerGroup[] = [
  {
    id: "position:G",
    name: "Guards",
    type: "trait",
    traitField: "position",
    traitValue: "G",
  },
  {
    id: "position:F",
    name: "Forwards",
    type: "trait",
    traitField: "position",
    traitValue: "F",
  },
  {
    id: "position:C",
    name: "Centers",
    type: "trait",
    traitField: "position",
    traitValue: "C",
  },
];

// ── Custom group CRUD (localStorage) ──

function isPlayerGroup(item: unknown): item is PlayerGroup {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    (obj.type === "trait" || obj.type === "custom")
  );
}

function readStorage(): PlayerGroup[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPlayerGroup);
  } catch {
    return [];
  }
}

function writeStorage(groups: PlayerGroup[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch {
    // Quota or security errors — silently ignore
  }
}

/** Get all custom player groups from localStorage. */
export function getCustomGroups(): PlayerGroup[] {
  return readStorage();
}

/** Get a specific player group by ID (searches both built-in and custom). */
export function getPlayerGroup(id: string): PlayerGroup | null {
  const builtin = POSITION_GROUPS.find((g) => g.id === id);
  if (builtin) return builtin;
  return readStorage().find((g) => g.id === id) ?? null;
}

/** Save a custom player group. If one with the same ID exists, it's replaced. */
export function savePlayerGroup(group: PlayerGroup): void {
  const groups = readStorage();
  const idx = groups.findIndex((g) => g.id === group.id);
  if (idx >= 0) {
    groups[idx] = group;
  } else {
    groups.push(group);
  }
  writeStorage(groups);
}

/** Delete a custom player group by ID. */
export function deletePlayerGroup(id: string): void {
  const groups = readStorage().filter((g) => g.id !== id);
  writeStorage(groups);
}

/** Get all groups (built-in + custom) for display in a unified dropdown. */
export function getAllGroups(): PlayerGroup[] {
  return [...POSITION_GROUPS, ...readStorage()];
}

/** Generate a unique custom group ID from a name. */
export function generateCustomGroupId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `custom:${slug || "group"}-${Date.now()}`;
}
