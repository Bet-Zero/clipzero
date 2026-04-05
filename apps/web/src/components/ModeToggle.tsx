"use client";

export default function ModeToggle({
  mode,
  onSwitch,
}: {
  mode: string;
  onSwitch: (mode: "game" | "player") => void;
}) {
  return (
    <div className="flex rounded bg-zinc-900">
      <button
        data-testid="mode-game"
        onClick={() => onSwitch("game")}
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
        onClick={() => onSwitch("player")}
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
