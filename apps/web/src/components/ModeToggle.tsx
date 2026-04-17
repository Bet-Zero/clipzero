"use client";

export default function ModeToggle({
  mode,
  onSwitch,
}: {
  mode: string;
  onSwitch: (mode: "game" | "player" | "matchup") => void;
}) {
  const modes = [
    { value: "game", label: "Game", testId: "mode-game" },
    { value: "player", label: "Player", testId: "mode-player" },
    { value: "matchup", label: "Matchup", testId: "mode-matchup" },
  ] as const;

  return (
    <div className="flex rounded bg-zinc-900">
      {modes.map((item) => (
        <button
          key={item.value}
          data-testid={item.testId}
          onClick={() => onSwitch(item.value)}
          className={`h-7 rounded px-3 text-xs font-medium transition-colors ${
            mode === item.value
              ? "bg-zinc-700 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
