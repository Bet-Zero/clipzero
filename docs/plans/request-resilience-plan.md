# ClipZero Request Resilience Plan

## Purpose

This document is the implementation plan for making ClipZero resilient to heavy user interaction patterns that can overwhelm upstream NBA endpoints or trigger placeholder / missing-video behavior.

This plan is specifically about **protecting the app from bursty user behavior** and **reducing unnecessary upstream request pressure**.

This is **not** the diagnosis/classification plan. That should be implemented separately.

---

## Product goal

ClipZero's priority is:

> Get the user to exactly the clips they want with the least friction possible.

That means the app should tolerate normal impatient behavior such as:

- skipping through the rail quickly
- changing filters repeatedly
- switching dates quickly
- switching modes quickly
- opening a clip set and immediately moving somewhere else

Users should not be able to accidentally create a request storm that degrades playback or causes placeholder videos.

---

## Problem statement

Today, the app can produce bursts of upstream activity when the user:

- changes filters rapidly
- changes page context before prior requests settle
- skips through clips aggressively
- triggers repeated load-more behavior
- moves between game / player / matchup mode quickly

This likely contributes to one or more of the following:

- too many upstream requests in a short window
- repeated asset lookups for stale views the user no longer cares about
- overlapping load-more chains
- repeated prefetch work that is no longer useful
- increased likelihood of NBA placeholder video responses
- degraded playback reliability during active use

The fix is not one change. It is a layered resilience system.

---

## High-level strategy

Implement the following layers:

1. **Stale-request cancellation / invalidation**
2. **Debouncing for high-churn navigational changes**
3. **Strict single-flight rules for load-more and clip-set fetches**
4. **Aggressive dedupe and local reuse of already-fetched results**
5. **Bounded prefetching**
6. **Cooldown / backoff behavior after upstream stress signals**
7. **UI behavior that prefers stability over aggressiveness**

The end result should be:

- only the newest user intent matters
- stale requests do not continue causing side effects
- repeated requests for the same thing are deduped
- load-more cannot stack into a burst
- prefetch never outruns usefulness
- the app becomes more conservative when upstream starts failing

---

## Scope

### In scope

Frontend and API changes affecting:

- game mode clip loading
- player mode clip loading
- matchup mode clip loading
- filter changes
- mode/date/game navigation
- rail skip behavior
- prefetch behavior
- load-more behavior
- temporary behavior after asset failures

### Out of scope

- full failure diagnosis / root-cause classification
- deep observability dashboards
- NBA endpoint replacement
- new product features unrelated to resilience

---

## Principles

### 1. Newest intent wins

If the user has moved on, old requests must not keep doing work that matters.

### 2. Do not let speed create storms

Fast clicking is normal. The app should smooth it out.

### 3. Protect playback first

If there is a tradeoff between aggressive prefetching and reliability, reliability wins.

### 4. Avoid hidden request multiplication

Multiple UI paths should not accidentally trigger the same upstream work in parallel.

### 5. Be conservative under stress

When upstream starts failing, the app should reduce pressure automatically.

---

## Implementation plan

# Phase 1 — Frontend stale-request control

## Goal

Prevent outdated fetches from continuing to matter after the user has already changed context.

## Why

Right now, rapid mode/filter/date changes can leave multiple fetches in flight. Even if older results do not fully overwrite the UI, they still create avoidable pressure.

## Required changes

### 1. Add request tokens / generation IDs per clip-set loader

Each major loader should track a monotonically increasing request generation:

- `ClipBrowser` game-mode clip-set fetches
- `PlayerModeBrowser` clip-set fetches
- `MatchupModeBrowser` clip-set fetches
- player game-log fetches
- matchup games fetches

When a new request starts:

- increment the generation
- capture the generation locally
- only apply results if the generation still matches the latest one

If not, discard the result completely.

### 2. Use `AbortController` for browser-side fetches

All browser fetches for clip sets and supporting metadata should use `AbortController`.

When a new request supersedes an old one:

- abort the old request immediately
- do not treat abort as an error state
- do not show a user-facing failure for an intentional abort

### 3. Clear pending auto-advance when clip set changes

When a new filter/mode/date/game context is entered:

- clear any pending `loadMore`
- clear pending auto-advance state
- reset stale rail-driven fetch assumptions

## File targets

Likely files:

- `apps/web/src/components/ClipBrowser.tsx`
- `apps/web/src/components/PlayerModeBrowser.tsx`
- `apps/web/src/components/MatchupModeBrowser.tsx`

## Acceptance criteria

- Rapid filter changes do not leave multiple meaningful requests alive
- Old requests cannot overwrite newer clip sets
- Abort-triggered exits do not show error banners
- Mode/date/game switches cancel old in-flight work immediately

---

# Phase 2 — Debounce high-churn state changes

## Goal

Reduce bursts caused by rapid successive filter/navigation actions.

## Why

A user can click several controls within a second. The app should collapse those into fewer requests.

## Required changes

### 1. Debounce filter-triggered route updates

For filter changes that commonly happen in quick succession, add a small debounce before issuing the route update / fetch-triggering change.

Suggested debounce windows:

- 150ms for button/select style filter changes
- 200–250ms for text search driven changes

Do **not** debounce:

- explicit clip selection in the rail
- prev/next clip navigation
- direct game selection if the UI already only changes once per click

### 2. Coalesce multiple filter changes into one navigation

If the user changes several filters inside the debounce window:

- apply them optimistically in UI state
- issue only one final navigation/update

### 3. Keep the interface feeling immediate

Debounce should delay the network/navigation side, not make the controls feel dead.

This means:

- keep optimistic UI state
- delay the expensive work, not the visible click feedback

## File targets

- `apps/web/src/components/FilterBar.tsx`
- `apps/web/src/components/PlayerModeBrowser.tsx`
- `apps/web/src/components/MatchupModeBrowser.tsx`

## Acceptance criteria

- Rapid filter clicks collapse into one effective request burst
- Controls still feel responsive immediately
- No obvious lag is introduced into normal usage

---

# Phase 3 — Single-flight load-more protection

## Goal

Make sure only one load-more operation can be active at a time per clip context.

## Why

This is one of the most likely sources of request bursts during active rail skipping and autoplay.

## Required changes

### 1. Enforce strict single-flight on load-more

In all clip browsers:

- if a `loadMore` is already running, do not start another
- if the clip context changed, the old loadMore must be ignored or aborted
- do not allow multiple triggers from:
  - scroll/intersection behavior
  - autoplay-near-end behavior
  - rapid manual rail skipping

### 2. Add a minimum cooldown between successful load-more starts

Even after a load-more finishes, add a short minimum gap before another one can begin.

Suggested initial value:

- 250ms to 400ms between load-more starts

This is not user-facing; it is burst smoothing.

### 3. Prevent duplicate offset requests

If offset `24` is already being fetched or was just fetched for this clip context:

- do not request it again

Maintain a per-context in-flight and recently-completed offset map.

## File targets

- `apps/web/src/components/ClipBrowser.tsx`
- `apps/web/src/components/PlayerModeBrowser.tsx`
- `apps/web/src/components/MatchupModeBrowser.tsx`
- optionally extract shared helper logic into `apps/web/src/lib/`

## Acceptance criteria

- No duplicate load-more requests for the same offset/context
- Rapid rail interaction cannot stack overlapping pagination requests
- Autoplay + near-end preloading remains smooth without burstiness

---

# Phase 4 — Dedupe and local reuse

## Goal

Stop repeating work the app already has.

## Why

A large part of resilience is not sending the same request again when nothing meaningful changed.

## Required changes

### 1. Add short-lived client-side response reuse for clip-set pages

For clip-set fetches keyed by full request params:

- maintain a short-lived in-memory cache in the browser
- reuse recent successful responses for the exact same request key

Suggested TTLs:

- clip page responses: 15–30 seconds
- metadata lists like player games / matchup games: 30–60 seconds

### 2. Dedupe in-flight identical requests

If the same exact request is already in flight:

- reuse the same promise rather than starting another fetch

### 3. Preserve already-loaded pages when only clip selection changes

Changing `actionNumber` should not trigger any new clip-set fetch.

That behavior mostly exists already but must be preserved.

## File targets

- `apps/web/src/lib/` new request cache/dedupe helper
- `ClipBrowser.tsx`
- `PlayerModeBrowser.tsx`
- `MatchupModeBrowser.tsx`

## Acceptance criteria

- Repeating the same request key shortly after a success does not hit the network again
- Identical in-flight requests collapse into one
- Rail selection remains local-only

---

# Phase 5 — Bound prefetching and smarter rail behavior

## Goal

Keep the browsing experience smooth without letting prefetch turn into aggressive upstream pressure.

## Why

Prefetching is useful, but it becomes harmful when the user is behaving unpredictably or upstream is unstable.

## Required changes

### 1. Limit prefetch horizon

Do not fetch too far ahead.

Guideline:

- at most one page ahead automatically
- do not recursively chase more pages just because the user is near the end repeatedly during an existing fetch

### 2. Only prefetch when playback state suggests likely usefulness

Prefer prefetch when:

- the user is watching normally
- autoplay is moving steadily
- the active index is approaching the end of already-loaded clips

Be more conservative when:

- the user is jumping repeatedly through the rail
- the clip context was just changed
- the app is in a recent-failure cooldown state

### 3. Detect aggressive skipping and temporarily reduce eagerness

Add a lightweight frontend behavior tracker.

Examples of signals:

- 4+ clip jumps within 2 seconds
- repeated large rail jumps
- multiple clip-context changes in a short window

When this signal is active for a short period:

- suspend auto-prefetch temporarily, or
- reduce prefetch to only on explicit need

This should be temporary and self-clearing.

## File targets

- `ClipBrowser.tsx`
- `PlayerModeBrowser.tsx`
- `MatchupModeBrowser.tsx`
- optional shared helper under `apps/web/src/lib/interactionPressure.ts`

## Acceptance criteria

- Normal watching stays smooth
- Aggressive skipping no longer causes runaway background fetch behavior
- Prefetch becomes conservative during high interaction pressure

---

# Phase 6 — API-side request coalescing and upstream protection

## Goal

Reduce avoidable duplicate upstream NBA calls even when the frontend still produces bursts.

## Why

Frontend resilience is necessary, but the API should also protect upstream and absorb duplicate work.

## Required changes

### 1. Add single-flight dedupe for expensive upstream calls

At the API layer, dedupe concurrent identical requests for:

- play-by-play fetch by `gameId`
- video asset fetch by `gameId + actionNumber`
- player directory by season
- player game log by `personId + season`
- team game log by `team + season`
- matchup games by `season + teamA + teamB`

Meaning:

- if request A for key X is already in progress
- request B for key X should await the same promise
- not start a second upstream fetch

### 2. Distinguish memory cache hit vs in-flight dedupe hit

This is especially important later for diagnosis, but even now the API should internally distinguish:

- memory cache hit
- persistent cache hit
- in-flight dedupe hit
- fresh upstream fetch

### 3. Add concurrency caps specifically for video asset resolution

The API already uses limited concurrency in places. Tighten the rules for asset resolution where needed.

Guidance:

- keep video asset lookup concurrency low and stable
- do not scale concurrency upward because the frontend is more active

### 4. Consider short TTL negative-result suppression for repeated same-key misses

Be careful here.

Do **not** long-cache null video assets permanently.
But if the exact same asset key fails repeatedly within a very short window, suppress immediate re-hit for a small TTL.

Suggested TTL:

- 10 to 20 seconds only

This avoids hammering obviously failing keys while still allowing later recovery.

## File targets

Likely files:

- `apps/api/src/index.ts`
- `apps/api/src/lib/` new single-flight helper
- any cache helper files involved in games / persistent cache / NBA fetch wrappers

## Acceptance criteria

- Duplicate identical upstream fetches are collapsed server-side
- API remains stable even if the frontend issues repetitive same-key requests
- transient same-key misses do not get hammered repeatedly

---

# Phase 7 — Cooldown and backoff behavior after upstream stress signals

## Goal

Make the system automatically become less aggressive for a short window when upstream starts showing signs of stress.

## Why

Once placeholder/missing behavior starts surfacing, continuing aggressive fetch behavior usually makes things worse.

## Required changes

### 1. Add a temporary “stress mode” in the frontend

Trigger this mode for a short duration when the clip browser sees repeated asset failure signals in a small window.

Examples:

- several newly requested clips with missing video URLs
- repeated failed page fetches
- repeated placeholder-adjacent failures once diagnosis work exists

Initial stress-mode behavior should be modest:

- suspend auto-prefetch
- widen load-more cooldown
- stop trying to stay far ahead of the user

Suggested duration:

- 15 to 30 seconds
- reset if conditions normalize

### 2. Add optional API-side backoff hints

Once implemented, the API may include simple response metadata such as:

- `retrySuggested: true`
- `suggestedCooldownMs: 15000`

Do this only if clearly useful. Frontend-only stress mode is acceptable as a first step.

## Acceptance criteria

- A burst of failures causes the app to reduce pressure temporarily
- After the window passes, normal behavior resumes automatically

---

## Rollout order

Implement in this exact order:

1. **Phase 1** — stale request cancellation / invalidation
2. **Phase 3** — single-flight load-more protection
3. **Phase 6** — API-side single-flight dedupe
4. **Phase 2** — debounce high-churn state changes
5. **Phase 5** — bounded prefetch / aggressive-skip dampening
6. **Phase 7** — cooldown / backoff behavior
7. **Phase 4** — broader client-side reuse improvements where still needed

Reason:

- cancellation and single-flight solve the biggest waste first
- API-side dedupe protects upstream even before all frontend smoothing is complete
- debounce/prefetch tuning should come after the basic correctness protections are in place

---

## Suggested agent breakdown

### Agent 1 — Frontend request lifecycle

Own:

- abort controllers
- generation IDs
- stale result discard
- load-more single-flight rules
- pending auto-advance cleanup

### Agent 2 — Frontend interaction smoothing

Own:

- debounce behavior
- aggressive-skip detection
- prefetch limits
- stress-mode behavior

### Agent 3 — API resilience

Own:

- server-side single-flight dedupe
- same-key in-flight request collapsing
- short negative-result suppression
- asset lookup concurrency review

### Agent 4 — QA / verification

Own:

- heavy interaction test cases
- repeated filter switching tests
- rapid rail skipping tests
- mode/date flip tests
- verification that outdated results never win

---

## QA test plan

### Manual scenarios

#### Scenario 1 — rapid game-mode filter changes

- switch play type repeatedly
- toggle team/player filters quickly
- change quarter multiple times in under 2 seconds
- confirm only newest state wins
- confirm no noisy error UI appears from aborted stale requests

#### Scenario 2 — aggressive rail skipping

- click forward rapidly through many clips
- trigger multiple near-end situations
- confirm only one load-more is active at a time
- confirm no duplicate page loads for same offset

#### Scenario 3 — rapid date/game switching

- switch date repeatedly
- switch between games before prior set settles
- confirm old requests do not continue to populate the UI

#### Scenario 4 — player mode stress

- search/select player
- rapidly change play type, opponent, quarter, exclusions
- confirm clip loading remains stable and prior requests are canceled/ignored

#### Scenario 5 — matchup mode stress

- change team A / team B repeatedly
- toggle game exclusions while clips are loading
- confirm old matchup requests do not linger or win

#### Scenario 6 — degraded upstream simulation

- simulate repeated asset lookup failures locally where possible
- confirm frontend reduces eagerness and stops aggressive prefetch behavior temporarily

### Technical assertions

- no duplicate in-flight request for same clip page key
- no duplicate in-flight request for same video asset key at API layer
- aborts are silent and intentional
- stale request completions never overwrite current context
- load-more starts are serialized

---

## Non-goals / guardrails

Do **not**:

- make the UI feel slow or unresponsive just to reduce requests
- remove useful autoplay / next-clip behavior
- permanently cache missing assets too aggressively
- overcomplicate with a huge framework before fixing the obvious burst issues

Do:

- preserve the feeling of a fast viewer
- hide resilience complexity under the hood
- prefer boring, robust mechanics over clever ones

---

## Definition of done

This project is complete when:

1. Rapid user interaction no longer creates obvious request storms
2. Stale requests are canceled or safely discarded
3. Load-more is strictly serialized and deduped
4. The API collapses duplicate same-key upstream fetches
5. Prefetch remains useful but bounded
6. The app becomes more conservative for a short time after upstream stress signals
7. Normal watching still feels fast and smooth

---

## Final implementation note

If tradeoffs appear, optimize for this:

> A slightly less aggressive app that keeps working is better than a hyper-eager app that trips upstream and returns placeholder video.

ClipZero should feel fast, but it should never behave recklessly under pressure.
