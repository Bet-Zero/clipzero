"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function LoadMoreButton() {
  const router = useRouter();
  const params = useSearchParams();

  const currentLimit = Number(params.get("limit") ?? "12");
  const nextLimit = currentLimit + 12;

  function handleClick() {
    const search = new URLSearchParams(params.toString());
    search.set("limit", String(nextLimit));
    router.push(`/?${search.toString()}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10">
      <button
        onClick={handleClick}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white transition hover:bg-zinc-900"
      >
        Load More
      </button>
    </div>
  );
}
