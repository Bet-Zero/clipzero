# ClipZero Failure Diagnosis and Classification Plan

## Purpose

This document is the implementation plan for building a practical failure diagnosis system for ClipZero.

The goal is not perfect certainty.
The goal is to stop treating all failures as the same vague "something broke" event.

After this work, ClipZero should be able to distinguish between likely categories such as:

- upstream pressure / likely throttling
- placeholder-video behavior
- missing clip asset for a specific play
- play data exists but no video asset returned
- transient upstream timeout / network failure
- intentional stale-request cancellation
- API-side internal failure
- frontend-only failure
- unknown upstream failure

This plan is separate from the request-resilience plan.
That plan reduces failures.
This plan explains failures when they still happen.

---

## Product goal

When ClipZero fails, the team should be able to answer:

- **what failed?**
- **where did it fail?**
- **what kind of failure was it?**
- **is this one bad clip, a burst-related upstream issue, or a real bug?**
- **should we retry, back off, or ignore it?**

The system does **not** need to prove causality with 100% certainty.
It does need to produce useful, repeatable labels and enough evidence to act intelligently.

---

## Problem statement

Right now, a clip/video failure can mean many different things:

- the NBA never had a valid video asset for that play
- the video asset endpoint returned nothing
- the video URL exists but serves placeholder content
- upstream temporarily failed under load
- the request was canceled because the user moved on
- the frontend lost the race to a newer request
- the app itself hit a bug
- the API timed out or could not reach upstream

Without classification, these all look too similar.
That makes debugging slow and often guess-based.

---

## High-level strategy

Build a layered diagnosis system with five parts:

1. **Failure taxonomy** — define named failure categories
2. **Structured event logging** — log the evidence needed to classify failures
3. **Classification rules** — turn raw events into likely diagnoses
4. **Response metadata** — optionally expose safe diagnosis hints to the frontend
5. **Debug surfaces** — make it easy for humans to inspect what happened

The diagnosis system should be practical, conservative, and understandable.

---

## Scope

### In scope

- classification of clip/video-related failures
- API and frontend failure logging improvements
- structured failure event model
- likely-cause classification rules
- lightweight debug surfaces / endpoints / logs
- optional UI/debug panel surfacing in development or internal mode

### Out of scope

- perfect attribution of NBA intent
- external monitoring dashboards
- business analytics
- replacing the upstream data/video source

---

## Design principles

### 1. Prefer useful labels over false precision
"Likely upstream pressure" is better than pretending we proved hard rate limiting.

### 2. Separate evidence from conclusion
Log raw facts first.
Then classify from those facts.

### 3. Canceled stale requests are not failures
They should be explicitly labeled as canceled/ignored, not mixed into real breakage.

### 4. Single-clip failures and broad-system failures are different
The system must distinguish between isolated asset gaps and broader upstream degradation.

### 5. Unknown is acceptable
If evidence is weak, classify as unknown instead of guessing too hard.

---

## Failure taxonomy

This taxonomy should be implemented as shared named constants/types.

## Top-level failure classes

### A. `stale_request_canceled`
The request was intentionally aborted because the user moved on or a newer request superseded it.

This is not a bug.
This is not upstream failure.
This is expected control flow.

### B. `frontend_request_discarded`
The request completed, but its result was intentionally ignored because a newer generation won.

Also not a true product failure.
Important for debugging race behavior, but should not alarm anyone.

### C. `frontend_network_failure`
The browser could not complete the request to your API.

Examples:
- fetch throws
- tunnel/API unreachable
- browser network issue

### D. `api_internal_failure`
Your API failed before or during processing for reasons internal to ClipZero.

Examples:
- unhandled exception
- serialization issue
- bad assumptions in code
- local cache logic bug

### E. `upstream_timeout_or_transport_failure`
Your API attempted upstream work but the request failed due to timeout, connection problem, or transport-level issue.

Examples:
- timeout to NBA endpoint
- connection reset
- DNS/transport issue
- axios/network exception

### F. `upstream_http_failure`
Upstream responded with a non-success status that indicates failure.

Examples:
- 403
- 404
- 429
- 500
- 503

### G. `video_asset_not_found`
The play exists, but the video asset lookup produced no usable clip URL.

This should be used when evidence suggests the asset simply was not available for that specific play.

### H. `video_asset_placeholder_suspected`
A video URL existed or looked valid, but behavior strongly suggests the NBA served placeholder content instead of the true clip.

### I. `video_asset_empty_response`
The video asset endpoint returned a structurally valid response but contained no usable video URL / thumbnail data.

### J. `upstream_pressure_suspected`
Evidence suggests bursty demand, throttling-like behavior, or temporary upstream refusal under request pressure.

This should be inferred from patterns, not just one raw event.

### K. `widespread_upstream_video_degradation`
A broader window of clip/video failures suggests the upstream video system/CDN is generally unhealthy, not just one clip.

### L. `isolated_clip_gap`
A small number of specific plays fail while nearby clips and other requests work normally.
This points to clip-specific availability gaps, not systemic issues.

### M. `unknown_failure`
Not enough evidence to say more.

---

## Evidence model

Every important clip-related request should capture structured evidence.

## Required evidence fields

### Common request context

- `eventId` — unique ID
- `timestamp`
- `route` — `/clips/game`, `/clips/player`, `/clips/matchup`, asset lookup, etc.
- `mode` — game/player/matchup when relevant
- `requestId` — request-scoped ID
- `sessionId` or lightweight client session token if available
- `ip` where appropriate on API side
- `userIntentType` — user-triggered, load-more, prefetch, autoplay, retry
- `requestGeneration` where relevant on frontend

### Clip identity context

- `gameId`
- `actionNumber`
- `videoActionNumber`
- `personId` if relevant
- `season`
- `playType`
- `filterKey` / normalized request key
- `offset`

### Upstream request facts

- upstream endpoint name
- attempt count
- start time
- duration
- HTTP status if any
- timeout yes/no
- network error name/code
- whether response body was structurally valid
- whether URL fields were present
- whether thumbnail field was present

### Cache/dedupe context

- memory cache hit yes/no
- persistent cache hit yes/no
- in-flight dedupe hit yes/no
- fresh upstream fetch yes/no

### Local control-flow context

- aborted yes/no
- stale-discarded yes/no
- superseded by request generation X
- retry performed yes/no
- retry later succeeded yes/no

### Window/pattern context

These are critical for diagnosing pressure vs isolated asset gaps.

Maintain short rolling-window counters such as:

- failures for same clip key in last N seconds
- failures across many clip keys in last N seconds
- placeholder-suspected responses in last N seconds
- recent successful asset lookups in same window
- recent interaction pressure score if available

---

## Classification rules

Classification should happen after the evidence is gathered.

Use simple rules first.
Do not overbuild ML-style logic.

# Rule group 1 — control-flow exclusions

## Rule 1: aborted request
If request was explicitly aborted by `AbortController` or equivalent:

- classify as `stale_request_canceled`

## Rule 2: completed but stale generation lost
If result arrived after a newer request generation became active:

- classify as `frontend_request_discarded`

These should never be mixed into real failure counts.

---

# Rule group 2 — transport and internal failures

## Rule 3: browser could not reach API
If browser fetch fails before receiving API response:

- classify as `frontend_network_failure`

## Rule 4: API throws internal exception
If your API code fails independently of upstream:

- classify as `api_internal_failure`

## Rule 5: upstream transport/timeout failure
If axios/upstream request fails with timeout/network-type error and no useful HTTP response:

- classify as `upstream_timeout_or_transport_failure`

## Rule 6: upstream non-success HTTP response
If upstream returns 4xx/5xx failure status:

- classify as `upstream_http_failure`
- preserve status code in evidence

Special note:

- 429 should remain `upstream_http_failure` at the raw event level
- but can contribute heavily to a later `upstream_pressure_suspected` classification at the aggregate level

---

# Rule group 3 — asset-specific outcomes

## Rule 7: structurally valid empty asset response
If video asset lookup succeeded structurally but returned no usable clip URL:

- classify raw event as `video_asset_empty_response`

## Rule 8: specific clip missing, neighbors healthy
If a clip key fails repeatedly while nearby clip keys and other recent clip requests succeed normally:

- aggregate classification: `isolated_clip_gap`
- likely specific clip asset unavailable

## Rule 9: play exists, video asset repeatedly absent for same play
If play-by-play exists but repeated same-key lookups produce no asset URL over time and broader system looks healthy:

- classify likely cause as `video_asset_not_found`

## Rule 10: placeholder strongly suspected
If evidence indicates a returned video URL or playback path likely served placeholder content:

- classify as `video_asset_placeholder_suspected`

How to detect this can improve over time.
Initial versions may rely on one or more of:

- known placeholder URL/path pattern
- known placeholder file characteristics if detectable
- repeated cluster of "URL exists but user-reported unplayable/placeholder" events
- explicit API probe signal if later added

---

# Rule group 4 — aggregate/pattern diagnoses

These should be derived from recent windows of events, not single events.

## Rule 11: likely upstream pressure
If within a short window there is a burst pattern such as:

- many failures across many keys
- higher failure rate right after elevated interaction pressure
- repeated 429/403-like upstream failures
- repeated empty/placeholder asset responses during burst usage

then classify rolling condition as:

- `upstream_pressure_suspected`

This is especially strong when:

- the same app/session is producing many requests quickly
- success rate drops sharply during that burst
- success returns later after activity subsides

## Rule 12: widespread upstream video degradation
If many unrelated clip keys fail in the same short window across otherwise normal usage patterns:

- classify rolling condition as `widespread_upstream_video_degradation`

This is different from user-specific pressure.
It suggests the NBA video system/CDN is having a bad window.

## Rule 13: isolated gap vs broad issue
If only one or a few specific clip keys fail while the majority succeed:

- prefer `isolated_clip_gap`

If many unrelated clip keys fail together:

- prefer `widespread_upstream_video_degradation`
or `upstream_pressure_suspected` depending on context

## Rule 14: unknown fallback
If no rule is strong enough:

- classify as `unknown_failure`

---

## Data model and storage plan

## API-side event log structure

Create a shared structured type under API lib, for example:

- `apps/api/src/lib/failureTypes.ts`
- `apps/api/src/lib/failureClassifier.ts`
- `apps/api/src/lib/failureWindows.ts`

Suggested model pieces:

### 1. Raw event type
Represents one concrete event:

- fetch started
- upstream failed
- asset returned empty
- asset returned URL
- request aborted
- stale response discarded

### 2. Classified event type
Represents the current best diagnosis for that event.

Fields:

- `rawCategory`
- `diagnosis`
- `confidence` (low/medium/high)
- `evidenceSummary[]`

### 3. Rolling window tracker
Keeps recent windows by:

- session/request source
- clip key
- route
- global video asset health window

This does not need a database initially.
An in-memory rolling tracker is fine for first version.
Later it can be persisted if needed.

---

## Implementation plan

# Phase 1 — Define taxonomy and shared types

## Goal
Create the shared language for failures.

## Required changes

### 1. Add shared enums/types/constants
Implement shared types for:

- raw event kinds
- diagnosis kinds
- evidence fields
- confidence levels

### 2. Standardize names across API and frontend
Do not invent slightly different names in different layers.
Use one canonical vocabulary.

## File targets

Likely files:

- `apps/api/src/lib/failureTypes.ts`
- `apps/web/src/lib/failureTypes.ts` or generated shared package if desired

## Acceptance criteria

- all named failure classes exist as code constants/types
- vocabulary is stable and human-readable

---

# Phase 2 — API raw-event instrumentation

## Goal
Capture enough evidence in the API to classify clip/video failures meaningfully.

## Required changes

### 1. Instrument upstream asset fetch path
Especially inside or around:

- `getCachedVideoAsset`
- `getVideoEventAsset`
- play-by-play fetch wrappers
- game log / matchup fetch wrappers where relevant

Log raw event facts for:

- success with usable asset
- empty asset response
- upstream timeout
- upstream HTTP failure
- internal exception
- cache hit vs fresh upstream fetch

### 2. Add request context propagation
Each API request should carry a request ID and route context into lower-level logging.

### 3. Add user-intent metadata from frontend where safe/useful
Where practical, send lightweight request headers or params that tell the API whether the request was:

- user action
- load-more
- prefetch
- autoplay

This matters a lot later for pressure diagnosis.

## File targets

- `apps/api/src/index.ts`
- `apps/api/src/lib/logger.ts`
- NBA fetch helper locations
- asset/cache helper locations

## Acceptance criteria

- clip/video failures now emit structured API-side evidence
- raw logs include route, key IDs, upstream facts, and cache context

---

# Phase 3 — Frontend event instrumentation

## Goal
Capture frontend-only outcomes so canceled/discarded requests stop looking like mysterious failures.

## Required changes

### 1. Instrument aborts and stale discards
In all three clip browsers and supporting loaders:

- log when request was intentionally aborted
- log when result arrived but was discarded due to stale generation

### 2. Instrument browser-to-API network failures
When frontend fetch throws before receiving an API response:

- classify locally as `frontend_network_failure`

### 3. Track request intent type
For clip-set fetches, mark intent as:

- `initial_load`
- `filter_change`
- `mode_change`
- `date_change`
- `load_more`
- `autoplay_prefetch`
- `manual_skip_pressure`

This can be lightweight and approximate.
It does not need perfect accuracy.

## File targets

- `apps/web/src/components/ClipBrowser.tsx`
- `apps/web/src/components/PlayerModeBrowser.tsx`
- `apps/web/src/components/MatchupModeBrowser.tsx`
- supporting request helpers under `apps/web/src/lib/`

## Acceptance criteria

- intentional cancellations are clearly distinguished from real failures
- frontend-only failures no longer get mixed into API/upstream blame

---

# Phase 4 — Build the classifier

## Goal
Turn raw events into likely diagnoses.

## Required changes

### 1. Implement raw-to-diagnosis mapping
Create a classifier module that accepts:

- raw event
- rolling window context
- optional recent history for same key/session

and returns:

- diagnosis
- confidence
- evidence summary

### 2. Keep rules explicit and readable
No giant nested mess.
Use small helper functions such as:

- `isAbortedRequest()`
- `isIsolatedClipGap()`
- `isLikelyPressureWindow()`
- `isWidespreadDegradation()`
- `isSpecificMissingAsset()`

### 3. Separate event-level and window-level diagnoses
Event-level examples:

- `video_asset_empty_response`
- `upstream_http_failure`

Window-level examples:

- `upstream_pressure_suspected`
- `widespread_upstream_video_degradation`

This distinction matters.

## File targets

- `apps/api/src/lib/failureClassifier.ts`
- `apps/api/src/lib/failureWindows.ts`

## Acceptance criteria

- raw event logs can be converted into named diagnoses
- classifier is testable with deterministic inputs

---

# Phase 5 — Rolling windows and pattern tracking

## Goal
Enable diagnoses that depend on patterns over time, not just one event.

## Required changes

### 1. Add short in-memory rolling windows
Suggested windows:

- 10 seconds
- 30 seconds
- 2 minutes

Track counts such as:

- total asset lookups
- successful asset lookups
- empty asset responses
- placeholder-suspected events
- upstream HTTP failures by status
- upstream timeouts
- repeated same-key failures
- failures across many unique keys
- session-level interaction pressure marker if available

### 2. Track same-key recurrence
For diagnosing isolated clip gaps, track:

- number of failures for `gameId + actionNumber` in recent windows
- whether adjacent/nearby keys succeeded recently

### 3. Track broad failure spread
For diagnosing widespread degradation, track:

- count of failed unique clip keys in recent windows
- percentage of failures among recent asset requests

## Acceptance criteria

- classifier can tell the difference between one bad clip and a bad window
- pressure/degradation diagnoses are based on rolling evidence rather than one guess

---

# Phase 6 — Response metadata and safe UI/debug hints

## Goal
Expose limited, useful diagnosis hints without turning the user-facing app into a noisy debug console.

## Required changes

### 1. Add optional debug metadata in API responses
For internal/debug mode only, consider including fields like:

- `failureDiagnosis`
- `failureConfidence`
- `retrySuggested`
- `diagnosisWindowState`

Do **not** expose overly noisy details by default in the main UX.

### 2. Add development/internal debug surface
Options:

- internal-only `/debug/failures/recent` API endpoint
- development-only panel
- log file grouping conventions

### 3. User-facing copy should stay simple
For normal UI, do not dump technical labels.
At most, use clearer messages such as:

- "This clip asset is unavailable"
- "Clip loading is temporarily unstable right now"
- "A newer request replaced this one"

Detailed diagnosis should remain mainly for the team.

## Acceptance criteria

- internal users can inspect recent diagnoses quickly
- normal users are not overwhelmed with debug noise

---

# Phase 7 — Tests and validation scenarios

## Goal
Prove that classifications are meaningful and not random.

## Required changes

### 1. Unit tests for classifier rules
Create deterministic test fixtures for:

- aborted request
- stale discard
- upstream timeout
- upstream 429 burst
- repeated empty response for one clip
- many unique-key failures in a window
- healthy neighbors + one repeated clip miss

### 2. Simulated/manual scenarios
#### Scenario A — stale request churn
- rapidly change filters
- verify aborted/discarded labels dominate
- verify no false upstream diagnosis

#### Scenario B — isolated missing clip
- simulate same-key repeated no-asset result
- neighboring clips still succeed
- expect `isolated_clip_gap` / `video_asset_not_found`

#### Scenario C — burst/pressure window
- simulate many failures after rapid interactions
- expect `upstream_pressure_suspected`

#### Scenario D — broad degradation window
- simulate many unique-key failures without obvious user burst
- expect `widespread_upstream_video_degradation`

#### Scenario E — API internal exception
- throw internal error in mocked path
- expect `api_internal_failure`

## Acceptance criteria

- classifier outputs are stable under test
- major categories are distinguishable in practice

---

## Suggested agent breakdown

### Agent 1 — taxonomy and classifier core
Own:

- shared types
- rule engine
- confidence model
- tests for classification logic

### Agent 2 — API instrumentation
Own:

- structured logging additions
- upstream fetch evidence capture
- rolling windows
- debug endpoint if chosen

### Agent 3 — frontend instrumentation
Own:

- abort/discard logging
- intent-type tagging
- browser-side failure labeling
- optional internal debug panel hooks

### Agent 4 — validation
Own:

- scenario tests
- verifying classifications against real breakage patterns
- tuning thresholds so diagnoses are useful, not noisy

---

## Suggested thresholds for first version

These are starting points, not sacred values.

### Same-key recurrence
- 2 to 3 failures for same clip key within 60 seconds → stronger isolated-gap suspicion

### Pressure suspicion
- 5+ failures across multiple unique clip keys within 15 seconds
- especially if preceded by elevated interaction pressure or load-more bursts

### Widespread degradation
- high failure ratio across 8+ unique clip keys in 30 seconds without just one repeated user burst pattern

### Confidence guidance
- **high** when direct evidence is explicit (abort, timeout, HTTP status)
- **medium** when repeated pattern strongly suggests a cause
- **low** when inference is weak or overlapping causes are possible

---

## Debug surface recommendation

Implement one lightweight internal endpoint first:

### `GET /debug/failures/recent`
Return recent classified events and summary windows.

Suggested payload shape:

- `recentEvents[]`
- `sameKeyHotspots[]`
- `windowSummary`
- `globalVideoHealth`

Protect this endpoint.
It should not be public-facing in normal production use.

If a UI panel is later added, it can read from this endpoint.

---

## Guardrails

Do **not**:

- pretend to prove NBA intent when evidence is indirect
- classify stale cancels as failures
- expose noisy internals to normal users by default
- overfit the classifier to one edge case

Do:

- keep labels understandable
- make evidence inspectable
- prefer conservative diagnosis over fake certainty

---

## Definition of done

This project is complete when:

1. Clip/video failures are logged with structured evidence
2. Intentional abort/discard behavior is explicitly separated from real failures
3. The system can distinguish isolated clip gaps from broader upstream issues
4. The system can label likely pressure windows and widespread degradation windows
5. Internal users can inspect recent diagnoses without digging through vague logs manually
6. Classifier behavior is covered by deterministic tests

---

## Final implementation note

The system does not need to say:

> "The NBA definitely rate limited us for this exact reason."

It does need to say something like:

> "This was likely upstream pressure during a burst window, confidence medium, based on many unique-key failures immediately following high interaction pressure."

That level of clarity is enough to be extremely useful.

ClipZero does not need perfect forensic certainty.
It needs failures that are understandable, actionable, and no longer mysterious.
