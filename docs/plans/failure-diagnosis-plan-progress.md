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

| Status | Meaning |
|---|---|
| `NOT_STARTED` | No work has begun |
| `IN_PROGRESS` | Actively being worked on |
| `DONE` | Complete and verified |
| `BLOCKED` | Cannot proceed — see notes |
| `NEEDS_REVISION` | Was done but needs rework — see notes |
| `SKIPPED` | Intentionally deferred or deemed unnecessary — see notes |

### Progress summary format

Update this summary block every time you change any task status:

---

## Progress Summary

> **Last updated:** _not yet started_
> **Last updated by:** _n/a_
> **Current phase:** _n/a_
> **Overall progress:** 0 / 42 tasks complete
> **Blocked tasks:** 0

| Phase | Status | Tasks Done | Tasks Total |
|---|---|---|---|
| Phase 1 — Taxonomy & shared types | NOT_STARTED | 0 | 4 |
| Phase 2 — API raw-event instrumentation | NOT_STARTED | 0 | 7 |
| Phase 3 — Frontend event instrumentation | NOT_STARTED | 0 | 7 |
| Phase 4 — Build the classifier | NOT_STARTED | 0 | 6 |
| Phase 5 — Rolling windows & pattern tracking | NOT_STARTED | 0 | 6 |
| Phase 6 — Response metadata & debug surfaces | NOT_STARTED | 0 | 6 |
| Phase 7 — Tests & validation scenarios | NOT_STARTED | 0 | 6 |

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

**Phase status:** `NOT_STARTED`
**Depends on:** nothing (entry point)
**Goal:** Create the shared language for failures — enums, types, constants used across API and frontend.

### Tasks

#### 1.1 — Create API failure type definitions
- **Status:** `NOT_STARTED`
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
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 1.2 — Define evidence model types
- **Status:** `NOT_STARTED`
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
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 1.3 — Create frontend failure type definitions (mirrored)
- **Status:** `NOT_STARTED`
- **File:** `apps/web/src/lib/failureTypes.ts`
- **Work:**
  - Mirror the subset of types needed on the frontend:
    - `FailureDiagnosis` enum (same values)
    - `DiagnosisConfidence` enum
    - `UserIntentType` enum
    - Frontend-specific evidence fields
  - Ensure vocabulary is identical to API types (same string values)
- **Acceptance:** Frontend and API share identical failure vocabulary
- **Completed:** _n/a_
- **Notes:** Consider whether a shared package is worth it. For v1, mirrored files are fine.

#### 1.4 — Verify type consistency
- **Status:** `NOT_STARTED`
- **Work:**
  - Confirm both files compile cleanly (`npm run build:api`, `npm run build:web`)
  - Confirm enum values are identical between API and frontend
  - Confirm no name collisions with existing types
- **Acceptance:** Both builds pass with new types
- **Completed:** _n/a_
- **Notes:** _n/a_

---

## Phase 2 — API raw-event instrumentation

**Phase status:** `NOT_STARTED`
**Depends on:** Phase 1 (needs shared types)
**Goal:** Capture enough evidence in the API to classify clip/video failures meaningfully.

### Tasks

#### 2.1 — Add request ID and route context propagation
- **Status:** `NOT_STARTED`
- **Files:** `apps/api/src/index.ts`, possibly `apps/api/src/lib/logger.ts`
- **Work:**
  - Generate a unique `requestId` per incoming API request
  - Propagate `requestId` and `route` context into lower-level fetch/cache functions
  - Use middleware or a context-passing pattern
- **Acceptance:** Every API request has a traceable `requestId` in logs
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 2.2 — Instrument video asset fetch path
- **Status:** `NOT_STARTED`
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
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 2.3 — Instrument play-by-play fetch path
- **Status:** `NOT_STARTED`
- **Files:** Play-by-play fetch wrapper locations
- **Work:**
  - Emit structured evidence for play-by-play fetches
  - Include upstream HTTP status, timeout, and duration
- **Acceptance:** PBP fetch outcomes are logged with evidence
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 2.4 — Instrument game log / matchup fetch paths
- **Status:** `NOT_STARTED`
- **Files:** Game log and matchup fetch wrapper locations
- **Work:**
  - Emit structured evidence for game log and matchup fetches
- **Acceptance:** Supporting fetch paths are instrumented
- **Completed:** _n/a_
- **Notes:** Lower priority than 2.2 and 2.3 — can be done later if needed

#### 2.5 — Add user-intent metadata from frontend requests
- **Status:** `NOT_STARTED`
- **Files:** `apps/api/src/index.ts` (request parsing), frontend fetch helpers
- **Work:**
  - Accept optional `X-Request-Intent` header or query param from frontend
  - Parse and include in evidence logging
  - Values: `user_action`, `load_more`, `prefetch`, `autoplay`
- **Acceptance:** API logs include intent type when provided by frontend
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 2.6 — Create structured event emitter/logger
- **Status:** `NOT_STARTED`
- **File:** `apps/api/src/lib/failureLogger.ts` (new file)
- **Work:**
  - Create a central `logFailureEvent(evidence: FailureEvidence)` function
  - Initially logs to console in structured JSON format
  - Can be extended later to write to a store or stream
- **Acceptance:** All instrumented paths use the same structured logger
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 2.7 — Verify API instrumentation
- **Status:** `NOT_STARTED`
- **Work:**
  - Run `npm run build:api` — passes
  - Run `npm run test:api` — no regressions
  - Manual smoke test: trigger a clip fetch and verify structured log output
- **Acceptance:** Build passes, tests pass, logs are visible
- **Completed:** _n/a_
- **Notes:** _n/a_

---

## Phase 3 — Frontend event instrumentation

**Phase status:** `NOT_STARTED`
**Depends on:** Phase 1 (needs shared types), partially Phase 2 (intent headers)
**Goal:** Capture frontend-only outcomes so canceled/discarded requests stop looking like failures.

### Tasks

#### 3.1 — Instrument abort logging in ClipBrowser
- **Status:** `NOT_STARTED`
- **File:** `apps/web/src/components/ClipBrowser.tsx`
- **Work:**
  - Log when a request is intentionally aborted via AbortController
  - Classify locally as `stale_request_canceled`
  - Log when a result arrives but is discarded due to stale generation → `frontend_request_discarded`
- **Acceptance:** Aborts and stale discards are explicitly logged, not silent
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 3.2 — Instrument abort logging in PlayerModeBrowser
- **Status:** `NOT_STARTED`
- **File:** `apps/web/src/components/PlayerModeBrowser.tsx`
- **Work:** Same as 3.1 but for player mode
- **Acceptance:** Same as 3.1
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 3.3 — Instrument abort logging in MatchupModeBrowser
- **Status:** `NOT_STARTED`
- **File:** `apps/web/src/components/MatchupModeBrowser.tsx`
- **Work:** Same as 3.1 but for matchup mode
- **Acceptance:** Same as 3.1
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 3.4 — Instrument browser-to-API network failures
- **Status:** `NOT_STARTED`
- **Files:** Frontend fetch helpers under `apps/web/src/lib/`
- **Work:**
  - When frontend fetch throws before receiving an API response, classify as `frontend_network_failure`
  - Distinguish from intentional aborts
- **Acceptance:** Network failures are labeled differently from aborts and upstream issues
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 3.5 — Add request intent type tagging
- **Status:** `NOT_STARTED`
- **Files:** All three clip browsers, frontend fetch helpers
- **Work:**
  - Tag each clip-set fetch with its `UserIntentType`
  - Pass as `X-Request-Intent` header to API (connects to task 2.5)
- **Acceptance:** Requests carry intent metadata
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 3.6 — Create frontend failure event helper
- **Status:** `NOT_STARTED`
- **File:** `apps/web/src/lib/failureLogger.ts` (new file)
- **Work:**
  - Create a lightweight `logFrontendFailureEvent()` function
  - Initially logs to console; can later send to API debug endpoint
  - Accepts partial evidence relevant to frontend context
- **Acceptance:** All frontend instrumentation uses a consistent helper
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 3.7 — Verify frontend instrumentation
- **Status:** `NOT_STARTED`
- **Work:**
  - Run `npm run build:web` — passes
  - Run `npm run lint:web` — passes
  - Run `npm run test:web` — no regressions
  - Manual smoke: trigger rapid filter changes and verify abort/discard logs
- **Acceptance:** Build, lint, and tests pass
- **Completed:** _n/a_
- **Notes:** _n/a_

---

## Phase 4 — Build the classifier

**Phase status:** `NOT_STARTED`
**Depends on:** Phase 1 (types), Phase 2 (evidence model)
**Goal:** Turn raw events into likely diagnoses using explicit, readable rules.

### Tasks

#### 4.1 — Create classifier module skeleton
- **Status:** `NOT_STARTED`
- **File:** `apps/api/src/lib/failureClassifier.ts` (new file)
- **Work:**
  - Create main `classifyEvent(rawEvent, windowContext?)` function signature
  - Returns `{ diagnosis, confidence, evidenceSummary[] }`
  - Stub out rule groups
- **Acceptance:** Module compiles and exports classifier function
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 4.2 — Implement Rule Group 1: control-flow exclusions
- **Status:** `NOT_STARTED`
- **File:** `apps/api/src/lib/failureClassifier.ts`
- **Work:**
  - Rule 1: aborted request → `stale_request_canceled`
  - Rule 2: stale generation discard → `frontend_request_discarded`
  - These should short-circuit before any other classification
- **Acceptance:** Aborts and discards are never misclassified as real failures
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 4.3 — Implement Rule Group 2: transport and internal failures
- **Status:** `NOT_STARTED`
- **File:** `apps/api/src/lib/failureClassifier.ts`
- **Work:**
  - Rule 3: browser → API failure → `frontend_network_failure`
  - Rule 4: API internal exception → `api_internal_failure`
  - Rule 5: upstream timeout/transport → `upstream_timeout_or_transport_failure`
  - Rule 6: upstream HTTP failure → `upstream_http_failure` (preserve status code)
- **Acceptance:** Transport/internal failures are correctly categorized
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 4.4 — Implement Rule Group 3: asset-specific outcomes
- **Status:** `NOT_STARTED`
- **File:** `apps/api/src/lib/failureClassifier.ts`
- **Work:**
  - Rule 7: empty asset response → `video_asset_empty_response`
  - Rule 8: specific clip miss + healthy neighbors → `isolated_clip_gap`
  - Rule 9: play exists, repeated no-asset → `video_asset_not_found`
  - Rule 10: placeholder suspected → `video_asset_placeholder_suspected`
- **Acceptance:** Asset-specific failures are distinguishable
- **Completed:** _n/a_
- **Notes:** Rules 8-10 require window context — may need Phase 5 partially done

#### 4.5 — Implement Rule Group 4: aggregate/pattern diagnoses
- **Status:** `NOT_STARTED`
- **File:** `apps/api/src/lib/failureClassifier.ts`
- **Work:**
  - Rule 11: burst pattern → `upstream_pressure_suspected`
  - Rule 12: many unrelated key failures → `widespread_upstream_video_degradation`
  - Rule 13: isolated gap vs broad issue (decision logic)
  - Rule 14: unknown fallback → `unknown_failure`
- **Acceptance:** Aggregate diagnoses work with window context
- **Completed:** _n/a_
- **Notes:** Requires Phase 5 rolling windows — implement in parallel or after

#### 4.6 — Implement helper functions for readability
- **Status:** `NOT_STARTED`
- **File:** `apps/api/src/lib/failureClassifier.ts`
- **Work:**
  - `isAbortedRequest(evidence)`
  - `isIsolatedClipGap(evidence, window)`
  - `isLikelyPressureWindow(window)`
  - `isWidespreadDegradation(window)`
  - `isSpecificMissingAsset(evidence, window)`
- **Acceptance:** Rules are readable and testable via small helpers
- **Completed:** _n/a_
- **Notes:** _n/a_

---

## Phase 5 — Rolling windows and pattern tracking

**Phase status:** `NOT_STARTED`
**Depends on:** Phase 1 (types), Phase 2 (events flowing in)
**Goal:** Enable diagnoses that depend on patterns over time, not just one event.

### Tasks

#### 5.1 — Create rolling window tracker module
- **Status:** `NOT_STARTED`
- **File:** `apps/api/src/lib/failureWindows.ts` (new file)
- **Work:**
  - Create in-memory rolling window tracker
  - Support configurable windows: 10s, 30s, 2min
  - Track counts per window: total lookups, successes, empty responses, placeholder events, HTTP failures by status, timeouts, same-key failures, unique-key failures
- **Acceptance:** Window tracker compiles and initializes cleanly
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 5.2 — Implement event ingestion into windows
- **Status:** `NOT_STARTED`
- **File:** `apps/api/src/lib/failureWindows.ts`
- **Work:**
  - `recordEvent(evidence)` adds event to appropriate window buckets
  - Old events are pruned on read or periodic sweep
- **Acceptance:** Events are tracked in rolling windows
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 5.3 — Implement same-key recurrence tracking
- **Status:** `NOT_STARTED`
- **File:** `apps/api/src/lib/failureWindows.ts`
- **Work:**
  - Track failure count per `gameId + actionNumber` key in recent windows
  - Track whether adjacent/nearby keys succeeded recently
  - Thresholds: 2-3 failures for same clip key within 60s → stronger isolated-gap suspicion
- **Acceptance:** Same-key recurrence is queryable by the classifier
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 5.4 — Implement broad failure spread tracking
- **Status:** `NOT_STARTED`
- **File:** `apps/api/src/lib/failureWindows.ts`
- **Work:**
  - Track count of failed unique clip keys in recent windows
  - Track failure ratio (failures / total asset requests)
  - Thresholds: 5+ failures across multiple keys in 15s → pressure; 8+ unique keys in 30s → widespread
- **Acceptance:** Broad failure patterns are queryable
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 5.5 — Expose window context for classifier
- **Status:** `NOT_STARTED`
- **File:** `apps/api/src/lib/failureWindows.ts`
- **Work:**
  - `getWindowContext(clipKey?)` returns summary for classifier consumption
  - Returns `WindowContext` type matching what classifier expects
- **Acceptance:** Classifier can call `getWindowContext()` and get useful data
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 5.6 — Verify window tracking
- **Status:** `NOT_STARTED`
- **Work:**
  - Run `npm run build:api` — passes
  - Run `npm run test:api` — no regressions
  - Unit test: feed synthetic events and verify window counts
- **Acceptance:** Build and tests pass, windows produce correct counts
- **Completed:** _n/a_
- **Notes:** _n/a_

---

## Phase 6 — Response metadata and debug surfaces

**Phase status:** `NOT_STARTED`
**Depends on:** Phase 4 (classifier), Phase 5 (windows)
**Goal:** Expose limited, useful diagnosis hints for internal debugging.

### Tasks

#### 6.1 — Add optional debug metadata to API responses
- **Status:** `NOT_STARTED`
- **Files:** `apps/api/src/index.ts`, relevant route handlers
- **Work:**
  - When a debug mode flag is active, include in responses:
    - `failureDiagnosis`
    - `failureConfidence`
    - `retrySuggested`
    - `diagnosisWindowState`
  - Do not expose in normal production responses
- **Acceptance:** Debug metadata is available when opt-in flag is set
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 6.2 — Create `/debug/failures/recent` endpoint
- **Status:** `NOT_STARTED`
- **File:** `apps/api/src/index.ts` or dedicated route file
- **Work:**
  - Return recent classified events and window summaries
  - Payload: `recentEvents[]`, `sameKeyHotspots[]`, `windowSummary`, `globalVideoHealth`
  - Protect with internal-only access (env flag, auth, or localhost-only)
- **Acceptance:** Endpoint returns useful debug data, is not publicly accessible
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 6.3 — Add user-facing failure message mapping
- **Status:** `NOT_STARTED`
- **Files:** Frontend components or a shared message map
- **Work:**
  - Map diagnosis types to simple user-facing messages:
    - `video_asset_not_found` → "This clip asset is unavailable"
    - `upstream_pressure_suspected` → "Clip loading is temporarily unstable"
    - `stale_request_canceled` → (no user message — silent)
  - Keep messages non-technical
- **Acceptance:** User sees helpful, non-noisy messages for real failures
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 6.4 — Optional: development-only debug panel hooks
- **Status:** `NOT_STARTED`
- **Files:** Frontend, new component or existing dev tools
- **Work:**
  - If desired, add a collapsible dev panel that shows recent failure events
  - Only visible in development mode
- **Acceptance:** Developers can see failure classifications in real time during dev
- **Completed:** _n/a_
- **Notes:** This is optional / nice-to-have for v1

#### 6.5 — Wire classifier into API request flow
- **Status:** `NOT_STARTED`
- **Files:** `apps/api/src/index.ts`, fetch wrappers
- **Work:**
  - After evidence is captured (Phase 2), run classifier (Phase 4) on failures
  - Record classified event into window tracker (Phase 5)
  - Attach diagnosis to response when debug mode is on (6.1)
- **Acceptance:** End-to-end: request → evidence → classification → window → response metadata
- **Completed:** _n/a_
- **Notes:** This is the integration task that ties Phases 2, 4, 5, 6 together

#### 6.6 — Verify debug surfaces
- **Status:** `NOT_STARTED`
- **Work:**
  - Run `npm run build:api` and `npm run build:web` — both pass
  - Manual test: hit `/debug/failures/recent` and verify output
  - Manual test: trigger a failure and verify classification appears in debug response
- **Acceptance:** Full pipeline works end-to-end
- **Completed:** _n/a_
- **Notes:** _n/a_

---

## Phase 7 — Tests and validation scenarios

**Phase status:** `NOT_STARTED`
**Depends on:** Phases 4, 5 (classifier and windows must exist to test)
**Goal:** Prove that classifications are meaningful and stable.

### Tasks

#### 7.1 — Unit tests for control-flow rules
- **Status:** `NOT_STARTED`
- **File:** `apps/api/src/lib/__tests__/failureClassifier.test.ts` (new file)
- **Work:**
  - Test aborted request → `stale_request_canceled`
  - Test stale discard → `frontend_request_discarded`
  - Verify these never produce real failure diagnoses
- **Acceptance:** Control-flow exclusion tests pass deterministically
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 7.2 — Unit tests for transport/internal failure rules
- **Status:** `NOT_STARTED`
- **File:** `apps/api/src/lib/__tests__/failureClassifier.test.ts`
- **Work:**
  - Test upstream timeout → `upstream_timeout_or_transport_failure`
  - Test upstream 429 → `upstream_http_failure`
  - Test API internal exception → `api_internal_failure`
  - Test browser network failure → `frontend_network_failure`
- **Acceptance:** Transport rules produce correct classifications
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 7.3 — Unit tests for asset-specific rules
- **Status:** `NOT_STARTED`
- **File:** `apps/api/src/lib/__tests__/failureClassifier.test.ts`
- **Work:**
  - Test empty asset response → `video_asset_empty_response`
  - Test repeated same-key miss + healthy neighbors → `isolated_clip_gap`
  - Test placeholder detection → `video_asset_placeholder_suspected`
- **Acceptance:** Asset-specific classifications are correct
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 7.4 — Unit tests for aggregate/window rules
- **Status:** `NOT_STARTED`
- **File:** `apps/api/src/lib/__tests__/failureClassifier.test.ts`
- **Work:**
  - Test burst of multi-key failures → `upstream_pressure_suspected`
  - Test many unique-key failures without user burst → `widespread_upstream_video_degradation`
  - Test isolated gap vs broad issue decision
  - Test unknown fallback
- **Acceptance:** Aggregate diagnoses are stable under synthetic window data
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 7.5 — Unit tests for rolling window tracker
- **Status:** `NOT_STARTED`
- **File:** `apps/api/src/lib/__tests__/failureWindows.test.ts` (new file)
- **Work:**
  - Test event ingestion and window counts
  - Test window expiry/pruning
  - Test same-key recurrence counts
  - Test broad failure spread counts
- **Acceptance:** Window tracker produces correct counts under deterministic input
- **Completed:** _n/a_
- **Notes:** _n/a_

#### 7.6 — Manual validation scenarios
- **Status:** `NOT_STARTED`
- **Work:**
  - Scenario A: rapid filter changes → verify abort/discard labels dominate, no false upstream diagnosis
  - Scenario B: simulate same-key repeated miss → verify `isolated_clip_gap`
  - Scenario C: simulate burst of failures after rapid interaction → verify `upstream_pressure_suspected`
  - Scenario D: simulate many unique-key failures → verify `widespread_upstream_video_degradation`
  - Scenario E: throw internal error → verify `api_internal_failure`
- **Acceptance:** Major categories are distinguishable in manual testing
- **Completed:** _n/a_
- **Notes:** These require a running app. Can be partially automated later.

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

| Agent | Owns | Phases |
|---|---|---|
| Agent 1 — Taxonomy & classifier core | Shared types, rule engine, confidence model, classifier tests | 1, 4 |
| Agent 2 — API instrumentation | Structured logging, evidence capture, rolling windows, debug endpoint | 2, 5, 6.1-6.2 |
| Agent 3 — Frontend instrumentation | Abort/discard logging, intent tagging, browser-side failure labeling | 3, 6.3-6.4 |
| Agent 4 — Integration & validation | Wiring classifier into flow, scenario tests, threshold tuning | 6.5-6.6, 7 |

---

## Definition of done

This project is complete when all of these are true:

- [ ] Clip/video failures are logged with structured evidence (Phase 2)
- [ ] Intentional abort/discard behavior is explicitly separated from real failures (Phase 3)
- [ ] The system can distinguish isolated clip gaps from broader upstream issues (Phase 4 + 5)
- [ ] The system can label likely pressure windows and widespread degradation windows (Phase 4 + 5)
- [ ] Internal users can inspect recent diagnoses without digging through vague logs (Phase 6)
- [ ] Classifier behavior is covered by deterministic tests (Phase 7)

---

## Change log

| Date | Author | Change |
|---|---|---|
| _initial_ | _setup_ | Created progress tracker from failure-diagnosis-plan.md |
