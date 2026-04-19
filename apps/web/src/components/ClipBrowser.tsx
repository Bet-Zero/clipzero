"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildApiUrl, getApiUnavailableMessage } from "@/lib/api";
import {
  CLIP_PAGE_TTL_MS,
  fetchJsonWithCache,
} from "@/lib/requestCache";
import {
  recordClipNavigation,
  useInteractionPressure,
} from "@/lib/interactionPressure";
import {
  checkClipBatchForStress,
  loadMoreCooldownMs,
  recordFetchFailure,
  useStressMode,
} from "@/lib/stressMode";
import { DEFAULT_RESULT, buildClipSearchParams } from "@/lib/filters";
import { PLAY_TYPE_LABELS } from "@/lib/filterConfig";
import type { Clip } from "@/lib/types";
import ClipPlayer from "@/components/ClipPlayer";
import ClipRail from "@/components/ClipRail";

type Props = {
  initialClips: Clip[];
  initialTotal: number;
  initialLimit: number;
  initialHasMore: boolean;
  initialNextOffset: number | null;
  initialVideoCdnAvailable: boolean;
  gameId: string;
  player: string;
  result: string;
  playType: string;
  quarter: string;
  team: string;
  shotValue: string;
  subType: string;
  distanceBucket: string;
  area: string;
  descriptor: string;
  qualifier: string;
  initialActionNumber: number | null;
  homeTeamTricode?: string;
  positionGroup?: string;
  playerIds?: string;
  season: string;
};

function setActionNumberInUrl(actionNumber: number | null) {
  const url = new URL(window.location.href);
  if (actionNumber !== null) {
    url.searchParams.set("actionNumber", String(actionNumber));
  } else {
    url.searchParams.delete("actionNumber");
  }
  window.history.replaceState(null, "", url.toString());
}

export default function ClipBrowser({
  initialClips,
  initialTotal,
  initialLimit,
  initialHasMore,
  initialNextOffset,
  initialVideoCdnAvailable,
  gameId,
  player,
  result,
  playType,
  quarter,
  team,
  shotValue,
  subType,
  distanceBucket,
  area,
  descriptor,
  qualifier,
  initialActionNumber,
  homeTeamTricode,
  positionGroup,
  playerIds,
  season,
}: Props) {
  const [clips, setClips] = useState<Clip[]>(initialClips);
  const [total, setTotal] = useState(initialTotal);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextOffset, setNextOffset] = useState<number | null>(
    initialNextOffset,
  );
  const [videoCdnAvailable, setVideoCdnAvailable] = useState(
    initialVideoCdnAvailable,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize active index from the pinned actionNumber, fall back to 0.
  const [activeIndex, setActiveIndex] = useState(() => {
    if (initialActionNumber === null) return 0;
    const idx = initialClips.findIndex(
      (c) => c.actionNumber === initialActionNumber,
    );
    return idx >= 0 ? idx : 0;
  });

  const isHighPressure = useInteractionPressure();
  const isStressed = useStressMode();

  const loadingRef = useRef(false);
  // Request generation counter — incremented on every new clip-set fetch.
  // Only results matching the current generation are applied.
  const generationRef = useRef(0);
  // AbortController for the current in-flight fetch. Aborted when a new
  // request supersedes the old one.
  const abortRef = useRef<AbortController | null>(null);
  // Per-context set of offsets already fetched or currently in-flight.
  // Prevents duplicate load-more requests for the same offset.
  const fetchedOffsetsRef = useRef<Set<number>>(new Set());
  // Timestamp of the last load-more start. Enforces a 300ms minimum gap
  // between consecutive load-more operations to smooth bursts.
  const lastLoadMoreTimeRef = useRef<number>(0);

  // Keep a ref to clips so handleSelect never closes over a stale array.
  const clipsRef = useRef(clips);
  clipsRef.current = clips;

  // Refs for auto-advance so the onEnded callback never reads stale state.
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  // Stable ref for nextOffset so loadMore doesn't need it as a dep.
  const nextOffsetRef = useRef(nextOffset);
  nextOffsetRef.current = nextOffset;
  const pendingAdvanceRef = useRef(false);

  // Deep-link restore: if the URL has an actionNumber that isn't in the first
  // loaded page, clear it from the URL and stay at clip 0.
  // No blocking catch-up fetch — reliable page-1 loading takes priority.
  useEffect(() => {
    if (
      initialActionNumber !== null &&
      !initialClips.some((c) => c.actionNumber === initialActionNumber)
    ) {
      setActionNumberInUrl(initialClips[0]?.actionNumber ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the clip context changes (new server-rendered props arrive),
  // abort any in-flight fetch, invalidate pending results, and reset state.
  useEffect(() => {
    // Signal interaction pressure so prefetch backs off while the new
    // context settles. Weight 2 = counts as two jump-equivalents.
    recordClipNavigation(2);
    // Abort previous in-flight request.
    abortRef.current?.abort();
    abortRef.current = null;
    // Invalidate any pending results from old generations.
    generationRef.current++;
    // Clear stale loadMore / auto-advance state.
    loadingRef.current = false;
    pendingAdvanceRef.current = false;
    // Reset per-context load-more guards.
    fetchedOffsetsRef.current = new Set();
    lastLoadMoreTimeRef.current = 0;
    // Sync state from fresh server-rendered props.
    setClips(initialClips);
    setTotal(initialTotal);
    setHasMore(initialHasMore);
    setNextOffset(initialNextOffset);
    setVideoCdnAvailable(initialVideoCdnAvailable);
    setLoading(false);
    setError(null);
    const idx =
      initialActionNumber !== null
        ? initialClips.findIndex((c) => c.actionNumber === initialActionNumber)
        : -1;
    setActiveIndex(idx >= 0 ? idx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    gameId,
    player,
    result,
    playType,
    quarter,
    team,
    shotValue,
    subType,
    distanceBucket,
    area,
    descriptor,
    qualifier,
    positionGroup,
    playerIds,
    season,
  ]);

  // When user clicks a rail item, update both selection state and the URL.
  const handleSelect = useCallback((index: number) => {
    recordClipNavigation();
    setActiveIndex(index);
    const clip = clipsRef.current[index];
    setActionNumberInUrl(clip?.actionNumber ?? null);
  }, []);

  // Navigate to the previous clip.
  const goToPrev = useCallback(() => {
    const prev = activeIndexRef.current;
    if (prev <= 0) return;
    const next = prev - 1;
    const clip = clipsRef.current[next];
    setActiveIndex(next);
    setActionNumberInUrl(clip?.actionNumber ?? null);
  }, []);

  // Navigate to the next clip, auto-loading more if near the end.
  const goToNext = useCallback(() => {
    const prev = activeIndexRef.current;
    const maxIndex = clipsRef.current.length - 1;
    if (prev >= maxIndex) return;
    const next = prev + 1;
    const clip = clipsRef.current[next];
    setActiveIndex(next);
    setActionNumberInUrl(clip?.actionNumber ?? null);
  }, []);

  const loadMore = useCallback(async () => {
    // Read hasMore and nextOffset from refs so this callback stays stable
    // and the ClipRail IntersectionObserver doesn't reconnect after every batch.
    if (
      loadingRef.current ||
      !hasMoreRef.current ||
      nextOffsetRef.current === null
    )
      return;
    // Capture offset before any async work.
    const offset = nextOffsetRef.current;
    // Single-flight: skip if this offset was already fetched or is in-flight.
    if (fetchedOffsetsRef.current.has(offset)) return;
    // Minimum cooldown: enforce a gap between load-more starts.
    // In stress mode the gap is 2× normal to reduce upstream pressure.
    const now = Date.now();
    if (now - lastLoadMoreTimeRef.current < loadMoreCooldownMs()) return;
    fetchedOffsetsRef.current.add(offset);
    lastLoadMoreTimeRef.current = now;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    // Increment generation and capture it locally.
    const gen = ++generationRef.current;

    // Abort any previous in-flight fetch before starting a new one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const search = buildClipSearchParams({
        gameId,
        limit: initialLimit,
        offset,
        player,
        result,
        playType,
        quarter,
        team,
        shotValue,
        subType,
        distanceBucket,
        area,
        descriptor,
        qualifier,
        positionGroup,
        playerIds,
        season,
      });

      const url = buildApiUrl("/clips/game", search);
      const data = await fetchJsonWithCache(
        url,
        async () => {
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        },
        CLIP_PAGE_TTL_MS,
      );

      // Only apply results if this is still the latest request.
      if (gen !== generationRef.current) return;

      // Check for partial video-URL failures as a stress signal.
      checkClipBatchForStress(data.clips ?? [], data.videoCdnAvailable !== false);
      setClips((prev) => [...prev, ...(data.clips ?? [])]);
      setTotal((prev) => data.total ?? prev);
      setHasMore(data.hasMore ?? false);
      setNextOffset(data.nextOffset ?? null);
      if (typeof data.videoCdnAvailable === "boolean") {
        setVideoCdnAvailable(data.videoCdnAvailable);
      }
    } catch (err) {
      // Intentional aborts are silent — do not show error banners.
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Stale generation — discard silently.
      if (gen !== generationRef.current) return;
      recordFetchFailure();
      setError(
        err instanceof TypeError
          ? getApiUnavailableMessage()
          : `Could not load clips (${err instanceof Error ? err.message : "error"})`,
      );
    } finally {
      if (gen === generationRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [
    gameId,
    player,
    result,
    playType,
    quarter,
    team,
    shotValue,
    subType,
    distanceBucket,
    area,
    descriptor,
    qualifier,
    initialLimit,
    positionGroup,
    playerIds,
    season,
  ]);

  // Auto-advance: when the active clip's video ends, move to the next clip.
  // If at the end of the loaded list but more clips exist, trigger loadMore
  // and set a pending flag so we advance once they arrive.
  const handleClipEnded = useCallback(() => {
    const current = activeIndexRef.current;
    const maxIndex = clipsRef.current.length - 1;

    if (current < maxIndex) {
      goToNext();
    } else if (hasMoreRef.current) {
      pendingAdvanceRef.current = true;
      loadMore();
    }
    // else: final clip in the entire set — stop cleanly
  }, [goToNext, loadMore]);

  // Resolve pending advance when new clips arrive after loadMore completes.
  useEffect(() => {
    if (pendingAdvanceRef.current) {
      const current = activeIndexRef.current;
      const maxIndex = clips.length - 1;
      if (current < maxIndex) {
        pendingAdvanceRef.current = false;
        goToNext();
      }
    }
  }, [clips.length, goToNext]);

  // Auto-load the next page when approaching the end of the loaded clip set.
  // Prefetch horizon: at most one page ahead (≤3 clips remaining triggers the
  // load; the returned page adds ~12 clips, keeping the horizon bounded).
  // Suppressed under interaction pressure or stress mode — aggressive skipping,
  // rapid context changes, and upstream failures are all signs that prefetch
  // will create more load than benefit.
  useEffect(() => {
    if (!isHighPressure && !isStressed && hasMore && clips.length - activeIndex <= 3) {
      loadMore();
    }
  }, [activeIndex, clips.length, hasMore, isHighPressure, isStressed, loadMore]);

  // Keyboard navigation: ArrowLeft / ArrowRight.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't hijack keyboard input from text fields or other inputs.
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        recordClipNavigation();
        goToPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        recordClipNavigation();
        goToNext();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [goToPrev, goToNext]);

  // Preload adjacent clip poster images (lightweight, poster only).
  useEffect(() => {
    const adjacent = [clips[activeIndex - 1], clips[activeIndex + 1]];
    for (const c of adjacent) {
      if (c?.thumbnailUrl) {
        const img = new Image();
        img.src = c.thumbnailUrl;
      }
    }
  }, [activeIndex, clips]);

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-2 px-4 py-2 overflow-y-auto">
      <ClipRail
        clips={clips}
        activeIndex={activeIndex}
        onSelect={handleSelect}
        hasMore={hasMore}
        loading={loading}
        error={error}
        onLoadMore={loadMore}
        homeTeamTricode={homeTeamTricode}
      />

      <div className="mx-auto w-full max-w-4xl">
        {!videoCdnAvailable && (
          <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            NBA video CDN is currently returning placeholder videos. Clips are
            listed, but playback is disabled until NBA video files recover.
          </div>
        )}
        <ClipPlayer
          clip={clips[activeIndex] ?? null}
          onEnded={handleClipEnded}
        />
      </div>

      <div className="pb-1 text-center text-xs text-zinc-600">
        {clips.length} of {total} clips
        {"  ·  "}
        {team || "All Teams"} · {quarter ? `Q${quarter}` : "All Quarters"} ·{" "}
        {PLAY_TYPE_LABELS[playType as keyof typeof PLAY_TYPE_LABELS] ??
          playType}
        {player ? ` · ${player}` : ""}
        {playType === "shots" && result !== DEFAULT_RESULT
          ? ` · ${result}`
          : ""}
      </div>
    </div>
  );
}
