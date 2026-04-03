export default function Loading() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="h-9 w-28 rounded bg-zinc-900" />
        <div className="h-9 w-28 rounded bg-zinc-900" />
        <div className="h-9 w-28 rounded bg-zinc-900" />
        <div className="h-9 w-40 rounded bg-zinc-900" />
      </div>

      <div className="mx-auto max-w-3xl px-4 py-4">
        <div className="h-9 w-48 rounded bg-zinc-900" />
      </div>

      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
          >
            <div className="aspect-video w-full bg-zinc-900" />
            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="h-4 w-32 rounded bg-zinc-900" />
                <div className="h-3 w-16 rounded bg-zinc-900" />
              </div>
              <div className="h-4 w-full rounded bg-zinc-900" />
              <div className="h-4 w-4/5 rounded bg-zinc-900" />
              <div className="flex items-center justify-between">
                <div className="h-3 w-32 rounded bg-zinc-900" />
                <div className="h-3 w-12 rounded bg-zinc-900" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
