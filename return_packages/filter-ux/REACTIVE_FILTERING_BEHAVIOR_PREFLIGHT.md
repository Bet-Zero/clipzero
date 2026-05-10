# Reactive Filtering Behavior Preflight

## 1. Executive Summary

This preflight reviewed reactive filter behavior in game, player, and matchup modes with a strict action->reaction lens.

Overall assessment:

- The current implementation is close and has strong foundations (optimistic control updates, scoped transition flags, request generation guards, and distinct load-more behavior).
- A narrow implementation pass is still recommended for one high-severity issue and two medium-severity UX consistency issues.

Primary risk:

- Transition state can be triggered for no-op clicks and remain visible until fallback clear (up to 10 seconds), which makes the UI feel stuck even though intent did not meaningfully change.

## 2. Current Behavior Map By Mode

### Game mode

Intent path:

- Filter action in FilterBar starts transition immediately via beginFilterTransition("game").
- URL push is debounced by 150ms.
- ClipBrowser reads transition state and fully swaps clip rail + player to an "Updating clips..." skeleton while pending.
- Transition clears when ClipBrowser receives new context props and runs its context-sync effect.

Observed behavior quality:

- Immediate acknowledgement is strong.
- Replacement behavior is very explicit.
- Pagination remains non-replacement (rail stays visible; only load-more indicator appears).

### Player mode

Intent path:

- Filter/player/exclusion actions call navigateTo(), immediately beginFilterTransition("player"), and optimistically update filter control values.
- URL push is debounced by 150ms.
- isReplacing = isTransitionPending || initialLoading; content area is replaced by loading skeleton during replacement.
- Transition clears on non-append fetch completion (finally block) or explicit empty-context paths.

Observed behavior quality:

- Immediate control reaction is strong.
- Replacement state is generally accurate for full refetches.
- Game exclusions are incorporated correctly into replacement fetch flow.

### Matchup mode

Intent path:

- Team/filter/exclusion actions call navigateTo(), immediately beginFilterTransition("matchup"), and optimistically update controls.
- URL push is debounced by 150ms.
- isReplacing = isTransitionPending || initialLoading; content area is replaced by loading skeleton.
- Transition clears on non-append fetch completion (finally block) or explicit invalid/empty-context paths.

Observed behavior quality:

- Immediate acknowledgement is strong.
- Replacement and empty/loading branches are logically structured.
- Team selection, game exclusions, and filter overlays use a consistent transition model.

## 3. Action/Reaction Table

| User action                                    | Immediate state change                                                   | Visible reaction                                                               | Delayed state change                                          | Risk/mismatch                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Game mode filter toggle/select                 | beginFilterTransition("game") + optimistic pending values                | Controls reflect selection immediately; content switches to replacing skeleton | Debounced router.push after 150ms                             | If final URL equals current state, transition may linger until fallback clear |
| Game mode clear filters                        | begin transition + pending cleared values                                | Controls clear immediately; content replaced                                   | Immediate push (not debounced in clear path)                  | Low; behavior is clear but can still over-hide content                        |
| Player mode playType/opponent/filter change    | beginFilterTransition("player") + optimistic values                      | Controls update immediately; replacing skeleton shown                          | Debounced push then non-append fetch; clear on fetch finalize | Over-eager full replacement can feel choppy on rapid taps                     |
| Player mode game/date exclusion toggle         | begin transition + exclusion state update                                | Games count chip changes; replacing skeleton for clip area                     | Debounced push and refetch                                    | Correct but heavy-handed for fast repeated toggles                            |
| Matchup mode team A/B selection                | begin transition + local reset of games/clips                            | Immediate control update; replacing/empty/loading branch updates               | Debounced push and follow-up games/clips fetch                | Correct but can look jumpy when switching teams quickly                       |
| Matchup mode team filter/playType/quarter/etc. | begin transition + optimistic values                                     | Immediate control feedback; replacing skeleton                                 | Debounced push then refetch                                   | Same no-op + over-hide risk as other modes                                    |
| Any mode load more (pagination)                | loadingRef/clipsLoading true (no beginFilterTransition)                  | Existing clips remain; inline loading or retry shown in rail                   | Append fetch updates clip list                                | Good separation from filter replacement; low risk                             |
| Rapid repeated filter clicks                   | Multiple begin calls; pending overrides merged; latest URL wins debounce | Immediate visual acknowledgement each click                                    | Single final push after debounce window                       | Can feel choppy due repeated full replacement state transitions               |

## 4. Findings Table

| Finding ID | Severity | File/path                                                                                                                                                                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                              | Why it feels choppy/confusing                                                                                                               | Recommended fix                                                                                                                                                                                                                     |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-001     | High     | apps/web/src/lib/filterTransition.ts, apps/web/src/components/FilterBar.tsx, apps/web/src/components/PlayerModeBrowser.tsx, apps/web/src/components/MatchupModeBrowser.tsx | Fallback clear is 10s in filterTransition (line 7). beginFilterTransition is called immediately in each mode (FilterBar line 511, PlayerModeBrowser line 778, MatchupModeBrowser line 804). Active-value buttons still call navigate even when already selected (FilterBar line 893 with active check line 896; PlayerModeBrowser around lines 1221-1230; MatchupModeBrowser around lines 1161-1170). | A no-op click can still enter replacing state; if no real context change occurs, pending can persist until fallback timer, appearing stuck. | Add no-op guards before beginFilterTransition/router push: compare computed next URL/state vs current and return early. Also disable pointer interaction on already-active single-select buttons.                                   |
| RF-002     | Medium   | apps/web/src/components/ClipBrowser.tsx, apps/web/src/components/PlayerModeBrowser.tsx, apps/web/src/components/MatchupModeBrowser.tsx                                     | Replacing UI fully swaps out content: ClipBrowser uses isReplacing = isTransitionPending (line 464) and skeleton branch (line 468+). Player/Matchup similarly use isReplacing = isTransitionPending                                                                                                                                                                                                   |                                                                                                                                             | initialLoading (Player line 1020, Matchup line 940) with replacing branches (Player line 1398+, Matchup line 1296+).                                                                                                                | Immediate full content replacement on every filter intent can make the app feel slower than it is, especially during rapid debounced edits where old context could remain visible with a pending treatment. | Keep current structure but reduce full-hide cases: retain clip rail/player frame during brief pending and apply lightweight loading affordance using existing classes/patterns. Reserve full skeleton for long initial loads only. |
| RF-003     | Medium   | apps/web/src/lib/filterTransition.test.ts, apps/web/e2e/smoke.spec.ts                                                                                                      | Unit tests cover helper-only pending/clear/fallback behavior; no integration assertions for no-op click behavior, transition clear timing, or rapid multi-click filter churn.                                                                                                                                                                                                                         | Regressive reactive mismatches can reappear without test detection; UX feels inconsistently reliable.                                       | Add frontend-only tests (mocked router/fetch) for: no-op click does not set pending, pending clears on successful replacement, pending does not clear early, rapid click final-state correctness, pagination remains non-replacing. |

## 5. Already Good (Do Not Change)

- Scoped transition channels (game/player/matchup) are independent and correctly modeled.
- Optimistic filter control rendering gives immediate acknowledgement before URL round-trip.
- Debounced push behavior (150ms) correctly collapses rapid intent bursts.
- Request generation + abort handling in player/matchup prevents stale response application.
- Pagination/load-more behavior is correctly separate from filter replacement and keeps existing content visible.
- Error and retry handling in clip rail is practical and should remain.

## 6. Clear Answer

Do we need another implementation pass, or is the current transition behavior enough?

Answer: another narrow implementation pass is recommended.

Reason: the no-op transition/stuck-pending risk (RF-001) is behaviorally significant and directly impacts user trust in action->reaction correctness.

## 7. Narrow Execution Plan (Reactive Behavior Only)

1. Add no-op transition guard in each mode before beginFilterTransition:

- Compute next canonical URL/state first.
- If unchanged from current URL/state, return early.

1. Prevent redundant intent on active single-select controls:

- For active option buttons, no-op click handler or disabled state using existing classes only.

1. Tune replacement threshold with existing visual language:

- Keep current skeleton components.
- Show full skeleton only for initial/long replacement.
- For short pending windows, keep content frame visible with lightweight pending indicator.

1. Add frontend-only regression tests:

- Unit/integration tests for transition begin/clear timing and no-op clicks.
- Mocked Playwright/Vitest scenarios for rapid click collapse, replacement correctness, and pagination non-replacement behavior.

## 8. Visual/Design-Heavy Change Check

No design-heavy additions are required.

Any future implementation should keep current visual language and classes, and avoid redesigning layout, spacing, typography, or branding.

## 9. Validation Recommendations (No API/Backend Required)

- Add Vitest component-level tests with mocked router and mocked fetch:
  - no-op clicks do not enter pending
  - pending enters immediately on meaningful change
  - pending clears only after replacement completion (or explicit empty-context branch)
  - rapid multi-click resolves to final intended state
- Add Playwright mocked-route tests per mode to assert:
  - control state updates immediately
  - replacement state appears only when appropriate
  - old clips are not presented as current during active replacement
  - load-more remains append-only behavior (not replacement)
- Keep smoke tests API-independent by routing clips/game logs/matchup endpoints to fixtures.

---

RETURN PACKAGE TO PASTE BACK

- Path: return_packages/filter-ux/REACTIVE_FILTERING_BEHAVIOR_PREFLIGHT.md
- Top 3 reactive UX findings:
  - RF-001 High: no-op interactions can trigger pending replacement and remain until fallback clear
  - RF-002 Medium: full replacement on every intent can over-hide content and feel slower/choppy
  - RF-003 Medium: missing integration coverage for transition timing and rapid-intent behavior
- Whether execution is needed: Yes, narrow frontend-only reactive behavior pass recommended
- Specific do-not-change areas:
  - scoped transition model by mode
  - optimistic immediate control feedback pattern
  - load-more append behavior and retry pattern
  - existing visual language (no redesign)
