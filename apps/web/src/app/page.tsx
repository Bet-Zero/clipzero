import FilterBar from "@/components/FilterBar";
import ClipFeed from "@/components/ClipFeed";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <FilterBar />
      <ClipFeed />
    </main>
  );
}
