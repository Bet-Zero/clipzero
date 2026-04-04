"use client";

import { useEffect, useRef, useState } from "react";
import { buildApiUrl } from "@/lib/api";
import type { PlayerSearchResult } from "@/lib/types";

type Props = {
  season: string;
  selectedPlayer: PlayerSearchResult | null;
  onSelect: (player: PlayerSearchResult) => void;
  onClear: () => void;
};

export default function PlayerSearch({
  season,
  selectedPlayer,
  onSelect,
  onClear,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedPlayer) {
      setQuery(selectedPlayer.displayName);
      setIsOpen(false);
    }
  }, [selectedPlayer]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  function search(q: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      setSearchError(null);
      setIsOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setSearchError(null);
      try {
        const params = new URLSearchParams({ q: q.trim(), season });
        const res = await fetch(buildApiUrl("/players", params));
        if (!res.ok) {
          setResults([]);
          setSearchError(`Search failed (HTTP ${res.status})`);
          return;
        }
        const data = await res.json();
        setResults(data.players ?? []);
        setIsOpen(true);
      } catch (err) {
        setResults([]);
        setSearchError(
          err instanceof TypeError
            ? "API unavailable — is the backend running on localhost:4000?"
            : "Search failed",
        );
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  function handleSelect(player: PlayerSearchResult) {
    setQuery(player.displayName);
    setIsOpen(false);
    onSelect(player);
  }

  return (
    <div className="relative min-w-50">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            search(e.target.value);
          }}
          onFocus={() => {
            if (results.length > 0 && !selectedPlayer) setIsOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 150);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) =>
                results.length === 0 ? -1 : (i + 1) % results.length,
              );
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) =>
                results.length === 0 ? -1 : i <= 0 ? results.length - 1 : i - 1,
              );
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (activeIndex >= 0 && results[activeIndex]) {
                handleSelect(results[activeIndex]);
              }
            } else if (e.key === "Escape") {
              setIsOpen(false);
            }
          }}
          placeholder="Search player..."
          className="h-9 w-full rounded bg-zinc-900 px-3 text-sm text-white placeholder:text-zinc-500"
        />
        {selectedPlayer && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              onClear();
              inputRef.current?.focus();
            }}
            className="h-9 rounded bg-zinc-900 px-2 text-sm text-zinc-400 hover:text-zinc-200"
            aria-label="Clear player"
          >
            ×
          </button>
        )}
        {loading && <span className="text-xs text-zinc-500">...</span>}
      </div>

      {searchError && (
        <p className="mt-1 text-xs text-red-400">{searchError}</p>
      )}

      {isOpen && results.length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-lg">
          {results.map((p, i) => (
            <button
              key={p.personId}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(p)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm text-white ${
                i === activeIndex ? "bg-zinc-700" : "hover:bg-zinc-800"
              }`}
            >
              <span>{p.displayName}</span>
              <span className="text-xs text-zinc-500">{p.teamTricode}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
