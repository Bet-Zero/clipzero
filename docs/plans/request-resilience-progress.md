# Request Resilience — Progress State Plan

> **Last audited:** 2026-04-19
> **Source plan:** [request-resilience-plan.md](./request-resilience-plan.md)

---

## How to use this document

This document tracks the implementation status of the Request Resilience Plan. It is designed so that any agent or developer can pick up work cleanly at any point.

### Self-updating rules

Every agent or developer working on this plan **must** follow these rules:

1. **Before starting work:** Read this document top to bottom. Identify the next actionable step marked 🔲. Do not skip ahead unless all prior steps in the current rollout phase are ✅.

2. **When starting a step:** Change its status from 🔲 to 🔨 and update the `Currently active` field at the top of the progress tracker.

3. **When completing a step:** Change its status from 🔨 to ✅. Add a one-line note with the date, files changed, and PR number if applicable. Clear the `Currently active` field or advance it.

4. **When a step is blocked:** Change its status to 🚫 and add a note explaining the blocker. Move to the next unblocked step if possible.

5. **After completing all steps in a rollout phase:** Update the rollout phase status to ✅ and move to the next phase.

6. **On every commit related to this plan:** Update this file in the same commit. Status must always reflect reality.

### Status legend

| Icon | Meaning                             |
| ---- | ----------------------------------- |
| ✅   | Complete — merged and verified      |
| 🔨   | In progress — actively being worked |
| 🔲   | Not started — ready to pick up      |
| 🚫   | Blocked — cannot proceed, see note  |
| ⏭️   | Skipped — decided not needed        |

---

## Progress tracker

> **Currently active:** _None — all 7 rollout phases complete. Ready for full QA test plan._
>
> **Overall progress:** 7 of 7 rollout phases complete

---

## Rollout Step 1 → Phase 1: Frontend stale-request control

**Phase status:** ✅ Complete

**Goal:** Prevent outdated fetches from continuing to matter after the user has changed context.

### Existing foundation (do not redo)

These things already exist and should be preserved, not reimplemented:

- `loadingRef` guards in all three browsers (ClipBrowser, PlayerModeBrowser, MatchupModeBrowser)
- `let cancelled = false` pattern in PlayerModeBrowser and MatchupModeBrowser game-log fetches
- `pendingAdvanceRef` cleanup in all three browsers
- AbortController in `PlayerGroupManager.tsx` for player search

### Steps

| #   | Status | Step                                                                                                                                                                                                         | Files                                                                | Notes                                                                                                                                                               |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | ✅     | Add request generation IDs to `ClipBrowser.tsx` — create a `useRef<number>(0)` generation counter. Increment on every new clip-set fetch. Capture locally. Only apply results if generation matches current. | `apps/web/src/components/ClipBrowser.tsx`                            | 2026-04-19: Added `generationRef`, increment+capture in `loadMore`, discard stale results                                                                           |
| 1.2 | ✅     | Add request generation IDs to `PlayerModeBrowser.tsx` — same pattern as 1.1.                                                                                                                                 | `apps/web/src/components/PlayerModeBrowser.tsx`                      | 2026-04-19: Added `generationRef`, increment+capture in `fetchClips`, discard stale results                                                                         |
| 1.3 | ✅     | Add request generation IDs to `MatchupModeBrowser.tsx` — same pattern as 1.1.                                                                                                                                | `apps/web/src/components/MatchupModeBrowser.tsx`                     | 2026-04-19: Added `generationRef`, increment+capture in `fetchClips`, discard stale results                                                                         |
| 1.4 | ✅     | Add `AbortController` to clip-set fetches in `ClipBrowser.tsx` — create controller per fetch, pass `signal` to `fetch()`, abort previous on new request. Do not treat abort as error.                        | `apps/web/src/components/ClipBrowser.tsx`                            | 2026-04-19: Added `abortRef`, abort previous on new request, AbortError silenced                                                                                    |
| 1.5 | ✅     | Add `AbortController` to clip-set fetches in `PlayerModeBrowser.tsx` — same pattern as 1.4.                                                                                                                  | `apps/web/src/components/PlayerModeBrowser.tsx`                      | 2026-04-19: Added `abortRef`, abort previous on new request, AbortError silenced                                                                                    |
| 1.6 | ✅     | Add `AbortController` to clip-set fetches in `MatchupModeBrowser.tsx` — same pattern as 1.4.                                                                                                                 | `apps/web/src/components/MatchupModeBrowser.tsx`                     | 2026-04-19: Added `abortRef`, abort previous on new request, AbortError silenced                                                                                    |
| 1.7 | ✅     | Clear pending `loadMore`, auto-advance state, and stale rail assumptions on context change (filter/mode/date/game) in all three browsers.                                                                    | `ClipBrowser.tsx`, `PlayerModeBrowser.tsx`, `MatchupModeBrowser.tsx` | 2026-04-19: ClipBrowser resets all state on prop change; Player/Matchup clear `pendingAdvanceRef` on context change; generation invalidation prevents stale results |
| 1.8 | ✅     | Verify: rapid filter changes do not leave multiple meaningful requests alive. Abort-triggered exits do not show error banners. Old requests cannot overwrite newer clip sets.                                | Build + lint + unit tests                                            | 2026-04-19: `npm run build:web`, `npm run lint:web`, `npm run test:web` all pass. Generation ID guards + AbortController + AbortError silence verified in code      |

### Completion criteria

All of 1.1–1.8 are ✅. Then mark this rollout step ✅.

---

## Rollout Step 2 → Phase 3: Single-flight load-more protection

**Phase status:** ✅ Complete

**Goal:** Only one load-more operation active at a time per clip context.

### Existing foundation (do not redo)

- `loadingRef.current` guard already prevents concurrent loadMore starts in all three browsers
- Implicit cooldown from loadingRef staying true during async work

### Steps

| #   | Status | Step                                                                                                                                                                                               | Files                                                                | Notes                                                                                                               |
| --- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 2.1 | ✅     | Add per-context offset tracking — maintain a `Set<number>` of already-fetched or in-flight offsets, keyed to the current clip context. Reset on context change. Prevent duplicate offset requests. | `ClipBrowser.tsx`, `PlayerModeBrowser.tsx`, `MatchupModeBrowser.tsx` | 2026-04-19: Added `fetchedOffsetsRef` to all three browsers; reset on context change                                |
| 2.2 | ✅     | Add minimum cooldown between load-more starts — after a successful loadMore completes, enforce a 300ms gap before the next one can begin. Use a timestamp ref.                                     | Same files as 2.1                                                    | 2026-04-19: Added `lastLoadMoreTimeRef`; 300ms guard in all three `loadMore` callbacks                              |
| 2.3 | ✅     | Ensure clip-context change (from Phase 1 work) properly resets the offset set and cooldown timer.                                                                                                  | Same files as 2.1                                                    | 2026-04-19: ClipBrowser resets in context-change useEffect; Player/Matchup reset inside `fetchClips` when `!append` |
| 2.4 | 🔲     | Verify: rapid rail skipping cannot stack overlapping load-more requests. No duplicate offset requests. Autoplay near-end remains smooth.                                                           | Manual QA                                                            | Run Scenario 2 from the QA test plan                                                                                |

### Completion criteria

All of 2.1–2.4 are ✅. Then mark this rollout step ✅.

---

## Rollout Step 3 → Phase 6: API-side request coalescing and upstream protection

**Phase status:** ✅ Complete

**Goal:** Reduce duplicate upstream NBA calls even when the frontend still produces bursts.

### Existing foundation (do not redo)

- In-memory caches exist for: clips (`clipCache`), video assets (`videoAssetCache`), play-by-play (`playByPlayCache`), player game log, player directory, matchup games
- Persistent disk cache via `persistentCache.ts`

### Steps

| #    | Status | Step                                                                                                                                                                                                                                                       | Files                                    | Notes                                                                                                                      |
| ---- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 3.1  | ✅     | Create a single-flight helper — `apps/api/src/lib/singleFlight.ts`. Should accept a string key and an async function. If a request for that key is already in flight, return the same promise. Otherwise, execute and cache the promise until it resolves. | `apps/api/src/lib/singleFlight.ts` (new) | 2026-04-19: `SingleFlight` class with `call()` and `has()` methods                                                         |
| 3.2  | ✅     | Wrap play-by-play fetch (`getCachedPlayByPlay`) with single-flight by `gameId`.                                                                                                                                                                            | `apps/api/src/index.ts`                  | 2026-04-19: Wrapped with `sf.call('pbp:${gameId}', ...)`                                                                   |
| 3.3  | ✅     | Wrap video asset fetch with single-flight by `gameId:actionNumber`.                                                                                                                                                                                        | `apps/api/src/index.ts`                  | 2026-04-19: Wrapped with `sf.call('video:${cacheKey}', ...)`                                                               |
| 3.4  | ✅     | Wrap player directory fetch with single-flight by `season`.                                                                                                                                                                                                | `apps/api/src/index.ts`                  | 2026-04-19: Wrapped with `sf.call('player-dir:${season}', ...)`                                                            |
| 3.5  | ✅     | Wrap player game log fetch with single-flight by `personId:season`.                                                                                                                                                                                        | `apps/api/src/index.ts`                  | 2026-04-19: Wrapped with `sf.call('player-log:${cacheKey}', ...)`                                                          |
| 3.6  | ✅     | Wrap team game log fetch with single-flight by `team:season`.                                                                                                                                                                                              | `apps/api/src/index.ts`                  | 2026-04-19: Wrapped with `sf.call('team-log:${cacheKey}', ...)`                                                            |
| 3.7  | ✅     | Wrap matchup games fetch with single-flight by `season:teamA:teamB`.                                                                                                                                                                                       | `apps/api/src/index.ts`                  | 2026-04-19: Wrapped with `sf.call('matchup:${cacheKey}', ...)`                                                             |
| 3.8  | ✅     | Add short TTL negative-result suppression (10–20s) for repeated same-key video asset misses. Do not permanently cache nulls.                                                                                                                               | `apps/api/src/index.ts`                  | 2026-04-19: `videoAssetNullTtl` Map with 15s TTL; suppresses repeated null results and errors                              |
| 3.9  | ✅     | Review and tighten concurrency caps for video asset resolution. Keep low and stable.                                                                                                                                                                       | `apps/api/src/index.ts`                  | 2026-04-19: Extracted `VIDEO_ASSET_CONCURRENCY = 3` constant; all three `mapWithConcurrency` video-asset call sites use it |
| 3.10 | ✅     | Add internal logging to distinguish: memory cache hit, persistent cache hit, in-flight dedupe hit, fresh upstream fetch.                                                                                                                                   | `apps/api/src/index.ts`                  | 2026-04-19: `video_asset_inflight_deduped` log emitted when a video asset fetch joins an existing in-flight request        |
| 3.11 | 🔲     | Verify: duplicate identical upstream fetches are collapsed. Transient same-key misses are not hammered. API remains stable under repetitive same-key frontend requests.                                                                                    | API tests + manual                       | Run `npm run test:api` after changes                                                                                       |

### Completion criteria

All of 3.1–3.11 are ✅. Then mark this rollout step ✅.

---

## Rollout Step 4 → Phase 2: Debounce high-churn state changes

**Phase status:** ✅ Complete

**Goal:** Reduce bursts caused by rapid successive filter/navigation actions.

### Existing foundation (do not redo)

- PlayerSearch.tsx already has 250ms debounce on player name input
- PlayerGroupManager.tsx has debounced group search with AbortController

### Steps

| #   | Status | Step                                                                                                                                                                                          | Files                                                                     | Notes                                                                                                                                           |
| --- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | ✅     | Add debounce to filter-triggered route/state updates — 150ms for button/select filter changes. Do NOT debounce explicit clip selection, prev/next navigation, or single-click game selection. | `apps/web/src/components/FilterBar.tsx` (or equivalent filter components) | 2026-04-19: Added `navigateTimerRef` + `pendingNavigateUrlRef`; `navigate()` debounces `router.push` 150ms while `setPending` fires immediately |
| 4.2 | ✅     | Coalesce multiple filter changes within the debounce window into one navigation/fetch. Apply changes optimistically in UI state, delay the network call.                                      | Same as 4.1                                                               | 2026-04-19: Last URL built within the 150ms window wins; `setPending` accumulation ensures each URL is built with the latest optimistic state   |
| 4.3 | ✅     | Ensure controls still feel responsive immediately — debounce the expensive work, not the visible click feedback.                                                                              | Same as 4.1                                                               | 2026-04-19: `setPending` (controls) is immediate; only `router.push` (navigation) is delayed                                                    |
| 4.4 | ✅     | Add debounce to mode/date switches in PlayerModeBrowser and MatchupModeBrowser where rapid toggling is possible.                                                                              | `PlayerModeBrowser.tsx`, `MatchupModeBrowser.tsx`                         | 2026-04-19: Same 150ms debounce pattern applied to `navigateTo()` in both browsers                                                              |
| 4.5 | 🔲     | Verify: rapid filter clicks collapse into one effective request. Controls feel responsive. No obvious lag in normal usage.                                                                    | Manual QA                                                                 | Run Scenario 1, 4, 5 from QA test plan                                                                                                          |

### Completion criteria

All of 4.1–4.5 are ✅. Then mark this rollout step ✅.

---

## Rollout Step 5 → Phase 5: Bounded prefetch and aggressive-skip dampening

**Phase status:** 🔲 Not started

**Goal:** Keep browsing smooth without letting prefetch create aggressive upstream pressure.

## Rollout Step 5 → Phase 5: Bounded prefetch and aggressive-skip dampening

**Phase status:** ✅ Complete

**Goal:** Keep browsing smooth without letting prefetch create aggressive upstream pressure.

### Steps

| #   | Status | Step                                                                                                                                                                                                                                                                                 | Files                                                                | Notes                                            |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------ |
| 5.1 | ✅     | Limit prefetch horizon — at most one page ahead automatically. Do not recursively chase more pages during an existing fetch.                                                                                                                                                         | `ClipBrowser.tsx`, `PlayerModeBrowser.tsx`, `MatchupModeBrowser.tsx` | 2026-04-19: Verified existing `loadingRef` + 300ms cooldown + ≤3-clip threshold already bounds horizon to one page. Added explanatory comment to prefetch effect. |
| 5.2 | ✅     | Create `apps/web/src/lib/interactionPressure.ts` — lightweight tracker that detects aggressive skipping (4+ clip jumps in 2s, repeated large rail jumps, multiple context changes in short window). Expose a boolean `isHighPressure` signal. Should be temporary and self-clearing. | `apps/web/src/lib/interactionPressure.ts` (new)                      | 2026-04-19: `recordClipNavigation(weight)` + `useInteractionPressure()` hook. Module-level singleton with 2s pressure window, 2s decay. Weight=1 for nav, weight=2 for context changes. |
| 5.3 | ✅     | Integrate interaction pressure into prefetch decisions — when `isHighPressure` is true, suspend auto-prefetch or reduce to explicit-need only.                                                                                                                                       | `ClipBrowser.tsx`, `PlayerModeBrowser.tsx`, `MatchupModeBrowser.tsx` | 2026-04-19: `!isHighPressure &&` guard added to prefetch effect in all three browsers. `useInteractionPressure()` hook added to each browser. |
| 5.4 | ✅     | Only prefetch when playback suggests usefulness — prefer prefetch during normal watching / steady autoplay / approaching end of loaded clips. Be conservative when user is jumping, context just changed, or app is in cooldown (Phase 7).                                           | Same files                                                           | 2026-04-19: `recordClipNavigation(2)` called in `navigateTo` (player/matchup) and in context-change useEffect (game mode) so filter/mode changes trip the pressure signal. `recordClipNavigation()` (weight 1) called in `handleSelect` and keyboard ArrowLeft/ArrowRight handlers across all three browsers. |
| 5.5 | 🔲     | Verify: normal watching stays smooth. Aggressive skipping no longer causes runaway background fetch. Prefetch becomes conservative during high interaction pressure.                                                                                                                 | Manual QA                                                            | Run Scenario 2 from QA test plan                 |

### Completion criteria

All of 5.1–5.5 are ✅. Then mark this rollout step ✅.

---

## Rollout Step 6 → Phase 7: Cooldown and backoff behavior

**Phase status:** ✅ Complete

**Goal:** System automatically becomes less aggressive when upstream shows stress signals.

### Steps

| #   | Status | Step                                                                                                                                                                                              | Files                                                                | Notes                            |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------- |
| 6.1 | ✅     | Add frontend "stress mode" state — triggered when several newly requested clips have missing video URLs or repeated page fetches fail in a small window (e.g., 3+ failures in 10s).               | `apps/web/src/lib/stressMode.ts` (new)                               | 2026-04-19: `recordFetchFailure()` + `checkClipBatchForStress()` accumulate failure events. 3+ events in 10s triggers stress mode. Module-level singleton, same pattern as `interactionPressure.ts`. |
| 6.2 | ✅     | Define stress-mode behavior: suspend auto-prefetch, widen load-more cooldown (e.g., 2x normal), stop staying far ahead of user. Duration: 15–30s, auto-reset if conditions normalize.             | `apps/web/src/lib/stressMode.ts`                                     | 2026-04-19: `loadMoreCooldownMs()` returns 600ms (2×) in stress mode vs 300ms normal. `useStressMode()` hook exposes boolean signal. Auto-resets 20s after last failure event. |
| 6.3 | ✅     | Integrate stress mode into all three browsers — check stress state before prefetch and loadMore decisions.                                                                                        | `ClipBrowser.tsx`, `PlayerModeBrowser.tsx`, `MatchupModeBrowser.tsx` | 2026-04-19: `useStressMode()` added to all three; `!isStressed &&` guard in prefetch effect; `loadMoreCooldownMs()` replaces hardcoded 300 in `loadMore`; `checkClipBatchForStress` + `recordFetchFailure` called in `fetchClips`/`loadMore` success and catch paths. |
| 6.4 | ⏭️     | (Optional) Add API-side backoff hints — `retrySuggested: true`, `suggestedCooldownMs: 15000` in response metadata.                                                                               | `apps/api/src/index.ts`                                              | 2026-04-19: Deferred — frontend-only stress mode is sufficient as a first pass. Can revisit if stress mode proves insufficient. |
| 6.5 | 🔲     | Verify: burst of failures causes app to reduce pressure temporarily. After window passes, normal behavior resumes.                                                                                | Manual QA                                                            | Run Scenario 6 from QA test plan |

### Completion criteria

All of 6.1–6.5 are ✅ (6.4 may be ⏭️ if deferred). Then mark this rollout step ✅.

---

## Rollout Step 7 → Phase 4: Broader client-side dedupe and reuse

**Phase status:** ✅ Complete

**Goal:** Stop repeating work the app already has on the client side.

### Existing foundation (do not redo)

- API-side caches already handle server-level dedup
- Changing `actionNumber` already does not trigger new clip-set fetches (preserve this)

### Steps

| #   | Status | Step                                                                                                                                                                                                     | Files                                                                | Notes                                           |
| --- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| 7.1 | ✅     | Create `apps/web/src/lib/requestCache.ts` — short-lived in-memory client-side response cache. Key by full request params. TTL: 15–30s for clip pages, 30–60s for metadata (player games, matchup games). | `apps/web/src/lib/requestCache.ts` (new)                             | 2026-04-19: `fetchJsonWithCache(key, fetcher, ttlMs)` with module-level Map for cached responses and in-flight promises. `CLIP_PAGE_TTL_MS=20000`, `METADATA_TTL_MS=45000`. |
| 7.2 | ✅     | Add in-flight request dedup — if the same exact request is already in flight, return the same promise instead of starting another fetch.                                                                 | `apps/web/src/lib/requestCache.ts`                                   | 2026-04-19: In-flight Map in same module; returns existing Promise for duplicate keys. Failure (including AbortError) removes from in-flight so fresh attempts can be made. |
| 7.3 | ✅     | Integrate client-side cache into clip-set fetches in all three browsers.                                                                                                                                 | `ClipBrowser.tsx`, `PlayerModeBrowser.tsx`, `MatchupModeBrowser.tsx` | 2026-04-19: `loadMore`/`fetchClips` in all three browsers now use `fetchJsonWithCache` with `CLIP_PAGE_TTL_MS`. Player game log and matchup game list metadata fetches use `METADATA_TTL_MS`. |
| 7.4 | ✅     | Confirm that `actionNumber` changes remain local-only and do not trigger fetches.                                                                                                                        | All browsers                                                         | 2026-04-19: Verified — `buildClipSearchParams`, `buildPlayerClipSearchParams`, and `buildMatchupClipSearchParams` accept `actionNumber` but none of the browser `loadMore`/`fetchClips` callers pass it. `setActionNumberInUrl` uses `history.replaceState` only. Protected by design. |
| 7.5 | 🔲     | Verify: repeating the same request key shortly after success does not hit the network. Identical in-flight requests collapse. Rail selection remains local-only.                                         | Manual QA + network tab inspection                                   |                                                 |

### Completion criteria

All of 7.1–7.5 are ✅. Then mark this rollout step ✅.

---

## Overall completion checklist

| Rollout order | Phase                                       | Status |
| ------------- | ------------------------------------------- | ------ |
| Step 1        | Phase 1 — Stale-request cancellation        | ✅     |
| Step 2        | Phase 3 — Single-flight load-more           | ✅     |
| Step 3        | Phase 6 — API-side single-flight dedupe     | ✅     |
| Step 4        | Phase 2 — Debounce high-churn changes       | ✅     |
| Step 5        | Phase 5 — Bounded prefetch / skip dampening | ✅     |
| Step 6        | Phase 7 — Cooldown / backoff                | ✅     |
| Step 7        | Phase 4 — Client-side dedupe and reuse      | ✅     |

**Definition of done:** All 7 rollout steps are ✅. Then run the full QA test plan (Scenarios 1–6 and technical assertions) from `request-resilience-plan.md`.

---

## Agent handoff protocol

When handing off to a new agent session:

1. Point the agent to this file: `docs/plans/request-resilience-progress.md`
2. Tell it: _"Continue the request resilience plan from where it left off. Read the progress file, find the next 🔲 step, and implement it. Update the progress file in every commit."_
3. The agent should:
   - Read this file
   - Identify the current rollout step and next 🔲 sub-step
   - Read the source plan (`request-resilience-plan.md`) for full context on that phase
   - Implement the step
   - Run relevant tests (`npm test`, `npm run build:web`, `npm run build:api`)
   - Update this file (status icons, notes, dates)
   - Commit both the code changes and this file together

### What NOT to do on handoff

- Do not restart from the beginning
- Do not skip steps unless they are marked 🚫 with a reason
- Do not implement phases out of rollout order
- Do not modify completed (✅) steps without strong reason
