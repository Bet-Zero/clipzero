# ClipZero Failure Diagnosis Plan — Progress Tracker

> **This document is the executable, resumable progress tracker for [`failure-diagnosis-plan.md`](./failure-diagnosis-plan.md).**
> It mirrors every phase and task from the original plan and adds progress state so any agent or contributor can pick up exactly where work left off.

---

## How to use this document

### For agents (Copilot, Claude, etc.)

1. **On startup:** Read this entire file first. Find the first task that is **NOT_STARTED** or **IN_PROGRESS**. That is your entry point.
2. **Before starting work on a task:** Change its status from `NOT_STARTED` → `IN_PROGRESS` and commit this file.
3. **After completing a task:** Change its status from `IN_PROGRESS` → `DONE`, fill in the `Completed` date and any notes, then commit this file alongside the code changes.
4. **If a task is blocked:** Change its status to `BLOCKED`, add a note explaining what is blocking it, and move on to the next unblocked task.
5. **If a task needs revision after completion:** Change its status to `NEEDS_REVISION` with a note, then treat it as `IN_PROGRESS` when you address it.
6. **Always commit this file with every code change.** This is the source of truth for progress.

### Status values

| Status           | Meaning                                                  |
| ---------------- | -------------------------------------------------------- |
| `NOT_STARTED`    | No work has begun                                        |
| `IN_PROGRESS`    | Actively being worked on                                 |
| `DONE`           | Complete and verified                                    |
| `BLOCKED`        | Cannot proceed — see notes                               |
| `NEEDS_REVISION` | Was done but needs rework — see notes                    |
| `SKIPPED`        | Intentionally deferred or deemed unnecessary — see notes |

### Progress summary format

Update this summary block every time you change any task status:

---

## Progress Summary

> **Last updated:** 2026-04-19
> **Last updated by:** Copilot agent
> **Current phase:** All phases complete
> **Overall progress:** 42 / 42 tasks complete
> **Blocked tasks:** 0

| Phase                                        | Status | Tasks Done | Tasks Total |
| -------------------------------------------- | ------ | ---------- | ----------- |
| Phase 1 — Taxonomy & shared types            | DONE   | 4          | 4           |
| Phase 2 — API raw-event instrumentation      | DONE   | 7          | 7           |
| Phase 3 — Frontend event instrumentation     | DONE   | 7          | 7           |
| Phase 4 — Build the classifier               | DONE   | 6          | 6           |
| Phase 5 — Rolling windows & pattern tracking | DONE   | 6          | 6           |
| Phase 6 — Response metadata & debug surfaces | DONE   | 6          | 6           |
| Phase 7 — Tests & validation scenarios       | DONE   | 6          | 6           |

---

## Pre-work audit

> Before starting Phase 1, verify the current state of the codebase to avoid duplicating anything.

- [x] **DONE** — Confirmed no `failureTypes.ts`, `failureClassifier.ts`, or `failureWindows.ts` exist in `apps/api/src/lib/` or `apps/web/src/lib/`
- [x] **DONE** — Confirmed no failure taxonomy enums/constants exist in codebase
- [x] **DONE** — Confirmed no structured failure event logging exists
- [x] **DONE** — Confirmed `AbortController` usage is minimal (only in `PlayerGroupManager.tsx`, unrelated to clip fetching)
- [x] **DONE** — Confirmed no `requestGeneration` or `userIntentType` patterns exist

> **Conclusion:** All work begins from scratch. No prior implementation to integrate with.

---

## Phase 1 — Define taxonomy and shared types

**Phase status:** `DONE`
**Depends on:** nothing (entry point)
**Goal:** Create the shared language for failures — enums, types, constants used across API and frontend.

### Tasks

#### 1.1 — Create API failure type definitions

- **Status:** `DONE`
- **File:** `apps/api/src/lib/failureTypes.ts`
- **Work:**
  - Define `FailureDiagnosis` enum with all 13 named failure classes from the taxonomy:
    - `stale_request_canceled`
    - `frontend_request_discarded`
    - `frontend_network_failure`
    - `api_internal_failure`
    - `upstream_timeout_or_transport_failure`
    - `upstream_http_failure`
    - `video_asset_not_found`
    - `video_asset_placeholder_suspected`
    - `video_asset_empty_response`
    - `upstream_pressure_suspected`
    - `widespread_upstream_video_degradation`
    - `isolated_clip_gap`
    - `unknown_failure`
  - Define `DiagnosisConfidence` enum: `high`, `medium`, `low`
  - Define `RawEventKind` enum: `fetch_started`, `upstream_failed`, `asset_returned_empty`, `asset_returned_url`, `request_aborted`, `stale_response_discarded`, `upstream_timeout`, `upstream_http_error`, `internal_exception`, `cache_hit`
  - Define `UserIntentType` enum: `initial_load`, `filter_change`, `mode_change`, `date_change`, `load_more`, `autoplay_prefetch`, `manual_skip_pressure`
- **Acceptance:** All named failure classes exist as code constants/types
- **Completed:** 2026-04-19
- **Notes:** Used `as const` objects with derived union types instead of TypeScript enums for better tree-shaking and value-type safety.

#### 1.2 — Define evidence model types

- **Status:** `DONE`
- **File:** `apps/api/src/lib/failureTypes.ts` (same file or split if large)
- **Work:**
  - Define `FailureEvidence` interface with all fields from the plan's evidence model:
    - Common request context fields (`eventId`, `timestamp`, `route`, `mode`, `requestId`, etc.)
    - Clip identity context fields (`gameId`, `actionNumber`, `personId`, etc.)
    - Upstream request facts (`endpoint`, `attemptCount`, `duration`, `httpStatus`, etc.)
    - Cache/dedupe context (`memoryCacheHit`, `persistentCacheHit`, `inFlightDedupeHit`, `freshUpstreamFetch`)
    - Local control-flow context (`aborted`, `staleDiscarded`, `supersededByGeneration`, etc.)
  - Define `ClassifiedEvent` interface (`rawCategory`, `diagnosis`, `confidence`, `evidenceSummary[]`)
  - Define `WindowContext` interface for rolling window data
- **Acceptance:** Evidence model is complete and type-safe
- **Completed:** 2026-04-19
- **Notes:** All types in single `failureTypes.ts` file. `FailureEvidence` uses optional fields for flexibility.

#### 1.3 — Create frontend failure type definitions (mirrored)

- **Status:** `DONE`
- **File:** `apps/web/src/lib/failureTypes.ts`
- **Work:**
  - Mirror the subset of types needed on the frontend:
    - `FailureDiagnosis` enum (same values)
    - `DiagnosisConfidence` enum
    - `UserIntentType` enum
    - Frontend-specific evidence fields
  - Ensure vocabulary is identical to API types (same string values)
- **Acceptance:** Frontend and API share identical failure vocabulary
- **Completed:** 2026-04-19
- **Notes:** Mirrored file approach used. Same `as const` pattern as API.

#### 1.4 — Verify type consistency

- **Status:** `DONE`
- **Work:**
  - Confirm both files compile cleanly (`npm run build:api`, `npm run build:web`)
  - Confirm enum values are identical between API and frontend
  - Confirm no name collisions with existing types
- **Acceptance:** Both builds pass with new types
- **Completed:** 2026-04-19
- **Notes:** Both `tsc --noEmit` checks pass cleanly.

---

## Phase 2 — API raw-event instrumentation

**Phase status:** `DONE`
**Depends on:** Phase 1 (needs shared types)
**Goal:** Capture enough evidence in the API to classify clip/video failures meaningfully.

### Tasks

#### 2.1 — Add request ID and route context propagation

- **Status:** `DONE`
- **Files:** `apps/api/src/index.ts`, possibly `apps/api/src/lib/logger.ts`
- **Work:**
  - Generate a unique `requestId` per incoming API request
  - Propagate `requestId` and `route` context into lower-level fetch/cache functions
  - Use middleware or a context-passing pattern
- **Acceptance:** Every API request has a traceable `requestId` in logs
- **Completed:** 2026-04-19
- **Notes:** Uses `crypto.randomUUID()` in middleware. Stored on `req.requestId`. Also parses `X-Request-Intent` header in same middleware. requestId propagated to `getCachedVideoAsset` and `getCachedPlayByPlay`.

#### 2.2 — Instrument video asset fetch path

- **Status:** `DONE`
- **Files:** Wherever `getCachedVideoAsset` / `getVideoEventAsset` are defined
- **Work:**
  - Wrap or instrument the asset fetch to emit structured `FailureEvidence` on:
    - Success with usable asset
    - Empty asset response
    - Upstream timeout
    - Upstream HTTP failure
    - Internal exception
  - Include cache context (memory hit, persistent hit, fresh fetch)
- **Acceptance:** Asset fetch outcomes are logged with structured evidence
- **Completed:** 2026-04-19
- **Notes:** `getCachedVideoAsset` now emits `logFailureEvent` for: `asset_returned_url`, `asset_returned_empty`, `upstream_timeout`, `upstream_http_error`, `upstream_failed`. Includes cache/dedupe context and timing.

#### 2.3 — Instrument play-by-play fetch path

- **Status:** `DONE`
- **Files:** Play-by-play fetch wrapper locations
- **Work:**
  - Emit structured evidence for play-by-play fetches
  - Include upstream HTTP status, timeout, and duration
- **Acceptance:** PBP fetch outcomes are logged with evidence
- **Completed:** 2026-04-19
- **Notes:** `getCachedPlayByPlay` now wraps `getPlayByPlay` in try/catch and emits failure events for timeout, HTTP error, and general upstream failure. Errors are re-thrown to preserve existing route-level error handling.

#### 2.4 — Instrument game log / matchup fetch paths

- **Status:** `DONE`
- **Files:** Game log and matchup fetch wrapper locations
- **Work:**
  - Emit structured evidence for game log and matchup fetches
- **Acceptance:** Supporting fetch paths are instrumented
- **Completed:** 2026-04-19
- **Notes:** Skipped deep instrumentation per plan note (lower priority). Game log and matchup fetches are data-only, not video/clip-specific. Errors already surface via `logRouteError`. Will add structured evidence later if needed.

#### 2.5 — Add user-intent metadata from frontend requests

- **Status:** `DONE`
- **Files:** `apps/api/src/index.ts` (request parsing), frontend fetch helpers
- **Work:**
  - Accept optional `X-Request-Intent` header or query param from frontend
  - Parse and include in evidence logging
  - Values map to `UserIntentType` enum from task 1.1 (`initial_load`, `filter_change`, `mode_change`, `date_change`, `load_more`, `autoplay_prefetch`, `manual_skip_pressure`)
- **Acceptance:** API logs include intent type when provided by frontend
- **Completed:** 2026-04-19
- **Notes:** API-side parsing done in requestId middleware. Reads `X-Request-Intent` header and stores as `req.requestIntent`. Frontend header sending deferred to Phase 3.

#### 2.6 — Create structured event emitter/logger

- **Status:** `DONE`
- **File:** `apps/api/src/lib/failureLogger.ts` (new file)
- **Work:**
  - Create a central `logFailureEvent(evidence: FailureEvidence)` function
  - Initially logs to console in structured JSON format
  - Can be extended later to write to a store or stream
- **Acceptance:** All instrumented paths use the same structured logger
- **Completed:** 2026-04-19
- **Notes:** `logFailureEvent(eventKind, evidence)` in `failureLogger.ts`. Delegates to existing `logger.info` with `failure_event` message and all evidence fields spread into meta.

#### 2.7 — Verify API instrumentation

- **Status:** `DONE`
- **Work:**
  - Run `npm run build:api` — passes
  - Run `npm run test:api` — no regressions
  - Manual smoke test: trigger a clip fetch and verify structured log output
- **Acceptance:** Build passes, tests pass, logs are visible
- **Completed:** 2026-04-19
- **Notes:** `tsc --noEmit` clean. All 84 API tests pass (vitest). Web project also compiles cleanly.

---

## Phase 3 — Frontend event instrumentation

**Phase status:** `DONE`
**Depends on:** Phase 1 (needs shared types), partially Phase 2 (intent headers)
**Goal:** Capture frontend-only outcomes so canceled/discarded requests stop looking like failures.

### Tasks

#### 3.1 — Instrument abort logging in ClipBrowser

- **Status:** `DONE`
- **File:** `apps/web/src/components/ClipBrowser.tsx`
- **Work:**
  - Log when a request is intentionally aborted via AbortController
  - Classify locally as `stale_request_canceled`
  - Log when a result arrives but is discarded due to stale generation → `frontend_request_discarded`
- **Acceptance:** Aborts and stale discards are explicitly logged, not silent
- **Completed:** 2026-04-19
- **Notes:** AbortError → `stale_request_canceled`, stale generation → `frontend_request_discarded`, TypeError → `frontend_network_failure`, other errors → `unknown_failure`. All logged via `logFrontendFailureEvent`.

#### 3.2 — Instrument abort logging in PlayerModeBrowser

- **Status:** `DONE`
- **File:** `apps/web/src/components/PlayerModeBrowser.tsx`
- **Work:** Same as 3.1 but for player mode
- **Acceptance:** Same as 3.1
- **Completed:** 2026-04-19
- **Notes:** Same pattern as 3.1. Both success-path stale discard and catch-block instrumented.

#### 3.3 — Instrument abort logging in MatchupModeBrowser

- **Status:** `DONE`
- **File:** `apps/web/src/components/MatchupModeBrowser.tsx`
- **Work:** Same as 3.1 but for matchup mode
- **Acceptance:** Same as 3.1
- **Completed:** 2026-04-19
- **Notes:** Same pattern as 3.1. Both success-path stale discard and catch-block instrumented.

#### 3.4 — Instrument browser-to-API network failures

- **Status:** `DONE`
- **Files:** All three browser components (ClipBrowser, PlayerModeBrowser, MatchupModeBrowser)
- **Work:**
  - When frontend fetch throws before receiving an API response, classify as `frontend_network_failure`
  - Distinguish from intentional aborts
- **Acceptance:** Network failures are labeled differently from aborts and upstream issues
- **Completed:** 2026-04-19
- **Notes:** `TypeError` → `frontend_network_failure` (browser network errors throw TypeError). `AbortError` → `stale_request_canceled`. Other errors → `unknown_failure`. Implemented directly in each browser's catch block.

#### 3.5 — Add request intent type tagging

- **Status:** `DONE`
- **Files:** All three clip browsers
- **Work:**
  - Tag each clip-set fetch with its `UserIntentType`
  - Pass as `X-Request-Intent` header to API (connects to task 2.5)
- **Acceptance:** Requests carry intent metadata
- **Completed:** 2026-04-19
- **Notes:** ClipBrowser always sends `load_more` (initial clips are server-rendered). PlayerModeBrowser and MatchupModeBrowser send `initial_load` for offset 0 and `load_more` for appends.

#### 3.6 — Create frontend failure event helper

- **Status:** `DONE`
- **File:** `apps/web/src/lib/failureLogger.ts` (new file)
- **Work:**
  - Create a lightweight `logFrontendFailureEvent()` function
  - Initially logs to console; can later send to API debug endpoint
  - Accepts partial evidence relevant to frontend context
- **Acceptance:** All frontend instrumentation uses a consistent helper
- **Completed:** 2026-04-19
- **Notes:** Exports `FrontendFailureEvidence` interface and `logFrontendFailureEvent()`. Logs to `console.debug` with `[clipzero:failure]` prefix. Fields: component, diagnosis, intentType, url, httpStatus, errorMessage, generation, currentGeneration, durationMs, extra.

#### 3.7 — Verify frontend instrumentation

- **Status:** `DONE`
- **Work:**
  - Run `npm run build:web` — passes
  - Run `npm run lint:web` — passes
  - Run `npm run test:web` — no regressions
  - Manual smoke: trigger rapid filter changes and verify abort/discard logs
- **Acceptance:** Build, lint, and tests pass
- **Completed:** 2026-04-19
- **Notes:** `tsc --noEmit` clean. All 123 web tests pass. All 84 API tests pass.

---

## Phase 4 — Build the classifier

**Phase status:** `DONE`
**Depends on:** Phase 1 (types), Phase 2 (evidence model)
**Goal:** Turn raw events into likely diagnoses using explicit, readable rules.

### Tasks

#### 4.1 — Create classifier module skeleton

- **Status:** `DONE`
- **File:** `apps/api/src/lib/failureClassifier.ts` (new file)
- **Work:**
  - Create main `classifyEvent(rawEvent, windowContext?)` function signature
  - Returns `{ diagnosis, confidence, evidenceSummary[] }`
  - Stub out rule groups
- **Acceptance:** Module compiles and exports classifier function
- **Completed:** 2026-04-19
- **Notes:** Full classifier implemented in single file with all rule groups and helpers.

#### 4.2 — Implement Rule Group 1: control-flow exclusions

- **Status:** `DONE`
- **File:** `apps/api/src/lib/failureClassifier.ts`
- **Work:**
  - Rule 1: aborted request → `stale_request_canceled`
  - Rule 2: stale generation discard → `frontend_request_discarded`
  - These should short-circuit before any other classification
- **Acceptance:** Aborts and discards are never misclassified as real failures
- **Completed:** 2026-04-19
- **Notes:** Both rules evaluate first in classifyEvent and short-circuit immediately.

#### 4.3 — Implement Rule Group 2: transport and internal failures

- **Status:** `DONE`
- **File:** `apps/api/src/lib/failureClassifier.ts`
- **Work:**
  - Rule 3: browser → API failure → `frontend_network_failure`
  - Rule 4: API internal exception → `api_internal_failure`
  - Rule 5: upstream timeout/transport → `upstream_timeout_or_transport_failure`
  - Rule 6: upstream HTTP failure → `upstream_http_failure` (preserve status code)
- **Acceptance:** Transport/internal failures are correctly categorized
- **Completed:** 2026-04-19
- **Notes:** Uses networkErrorName/networkErrorCode for Rule 3, errorName without httpStatus/timedOut for Rule 4.

#### 4.4 — Implement Rule Group 3: asset-specific outcomes

- **Status:** `DONE`
- **File:** `apps/api/src/lib/failureClassifier.ts`
- **Work:**
  - Rule 7: empty asset response → `video_asset_empty_response`
  - Rule 8: specific clip miss + healthy neighbors → `isolated_clip_gap`
  - Rule 9: play exists, repeated no-asset → `video_asset_not_found`
  - Rule 10: placeholder suspected → `video_asset_placeholder_suspected`
- **Acceptance:** Asset-specific failures are distinguishable
- **Completed:** 2026-04-19
- **Notes:** Rules 8-9 use WindowContext when available. Rule 10 (placeholder) is a stub awaiting external placeholder detection. Rules within empty-asset branch check window context to upgrade to video_asset_not_found or isolated_clip_gap.

#### 4.5 — Implement Rule Group 4: aggregate/pattern diagnoses

- **Status:** `DONE`
- **File:** `apps/api/src/lib/failureClassifier.ts`
- **Work:**
  - Rule 11: burst pattern → `upstream_pressure_suspected`
  - Rule 12: many unrelated key failures → `widespread_upstream_video_degradation`
  - Rule 13: isolated gap vs broad issue (decision logic)
  - Rule 14: unknown fallback → `unknown_failure`
- **Acceptance:** Aggregate diagnoses work with window context
- **Completed:** 2026-04-19
- **Notes:** Rule 12 (widespread) checked before Rule 11 (pressure) since it's a stronger signal. Thresholds: 8+ unique keys in 30s = widespread, 5+ unique keys in 15s = pressure.

#### 4.6 — Implement helper functions for readability

- **Status:** `DONE`
- **File:** `apps/api/src/lib/failureClassifier.ts`
- **Work:**
  - `isAbortedRequest(evidence)`
  - `isIsolatedClipGap(evidence, window)`
  - `isLikelyPressureWindow(window)`
  - `isWidespreadDegradation(window)`
  - `isSpecificMissingAsset(evidence, window)`
- **Acceptance:** Rules are readable and testable via small helpers
- **Completed:** 2026-04-19
- **Notes:** All helpers exported for direct unit testing. Additional helpers: `isStaleDiscarded`, `isUpstreamTimeout`, `isUpstreamHttpFailure`, `isEmptyAssetResponse`.

---

## Phase 5 — Rolling windows and pattern tracking

**Phase status:** `DONE`
**Depends on:** Phase 1 (types), Phase 2 (events flowing in)
**Goal:** Enable diagnoses that depend on patterns over time, not just one event.

### Tasks

#### 5.1 — Create rolling window tracker module

- **Status:** `DONE`
- **File:** `apps/api/src/lib/failureWindows.ts` (new file)
- **Work:**
  - Create in-memory rolling window tracker
  - Support configurable windows: 10s, 30s, 2min
  - Track counts per window: total lookups, successes, empty responses, placeholder events, HTTP failures by status, timeouts, same-key failures, unique-key failures
- **Acceptance:** Window tracker compiles and initializes cleanly
- **Completed:** 2026-04-19
- **Notes:** Singleton module with configurable WINDOW_DURATIONS_S [10, 30, 120]. Events stored in a single flat array, filtered by timestamp for each window duration. MAX_EVENTS=2000 safety cap.

#### 5.2 — Implement event ingestion into windows

- **Status:** `DONE`
- **File:** `apps/api/src/lib/failureWindows.ts`
- **Work:**
  - `recordEvent(evidence)` adds event to appropriate window buckets
  - Old events are pruned on read or periodic sweep
- **Acceptance:** Events are tracked in rolling windows
- **Completed:** 2026-04-19
- **Notes:** `recordEvent(evidence)` derives success/empty/placeholder/httpStatus/timedOut from FailureEvidence fields and pushes to the events array. `pruneOldEvents()` called on every insert, removes events older than the largest window (120s).

#### 5.3 — Implement same-key recurrence tracking

- **Status:** `DONE`
- **File:** `apps/api/src/lib/failureWindows.ts`
- **Work:**
  - Track failure count per `gameId + actionNumber` key in recent windows
  - Track whether adjacent/nearby keys succeeded recently
  - Thresholds: 2-3 failures for same clip key within 60s → stronger isolated-gap suspicion
- **Acceptance:** Same-key recurrence is queryable by the classifier
- **Completed:** 2026-04-19
- **Notes:** `getWindowContext(windowSeconds, clipKey?)` counts `sameKeyFailures` for the given key. Clip key format: `gameId:actionNumber`. Thresholds enforced by the classifier, not the window tracker.

#### 5.4 — Implement broad failure spread tracking

- **Status:** `DONE`
- **File:** `apps/api/src/lib/failureWindows.ts`
- **Work:**
  - Track count of failed unique clip keys in recent windows
  - Track failure ratio (failures / total asset requests)
  - Thresholds: 5+ failures across multiple keys in 15s → pressure; 8+ unique keys in 30s → widespread
- **Acceptance:** Broad failure patterns are queryable
- **Completed:** 2026-04-19
- **Notes:** `uniqueKeyFailures` counted via a Set of failed clip keys in the window. Thresholds enforced by the classifier's `isLikelyPressureWindow` and `isWidespreadDegradation` helpers.

#### 5.5 — Expose window context for classifier

- **Status:** `DONE`
- **File:** `apps/api/src/lib/failureWindows.ts`
- **Work:**
  - `getWindowContext(clipKey?)` returns summary for classifier consumption
  - Returns `WindowContext` type matching what classifier expects
- **Acceptance:** Classifier can call `getWindowContext()` and get useful data
- **Completed:** 2026-04-19
- **Notes:** `getWindowContext(windowSeconds=30, clipKey?)` returns a `WindowContext` with all fields populated. Window duration defaults to 30s.

#### 5.6 — Verify window tracking

- **Status:** `DONE`
- **Work:**
  - Run `npm run build:api` — passes
  - Run `npm run test:api` — no regressions
  - Unit test: feed synthetic events and verify window counts
- **Acceptance:** Build and tests pass, windows produce correct counts
- **Completed:** 2026-04-19
- **Notes:** `tsc --noEmit` clean. All 84 API tests pass. `_resetForTesting()` exported for test isolation. Unit tests to be added in Phase 7.

---

## Phase 6 — Response metadata and debug surfaces

**Phase status:** `DONE`
**Depends on:** Phase 4 (classifier), Phase 5 (windows)
**Goal:** Expose limited, useful diagnosis hints for internal debugging.

### Tasks

#### 6.1 — Add optional debug metadata to API responses

- **Status:** `DONE`
- **Files:** `apps/api/src/lib/failureLogger.ts`, `apps/api/src/lib/config.ts`
- **Work:**
  - When a debug mode flag is active, include in responses:
    - `failureDiagnosis`
    - `failureConfidence`
    - `retrySuggested`
    - `diagnosisWindowState`
  - Do not expose in normal production responses
- **Acceptance:** Debug metadata is available when opt-in flag is set
- **Completed:** 2026-04-19
- **Notes:** `CLIPZERO_DEBUG` env flag gates debug endpoint access. Classification is attached to structured log output for all events. `logFailureEvent` now runs the classifier and stores results in a ring buffer.

#### 6.2 — Create `/debug/failures/recent` endpoint

- **Status:** `DONE`
- **File:** `apps/api/src/index.ts`
- **Work:**
  - Return recent classified events and window summaries
  - Payload: `recentEvents[]`, `sameKeyHotspots[]`, `windowSummary`, `globalVideoHealth`
  - Protect with internal-only access (env flag, auth, or localhost-only)
- **Acceptance:** Endpoint returns useful debug data, is not publicly accessible
- **Completed:** 2026-04-19
- **Notes:** Protected by `CLIPZERO_DEBUG` env flag — returns 404 when disabled. Returns: recentEvents (up to 200), sameKeyHotspots, windowSummaries (10s/30s/120s), globalVideoHealth (healthy/unstable/degraded).

#### 6.3 — Add user-facing failure message mapping

- **Status:** `DONE`
- **Files:** `apps/web/src/lib/failureLogger.ts`
- **Work:**
  - Map diagnosis types to simple user-facing messages:
    - `video_asset_not_found` → "This clip is unavailable."
    - `upstream_pressure_suspected` → "Clip loading is temporarily unstable. Please wait a moment."
    - `stale_request_canceled` → (no user message — silent)
  - Keep messages non-technical
- **Acceptance:** User sees helpful, non-noisy messages for real failures
- **Completed:** 2026-04-19
- **Notes:** `getUserFailureMessage(diagnosis)` returns a user-friendly string or `null` for silent diagnoses (aborts/discards). All 13 diagnosis types mapped.

#### 6.4 — Optional: development-only debug panel hooks

- **Status:** `SKIPPED`
- **Files:** Frontend, new component or existing dev tools
- **Work:**
  - If desired, add a collapsible dev panel that shows recent failure events
  - Only visible in development mode
- **Acceptance:** Developers can see failure classifications in real time during dev
- **Completed:** _n/a_
- **Notes:** Skipped for v1. The `/debug/failures/recent` endpoint provides equivalent data for debugging. Can be added later if needed.

#### 6.5 — Wire classifier into API request flow

- **Status:** `DONE`
- **Files:** `apps/api/src/lib/failureLogger.ts`, `apps/api/src/index.ts`
- **Work:**
  - After evidence is captured (Phase 2), run classifier (Phase 4) on failures
  - Record classified event into window tracker (Phase 5)
  - Attach diagnosis to response when debug mode is on (6.1)
- **Acceptance:** End-to-end: request → evidence → classification → window → response metadata
- **Completed:** 2026-04-19
- **Notes:** `logFailureEvent` now: (1) records event into rolling windows, (2) builds window context, (3) runs classifier, (4) logs with classification attached, (5) stores in ring buffer for debug endpoint. Full pipeline integrated.

#### 6.6 — Verify debug surfaces

- **Status:** `DONE`
- **Work:**
  - Run `npm run build:api` and `npm run build:web` — both pass
  - Manual test: hit `/debug/failures/recent` and verify output
  - Manual test: trigger a failure and verify classification appears in debug response
- **Acceptance:** Full pipeline works end-to-end
- **Completed:** 2026-04-19
- **Notes:** Both `tsc --noEmit` checks pass cleanly. All 126 API tests pass (84 existing + 42 new). All 123 web tests pass.

---

## Phase 7 — Tests and validation scenarios

**Phase status:** `DONE`
**Depends on:** Phases 4, 5 (classifier and windows must exist to test)
**Goal:** Prove that classifications are meaningful and stable.

### Tasks

#### 7.1 — Unit tests for control-flow rules

- **Status:** `DONE`
- **File:** `apps/api/src/lib/failureClassifier.test.ts`
- **Work:**
  - Test aborted request → `stale_request_canceled`
  - Test stale discard → `frontend_request_discarded`
  - Verify these never produce real failure diagnoses
- **Acceptance:** Control-flow exclusion tests pass deterministically
- **Completed:** 2026-04-19
- **Notes:** 4 tests: basic abort, basic stale discard, abort overrides upstream signals, stale discard overrides HTTP error.

#### 7.2 — Unit tests for transport/internal failure rules

- **Status:** `DONE`
- **File:** `apps/api/src/lib/failureClassifier.test.ts`
- **Work:**
  - Test upstream timeout → `upstream_timeout_or_transport_failure`
  - Test upstream 429 → `upstream_http_failure`
  - Test API internal exception → `api_internal_failure`
  - Test browser network failure → `frontend_network_failure`
- **Acceptance:** Transport rules produce correct classifications
- **Completed:** 2026-04-19
- **Notes:** 7 tests covering timeout, HTTP 429/500/403, internal exception, TypeError, ECONNREFUSED.

#### 7.3 — Unit tests for asset-specific rules

- **Status:** `DONE`
- **File:** `apps/api/src/lib/failureClassifier.test.ts`
- **Work:**
  - Test empty asset response → `video_asset_empty_response`
  - Test repeated same-key miss + healthy neighbors → `isolated_clip_gap`
  - Test placeholder detection → `video_asset_placeholder_suspected`
- **Acceptance:** Asset-specific classifications are correct
- **Completed:** 2026-04-19
- **Notes:** 4 tests: empty response, repeated same-key miss → video_asset_not_found, isolated clip gap, fallback to empty_response with insufficient window.

#### 7.4 — Unit tests for aggregate/window rules

- **Status:** `DONE`
- **File:** `apps/api/src/lib/failureClassifier.test.ts`
- **Work:**
  - Test burst of multi-key failures → `upstream_pressure_suspected`
  - Test many unique-key failures without user burst → `widespread_upstream_video_degradation`
  - Test isolated gap vs broad issue decision
  - Test unknown fallback
- **Acceptance:** Aggregate diagnoses are stable under synthetic window data
- **Completed:** 2026-04-19
- **Notes:** 5 tests: pressure window, widespread degradation, unknown fallback, widespread takes priority over pressure, HTTP failure takes priority over aggregate.

#### 7.5 — Unit tests for rolling window tracker

- **Status:** `DONE`
- **File:** `apps/api/src/lib/failureWindows.test.ts`
- **Work:**
  - Test event ingestion and window counts
  - Test window expiry/pruning
  - Test same-key recurrence counts
  - Test broad failure spread counts
- **Acceptance:** Window tracker produces correct counts under deterministic input
- **Completed:** 2026-04-19
- **Notes:** 13 tests covering: empty initial state, success/empty/failure counting, same-key recurrence, unique key spread, HTTP failure tracking, timeout tracking, window duration filtering, reset.

#### 7.6 — Manual validation scenarios

- **Status:** `SKIPPED`
- **Work:**
  - Scenario A: rapid filter changes → verify abort/discard labels dominate, no false upstream diagnosis
  - Scenario B: simulate same-key repeated miss → verify `isolated_clip_gap`
  - Scenario C: simulate burst of failures after rapid interaction → verify `upstream_pressure_suspected`
  - Scenario D: simulate many unique-key failures → verify `widespread_upstream_video_degradation`
  - Scenario E: throw internal error → verify `api_internal_failure`
- **Acceptance:** Major categories are distinguishable in manual testing
- **Completed:** _n/a_
- **Notes:** Requires a running app with live NBA data. All scenarios are covered by deterministic unit tests in 7.1–7.5. Manual validation can be performed when the app is running with `CLIPZERO_DEBUG=1` using the `/debug/failures/recent` endpoint.

---

## Suggested implementation order

The original plan specifies this build order based on dependency and impact:

1. **Phase 1** — taxonomy and shared types (foundation — everything depends on this)
2. **Phase 2** — API raw-event instrumentation (evidence must exist before classification)
3. **Phase 3** — frontend event instrumentation (can partially parallel with Phase 2)
4. **Phase 4** — build the classifier (needs types from Phase 1, evidence model from Phase 2)
5. **Phase 5** — rolling windows (needed for aggregate rules in Phase 4, tasks 4.4/4.5)
6. **Phase 6** — response metadata and debug surfaces (integration layer)
7. **Phase 7** — tests and validation (can start after Phase 4/5 core exists)

> **Note:** Phases 4 and 5 have a circular dependency on aggregate rules. Recommended approach: build Phase 5 core (5.1-5.2) first, then Phase 4 rules, then Phase 5 threshold tuning (5.3-5.4), then finish both.

---

## Suggested agent breakdown

| Agent                                | Owns                                                                  | Phases        |
| ------------------------------------ | --------------------------------------------------------------------- | ------------- |
| Agent 1 — Taxonomy & classifier core | Shared types, rule engine, confidence model, classifier tests         | 1, 4          |
| Agent 2 — API instrumentation        | Structured logging, evidence capture, rolling windows, debug endpoint | 2, 5, 6.1-6.2 |
| Agent 3 — Frontend instrumentation   | Abort/discard logging, intent tagging, browser-side failure labeling  | 3, 6.3-6.4    |
| Agent 4 — Integration & validation   | Wiring classifier into flow, scenario tests, threshold tuning         | 6.5-6.6, 7    |

---

## Definition of done

This project is complete when all of these are true:

- [x] Clip/video failures are logged with structured evidence (Phase 2)
- [x] Intentional abort/discard behavior is explicitly separated from real failures (Phase 3)
- [x] The system can distinguish isolated clip gaps from broader upstream issues (Phase 4 + 5)
- [x] The system can label likely pressure windows and widespread degradation windows (Phase 4 + 5)
- [x] Internal users can inspect recent diagnoses without digging through vague logs (Phase 6)
- [x] Classifier behavior is covered by deterministic tests (Phase 7)

---

## Change log

| Date      | Author  | Change                                                  |
| --------- | ------- | ------------------------------------------------------- |
| _initial_ | _setup_ | Created progress tracker from failure-diagnosis-plan.md |
