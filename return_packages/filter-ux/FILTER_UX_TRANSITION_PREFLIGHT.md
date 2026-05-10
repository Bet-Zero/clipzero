# FILTER_UX_TRANSITION_PREFLIGHT

## 1. Executive summary

ClipZero already has strong request-resilience mechanics (generation guards, aborts, debounce, load-more single-flight), but filter transition UX still feels stale because UI optimism is mostly applied to controls/URL intent, not to clip-content transition state.

Primary issue pattern:

- Filter controls update immediately via optimistic pending state.
- Navigation/fetch is delayed (150ms debounce + router round-trip).
- During that gap, old clips remain visible with little or no stale/in-transition indication.

This is most pronounced in:

- Game mode: no explicit initial replacement loading state in the clip display path.
- Matchup mode: old clips are intentionally preserved while `initialLoading` is true, and still rendered.

Net: users can see controls reflecting a new filter while clip content still reflects the prior context, creating uncertainty that the change applied.

## 2. Current filter flow map by mode

### Game mode

Flow:

1. Filter interaction calls `navigate(overrides)` in FilterBar.
2. `setPending` updates optimistic control state immediately.
3. URL push is debounced 150ms.
4. Router navigation eventually delivers new server-rendered props to ClipBrowser.
5. ClipBrowser context effect resets local state from incoming `initial*` props.
6. Clip rail/player rerender with new clips.

Evidence:

- Optimistic control state and `p()` param accessor: `apps/web/src/components/FilterBar.tsx:398-413`
- Debounced push (150ms): `apps/web/src/components/FilterBar.tsx:509-568`
- Game clip context reset from fresh props: `apps/web/src/components/ClipBrowser.tsx:149-178`
- Clip viewer always renders rail/player; no separate initial replacement branch: `apps/web/src/components/ClipBrowser.tsx:458-490`

UX implication:

- Between step 2 and step 5, old clips can remain on screen without explicit "refreshing to new filter" state.

### Player mode

Flow:

1. Filter interaction calls `navigateTo(overrides)`.
2. `setPending` immediately updates optimistic filter controls.
3. URL push is debounced 150ms.
4. Effect dependencies change after params round-trip, triggering `fetchClips(0, false)`.
5. `initialLoading` becomes true for offset 0 and replaces viewer with skeleton.
6. New clips replace prior set.

Evidence:

- Optimistic state and `p()` accessor: `apps/web/src/components/PlayerModeBrowser.tsx:202-216`
- Debounced URL push: `apps/web/src/components/PlayerModeBrowser.tsx:765-807`
- Initial fetch state flags: `apps/web/src/components/PlayerModeBrowser.tsx:414-418`
- Offset-0 full replacement behavior: `apps/web/src/components/PlayerModeBrowser.tsx:493-513`
- Initial skeleton and clip viewer gating: `apps/web/src/components/PlayerModeBrowser.tsx:1386-1402`, `apps/web/src/components/PlayerModeBrowser.tsx:1431-1463`

UX implication:

- Better than game/matchup once fetch starts, but there is still a debounce+router gap where controls can change before clip content transitions.

### Matchup mode

Flow:

1. Filter interaction calls `navigateTo(overrides)`.
2. `setPending` immediately updates optimistic filter controls.
3. URL push is debounced 150ms.
4. Effect triggers `fetchClips(0, false)`.
5. `initialLoading` becomes true.
6. Existing clips are not cleared on offset 0; clip rail/player remain rendered with `loading` true.
7. New clips replace prior set when response lands.

Evidence:

- Optimistic state and `p()` accessor: `apps/web/src/components/MatchupModeBrowser.tsx:315-325`
- Debounced URL push: `apps/web/src/components/MatchupModeBrowser.tsx:792-835`
- Initial fetch state flags: `apps/web/src/components/MatchupModeBrowser.tsx:460-464`
- Offset-0 replacement without pre-clear: `apps/web/src/components/MatchupModeBrowser.tsx:535-551`
- Rail remains rendered during initial loading: `apps/web/src/components/MatchupModeBrowser.tsx:1287-1294`

UX implication:

- Strong stale-visual risk: old clips remain visible while new filter request is in-flight.

## 3. State inventory

### Filter state

- Game mode FilterBar derives filters from `p()` (optimistic override first, URL fallback): `apps/web/src/components/FilterBar.tsx:411-437`
- Player mode derives from `p()` similarly: `apps/web/src/components/PlayerModeBrowser.tsx:215-229`
- Matchup mode derives from `p()` similarly: `apps/web/src/components/MatchupModeBrowser.tsx:323-339`

### Optimistic pending state

- Game mode: `pending` + `setPending` immediate on navigate: `apps/web/src/components/FilterBar.tsx:398-416`, `apps/web/src/components/FilterBar.tsx:509-516`
- Player mode: `pending` + `setPending` in `navigateTo`: `apps/web/src/components/PlayerModeBrowser.tsx:202-214`, `apps/web/src/components/PlayerModeBrowser.tsx:789-796`
- Matchup mode: `pending` + `setPending` in `navigateTo`: `apps/web/src/components/MatchupModeBrowser.tsx:315-325`, `apps/web/src/components/MatchupModeBrowser.tsx:817-824`

### Router/search param state

- Game mode debounced push: `apps/web/src/components/FilterBar.tsx:560-568`
- Player mode debounced push: `apps/web/src/components/PlayerModeBrowser.tsx:798-806`
- Matchup mode debounced push: `apps/web/src/components/MatchupModeBrowser.tsx:826-834`
- URL composition helpers: `apps/web/src/lib/filters.ts:261-336`

### Clip loading state

- Game mode: `loading` tracks load-more operations in ClipBrowser: `apps/web/src/components/ClipBrowser.tsx:93`, `apps/web/src/components/ClipBrowser.tsx:227-248`, `apps/web/src/components/ClipBrowser.tsx:349-352`
- Player mode: split `initialLoading` vs `clipsLoading`: `apps/web/src/components/PlayerModeBrowser.tsx:197-199`, `apps/web/src/components/PlayerModeBrowser.tsx:414-418`
- Matchup mode: split `initialLoading` vs `clipsLoading`: `apps/web/src/components/MatchupModeBrowser.tsx:310-312`, `apps/web/src/components/MatchupModeBrowser.tsx:460-464`

### Visible clip state

- Game mode visible clips from `clips` state, reset on new incoming props: `apps/web/src/components/ClipBrowser.tsx:84`, `apps/web/src/components/ClipBrowser.tsx:167-170`
- Player mode visible clips from `clips` state, full replace on offset 0: `apps/web/src/components/PlayerModeBrowser.tsx:191`, `apps/web/src/components/PlayerModeBrowser.tsx:493-499`
- Matchup mode visible clips from `clips` state, full replace on offset 0: `apps/web/src/components/MatchupModeBrowser.tsx:305`, `apps/web/src/components/MatchupModeBrowser.tsx:535-539`

### Active clip state

- Game mode `activeIndex`: `apps/web/src/components/ClipBrowser.tsx:97-103`, `apps/web/src/components/ClipBrowser.tsx:178`
- Player mode `activeIndex`: `apps/web/src/components/PlayerModeBrowser.tsx:200`, `apps/web/src/components/PlayerModeBrowser.tsx:506-513`
- Matchup mode `activeIndex`: `apps/web/src/components/MatchupModeBrowser.tsx:313`, `apps/web/src/components/MatchupModeBrowser.tsx:542-551`

## 4. Findings table

| Finding ID | Severity | File/path | Evidence with line references | UX impact | Recommended fix |
|---|---|---|---|---|---|
| F-01 | High | apps/web/src/components/FilterBar.tsx, apps/web/src/components/ClipBrowser.tsx | Controls update optimistically immediately (`FilterBar.tsx:398-416`, `FilterBar.tsx:509-516`) while navigation is delayed 150ms (`FilterBar.tsx:560-568`). Game clip display has no dedicated transition state for filter replacement (`ClipBrowser.tsx:458-490`). | Users can see new filter selection with old clips still visible, reducing confidence the change registered. | Add a shared "filter transition pending" signal that starts at optimistic intent and is consumed by clip display; show a transition overlay/skeleton for full-set replacement. |
| F-02 | High | apps/web/src/components/MatchupModeBrowser.tsx | On offset 0 fetch, `initialLoading` is set (`MatchupModeBrowser.tsx:460-464`) but clip rail/player still render (`MatchupModeBrowser.tsx:1287-1301`) with `loading` only passed to rail (`MatchupModeBrowser.tsx:1292`). | Old matchup clips remain visible during new-filter fetch, making transition feel stale/choppy. | Mirror player-mode gating: for full replacement loads, swap to dedicated loading shell and hide previous clip content until new set commits. |
| F-03 | Medium | apps/web/src/components/PlayerModeBrowser.tsx | Debounced push + optimistic controls (`PlayerModeBrowser.tsx:765-807`) precede `initialLoading` activation (`PlayerModeBrowser.tsx:414-418`, triggered by effect `PlayerModeBrowser.tsx:578-605`). | A short "optimistic controls vs old clips" window still exists before skeleton appears. | Start transition UI at intent-time (on navigateTo) rather than fetch-start-time only; keep request debounce but visibly mark content as updating immediately. |
| F-04 | Medium | apps/web/src/components/ClipRail.tsx | Empty state only when `clips.length === 0 && !loading` (`ClipRail.tsx:73-77`), generic loading chip (`ClipRail.tsx:119-123`), no stale-state variant. | Empty/loading/stale are not clearly separated in shared rail primitives; stale can masquerade as active content with minor loading text. | Add explicit stale/pending visual state in rail API, distinct from pagination loading and empty results. |
| F-05 | Medium | apps/web/src/components/ClipBrowser.tsx, apps/web/src/components/PlayerModeBrowser.tsx, apps/web/src/components/MatchupModeBrowser.tsx | Request resilience is implemented (generation/abort/discard in all three loaders: `ClipBrowser.tsx:250-353`, `PlayerModeBrowser.tsx:422-557`, `MatchupModeBrowser.tsx:468-595`) but these states are not surfaced to user-facing transition feedback. | System is technically safe, but user trust lags because request lifecycle is invisible. | Expose a tiny shared transition contract (`isFilterTransitionPending`, `isPaginating`, `isStaleVisible`) and consume it in rail/player shell. |
| F-06 | Medium | apps/web/src/components/FilterBar.tsx, apps/web/src/components/PlayerModeBrowser.tsx, apps/web/src/components/MatchupModeBrowser.tsx | Same debounce + optimistic pattern is duplicated in three places (`FilterBar.tsx:472-568`, `PlayerModeBrowser.tsx:233-235` and `765-807`, `MatchupModeBrowser.tsx:346-348` and `792-835`). | Drift risk and inconsistent transition UX across modes increases over time. | Extract a small shared hook for optimistic pending + debounced navigation + transition tokening. |
| F-07 | Low | docs/plans/request-resilience-progress.md | Contradictory Step 5 status appears both "Not started" and "Complete" in same section (`request-resilience-progress.md:170`, `request-resilience-progress.md:176`). | Docs can mislead execution planning and QA confidence. | Reconcile the progress doc before execution task so implementation status is unambiguous. |

## 5. Specific answer: Why can old clips remain on screen after a filter change?

Old clips can remain visible because filter controls are updated optimistically immediately, while clip-content replacement waits on debounced navigation and fetch completion.

Mechanically:

- Optimistic control state updates first (`setPending`) in all modes: `FilterBar.tsx:509-516`, `PlayerModeBrowser.tsx:789-796`, `MatchupModeBrowser.tsx:817-824`.
- Navigation is delayed by 150ms debounce: `FilterBar.tsx:563-568`, `PlayerModeBrowser.tsx:801-806`, `MatchupModeBrowser.tsx:829-834`.
- Clip replacement happens later, after URL/effect/fetch pipeline.
- In matchup mode specifically, previous clips remain rendered even when `initialLoading` is true: `MatchupModeBrowser.tsx:460-464`, `MatchupModeBrowser.tsx:1287-1294`.
- In game mode there is no dedicated full replacement loading branch in ClipBrowser render path: `ClipBrowser.tsx:458-490`.

So the app is request-resilient, but transition-state UX is not consistently explicit.

## 6. Recommended implementation plan for the next Execution task

1. Introduce a tiny shared transition helper (hook):
   - Inputs: optimistic-intent event, route-commit event, fetch-start/fetch-end.
   - Outputs: `isTransitionPending`, `isFullSetReplacing`, `isPaginating`.

2. Standardize semantics across modes:
   - Full-set replacement (filter/context change, offset 0): show replacement shell/overlay and suppress stale content.
   - Pagination (`loadMore`): keep current clips visible and show rail-level loading.

3. Apply to Game mode first:
   - Wire FilterBar intent to game clip display transition state.
   - Add explicit replacement UI branch in ClipBrowser, separate from load-more loading.

4. Align Matchup mode with Player mode for initial replacement:
   - Do not keep old rail/player as primary content during `initialLoading`.
   - Use same replacement shell treatment.

5. Keep request-resilience mechanics unchanged:
   - Preserve generation/abort/discard logic and debounce timings.
   - Avoid any change that increases request volume.

6. Consolidate duplicated debounce/optimistic logic:
   - Extract shared helper used by FilterBar, PlayerModeBrowser, MatchupModeBrowser.

7. Update docs:
   - Fix contradictory progress status in `request-resilience-progress.md` before/with execution.

## 7. Suggested acceptance criteria

1. After any filter change, visible clip area shows an immediate transition indicator within one frame (no ambiguous stale state).
2. Full-set replacement state is visually distinct from pagination loading.
3. Old clips are not shown as primary active content during full replacement fetch in any mode.
4. Controls remain immediately responsive and debounce still collapses rapid filter changes.
5. Request count behavior remains unchanged or lower under stress interactions.
6. Game, player, and matchup modes use consistent transition semantics.
7. Empty state, loading state, and stale/transition state are visually distinct.

## 8. Suggested manual QA checklist

1. Game mode: rapidly toggle quarter/team/play-type filters; verify immediate transition feedback in clip area and no stale-content ambiguity.
2. Game mode: apply multiple filters within 150ms; verify only final query wins and UI clearly indicates pending replacement.
3. Player mode: change filters repeatedly; verify transition indicator appears immediately (not only after fetch starts) and old clips are not presented as current.
4. Matchup mode: toggle filters with loaded clips; verify old clips are not shown as active content during replacement load.
5. All modes: trigger load-more via rail end; verify this uses pagination loading treatment (not full replacement shell).
6. All modes: verify empty results, loading, and transition-pending are clearly different.
7. Stress interaction (rapid filter + rail navigation): verify no request storms and no confusing stale display.
8. Keyboard navigation and clip selection: verify unaffected responsiveness.

## 9. Risks or stop conditions

- Stop condition check: all target files were found; no missing-file block.
- Multiple filter systems exist (game FilterBar vs player/matchup in-component systems); this audit kept them separate and did not merge assumptions.
- Documentation contradiction found: `docs/plans/request-resilience-progress.md` shows conflicting status for Step 5 (`:170` vs `:176`).
- Execution risk: adding visual transition states without clear semantics could regress perceived speed; keep distinction between full replacement and pagination explicit.
- Execution risk: if transition helper leaks into request logic, it may unintentionally alter request cadence; treat as presentation/state-coordination only.

## Audit question checklist (direct answers)

1. Immediate vs delayed state updates:

- Immediate: optimistic pending filter controls (`setPending`) in all modes.
- Delayed: router/search params and new clip data application.

1. Does clip display know clips are stale vs latest request?

- Not explicitly as a first-class UI state. Technical stale prevention exists (generation/abort), but visual stale-state signaling is inconsistent.

1. Old clips preserved intentionally or accidental?

- Mixed.
- Matchup mode effectively preserves old clips during initial replacement (`ClipRail` still rendered during `initialLoading`).
- Player mode hides viewer during `initialLoading`, but stale window remains before that flag turns on.
- Game mode relies on route-to-props replacement with no dedicated transition state.

1. Loading states only for pagination or also full replacement?

- Game mode mostly pagination-like loading in rail.
- Player mode includes full replacement loading shell.
- Matchup mode sets full replacement loading flag but still renders clip viewer.

1. Does `initialLoading` affect main display/rail/controls?

- Player: yes (gates clip viewer and shows skeleton).
- Matchup: partially (passed to rail loading) but viewer remains.
- Game: no `initialLoading` concept in ClipBrowser.

1. Mode consistency?

- No. Player and matchup diverge on full replacement presentation; game diverges further.

1. Optimistic controls but no visible clip transition?

- Yes, all three can exhibit this window due to immediate `setPending` + debounced push.

1. Empty/loading/stale visually distinct?

- Empty/loading exist; stale/transition-pending is not consistently distinct.

1. Duplicated patterns to share?

- Yes: optimistic pending + debounced navigation appears in three components.

1. Exact UX changes to feel instantly responsive without request storms?

- Add immediate transition-pending visual state at intent time.
- Keep debounce and request-resilience logic unchanged.
- Separate full replacement vs pagination visuals.
- Share transition helper to enforce consistent behavior across modes.
