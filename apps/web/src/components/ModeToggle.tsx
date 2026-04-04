"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function ModeToggle({ mode }: { mode: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function switchMode(newMode: string) {
    const search = new URLSearchParams();
    // Preserve season across modes
    const season = params.get("season");
    if (season) search.set("season", season);

    if (newMode === "player") {
      search.set("mode", "player");
    }
    // game mode: no mode param needed, preserve date
    if (newMode === "game") {
      const date = params.get("date");
      if (date) search.set("date", date);
    }

    router.push(`/?${search.toString()}`);
  }

  return (
    <div className="flex rounded bg-zinc-900">
      <button
        data-testid="mode-game"
        onClick={() => switchMode("game")}
        className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
          mode !== "player"
            ? "bg-zinc-700 text-white"
            : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        Game
      </button>
      <button
        data-testid="mode-player"
        onClick={() => switchMode("player")}
        className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === "player"
            ? "bg-zinc-700 text-white"
            : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        Player
      </button>
    </div>
  );
}
