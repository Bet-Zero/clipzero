"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildApiUrl } from "@/lib/api";
import type { PlayerGroup, PlayerSearchResult } from "@/lib/types";
import {
  getCustomGroups,
  savePlayerGroup,
  deletePlayerGroup,
  generateCustomGroupId,
} from "@/lib/playerGroups";

type Props = {
  season: string;
  open: boolean;
  onClose: () => void;
  /** Called after a group is saved or deleted so parent can refresh. */
  onGroupsChanged: () => void;
};

type EditState = {
  id: string;
  name: string;
  playerIds: number[];
  playerNames: string[];
};

export default function PlayerGroupManager({
  season,
  open,
  onClose,
  onGroupsChanged,
}: Props) {
  const [groups, setGroups] = useState<PlayerGroup[]>([]);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const searchSeqRef = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Load groups on open
  useEffect(() => {
    if (open) {
      setGroups(getCustomGroups());
      setEditing(null);
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [open]);

  // Cleanup debounce timer and abort pending fetch on unmount or season change
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [season]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!dialogRef.current?.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const searchPlayers = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (q.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        // Cancel any in-flight request
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        const seq = ++searchSeqRef.current;

        setSearchLoading(true);
        try {
          const params = new URLSearchParams({ q: q.trim(), season });
          const res = await fetch(buildApiUrl("/players", params), {
            signal: controller.signal,
          });
          // Only apply results if this is still the latest request
          if (seq === searchSeqRef.current && res.ok) {
            const data = await res.json();
            setSearchResults(data.players ?? []);
          }
        } catch {
          // ignore (AbortError or network failure)
        } finally {
          if (seq === searchSeqRef.current) {
            setSearchLoading(false);
          }
        }
      }, 250);
    },
    [season],
  );

  function startNewGroup() {
    setEditing({
      id: "",
      name: "",
      playerIds: [],
      playerNames: [],
    });
    setSearchQuery("");
    setSearchResults([]);
  }

  function startEditGroup(group: PlayerGroup) {
    setEditing({
      id: group.id,
      name: group.name,
      playerIds: group.playerIds ?? [],
      playerNames: group.playerNames ?? [],
    });
    setSearchQuery("");
    setSearchResults([]);
  }

  function addPlayer(player: PlayerSearchResult) {
    if (!editing) return;
    if (editing.playerIds.includes(player.personId)) return;
    setEditing({
      ...editing,
      playerIds: [...editing.playerIds, player.personId],
      playerNames: [...editing.playerNames, player.displayName],
    });
  }

  function removePlayer(personId: number) {
    if (!editing) return;
    const idx = editing.playerIds.indexOf(personId);
    if (idx < 0) return;
    const newIds = [...editing.playerIds];
    const newNames = [...editing.playerNames];
    newIds.splice(idx, 1);
    newNames.splice(idx, 1);
    setEditing({ ...editing, playerIds: newIds, playerNames: newNames });
  }

  function handleSave() {
    if (!editing || !editing.name.trim() || editing.playerIds.length === 0)
      return;
    const group: PlayerGroup = {
      id: editing.id || generateCustomGroupId(editing.name),
      name: editing.name.trim(),
      type: "custom",
      playerIds: editing.playerIds,
      playerNames: editing.playerNames,
    };
    savePlayerGroup(group);
    setGroups(getCustomGroups());
    setEditing(null);
    onGroupsChanged();
  }

  function handleDelete(id: string) {
    deletePlayerGroup(id);
    setGroups(getCustomGroups());
    onGroupsChanged();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div
        ref={dialogRef}
        className="w-full max-w-md overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">
            {editing ? (editing.id ? "Edit Group" : "New Group") : "Player Groups"}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {!editing ? (
            // List view
            <>
              {groups.length === 0 && (
                <p className="text-sm text-zinc-500">
                  No custom groups yet. Create one to get started.
                </p>
              )}
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="mb-2 flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-medium text-white">
                      {group.name}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {group.playerNames?.join(", ") ||
                        `${group.playerIds?.length ?? 0} players`}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEditGroup(group)}
                      className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(group.id)}
                      className="rounded px-2 py-1 text-xs text-red-500 hover:bg-zinc-700 hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={startNewGroup}
                className="mt-2 w-full rounded-lg border border-dashed border-zinc-600 py-2 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
              >
                + Create New Group
              </button>
            </>
          ) : (
            // Edit/create view
            <>
              <label className="mb-3 block">
                <span className="text-xs text-zinc-500">Group Name</span>
                <input
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  placeholder="e.g. My Bigs"
                  className="mt-1 block w-full rounded bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                  autoFocus
                />
              </label>

              {/* Player search */}
              <div className="mb-3">
                <span className="text-xs text-zinc-500">Add Players</span>
                <input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchPlayers(e.target.value);
                  }}
                  placeholder="Search player..."
                  className="mt-1 block w-full rounded bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                />
                {searchLoading && (
                  <div className="mt-1 text-xs text-zinc-500">Searching...</div>
                )}
                {searchResults.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded border border-zinc-700 bg-zinc-950">
                    {searchResults.map((p) => {
                      const alreadyAdded = editing.playerIds.includes(
                        p.personId,
                      );
                      return (
                        <button
                          key={p.personId}
                          onClick={() => {
                            if (!alreadyAdded) addPlayer(p);
                          }}
                          disabled={alreadyAdded}
                          className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                            alreadyAdded
                              ? "text-zinc-600"
                              : "text-zinc-300 hover:bg-zinc-800"
                          }`}
                        >
                          <span>{p.displayName}</span>
                          <span className="text-xs text-zinc-500">
                            {p.teamTricode}
                            {alreadyAdded ? " ✓" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected players */}
              <div className="mb-3">
                <span className="text-xs text-zinc-500">
                  Players ({editing.playerIds.length})
                </span>
                {editing.playerIds.length === 0 && (
                  <p className="mt-1 text-xs text-zinc-600">
                    Search and add players above.
                  </p>
                )}
                <div className="mt-1 flex flex-wrap gap-1">
                  {editing.playerNames.map((name, i) => (
                    <span
                      key={editing.playerIds[i]}
                      className="inline-flex items-center gap-1 rounded-full bg-zinc-800 py-0.5 pl-2.5 pr-1 text-xs text-zinc-300"
                    >
                      {name}
                      <button
                        onClick={() => removePlayer(editing.playerIds[i])}
                        className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-700 hover:text-zinc-200"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(null)}
                  className="flex-1 rounded bg-zinc-800 py-2 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={
                    !editing.name.trim() || editing.playerIds.length === 0
                  }
                  className="flex-1 rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600"
                >
                  Save Group
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
