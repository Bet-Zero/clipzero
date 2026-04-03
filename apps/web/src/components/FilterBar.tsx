export default function FilterBar() {
  return (
    <div className="sticky top-0 z-10 border-b border-zinc-800 bg-black/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        
        {/* Player Search */}
        <input
          placeholder="Search player..."
          className="h-9 w-48 rounded bg-zinc-900 px-3 text-sm outline-none focus:ring-1 focus:ring-zinc-600"
        />

        {/* Team */}
        <select className="h-9 rounded bg-zinc-900 px-3 text-sm outline-none">
          <option>All Teams</option>
        </select>

        {/* Play Type */}
        <select className="h-9 rounded bg-zinc-900 px-3 text-sm outline-none">
          <option>All Plays</option>
        </select>

        {/* Quarter */}
        <select className="h-9 rounded bg-zinc-900 px-3 text-sm outline-none">
          <option>All Quarters</option>
        </select>

      </div>
    </div>
  );
}
