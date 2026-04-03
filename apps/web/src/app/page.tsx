type Clip = {
  gameId: string;
  actionNumber?: number;
  period?: number;
  clock?: string;
  teamId?: number;
  teamTricode?: string;
  personId?: number;
  playerName?: string;
  actionType?: string;
  subType?: string;
  shotResult?: string;
  shotDistance?: number;
  x?: number;
  y?: number;
  description?: string;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
};

import FilterBar from "@/components/FilterBar";
import ClipFeed from "@/components/ClipFeed";

async function getClips(): Promise<Clip[]> {
  const response = await fetch("http://localhost:4000/clips/game", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch clips");
  }

  const data = await response.json();
  return data.clips;
}

export default async function Home() {
  const clips = await getClips();

  return (
    <main className="min-h-screen bg-black text-white">
      <FilterBar />
      <ClipFeed clips={clips} />
    </main>
  );
}
