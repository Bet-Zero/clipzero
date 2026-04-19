# Request Resilience — QA Verification Plan

> **Source plan:** [request-resilience-plan.md](./request-resilience-plan.md)
> **Progress tracker:** [request-resilience-progress.md](./request-resilience-progress.md)

All code for the request resilience plan is complete. This document contains the 6 remaining manual verification steps needed to close out the plan. Each step maps to a progress tracker item and references specific QA scenarios.

Open the browser DevTools **Network** tab and **Console** before every test. Filter network requests to `/api/` to focus on clip and metadata fetches.

---

## Step 1 — Single-flight load-more protection

**Progress tracker step:** 2.4

### What to test

Rapid rail skipping cannot stack overlapping load-more requests, and autoplay near-end remains smooth.

### Instructions

1. Open game mode. Load a clip set with enough results to paginate (any game with 20+ plays).
2. Click forward through the rail rapidly — at least 10 clicks in under 3 seconds.
3. Continue clicking until you approach the end of the loaded clip set to trigger a load-more.
4. While a load-more is in flight (visible in Network tab), keep clicking forward to try to trigger another.
5. Repeat at the boundary between pages several times.

### What to look for

- **Network tab:** Only one `/api/clips` request with a given `offset` value is ever in flight at a time. No duplicate requests for the same offset.
- **Console:** No errors or warnings from overlapping load-more attempts.
- **UI:** Clips continue to load smoothly. Autoplay near the end of a page triggers exactly one load-more, not a burst.

### Pass criteria

- [ ] No duplicate offset requests visible in Network tab
- [ ] Only one load-more active at a time (no overlapping pagination requests)
- [ ] Autoplay near-end still triggers a single smooth load-more
- [ ] No error UI appears

---

## Step 2 — API-side request coalescing

**Progress tracker step:** 3.11

### What to test

Duplicate identical upstream fetches are collapsed at the API layer. Transient same-key misses are not hammered.

### Instructions

1. Start the API server locally with logging visible (`npm run dev` or equivalent).
2. Open the app and load a game with clips.
3. In a second browser tab, load the exact same game at the same time.
4. Watch the API server logs for `video_asset_inflight_deduped` entries — these indicate a second request joined an existing in-flight fetch instead of making a new upstream call.
5. To test null TTL suppression: find a clip where the video asset fails (or temporarily break a video asset endpoint). Reload the same clip set twice within 15 seconds and confirm the API does not re-fetch the same failed key.

### What to look for

- **API logs:** `video_asset_inflight_deduped` entries appear when concurrent identical requests arrive.
- **API logs:** No repeated upstream fetch for a key that just returned null within the last 15 seconds.
- **Network tab (browser):** Both tabs receive the same data without doubling upstream calls.

### Pass criteria

- [ ] Concurrent identical requests produce `video_asset_inflight_deduped` log entries
- [ ] A null/failed video asset key is not re-fetched within the 15-second suppression window
- [ ] API remains stable under repetitive same-key frontend requests
- [ ] `npm run test:api` passes

---

## Step 3 — Debounce of high-churn filter changes

**Progress tracker step:** 4.5

### What to test

Rapid filter clicks collapse into one effective network request. Controls feel responsive. No lag in normal usage.

### Instructions

#### Game mode (Scenario 1)

1. Open game mode with a loaded clip set.
2. Change the play type filter 3–4 times quickly (within 1 second).
3. Toggle a team/player filter on and off rapidly.
4. Switch quarter 3+ times in under 2 seconds.
5. Watch the Network tab throughout.

#### Player mode (Scenario 4)

1. Switch to player mode. Search and select a player.
2. Rapidly change play type, opponent, quarter, and exclusion filters — several changes within 1–2 seconds.

#### Matchup mode (Scenario 5)

1. Switch to matchup mode.
2. Change Team A and Team B repeatedly.
3. Toggle game exclusions while clips are still loading.

### What to look for

- **Network tab:** Each burst of rapid filter changes produces only **one** `/api/clips` request (the final state), not one per click.
- **UI:** Filter controls update immediately on click (no visible delay in the control itself). The clip area may show a brief loading state, but only fetches once.
- **Console:** No abort errors surfaced to the user. Aborts in the console are expected and should be silent (no error banners).

### Pass criteria

- [ ] Rapid filter clicks produce a single network request per burst, not one per click
- [ ] Controls feel responsive — no dead-click feeling or visible input lag
- [ ] No error banners or user-facing error UI from aborted stale requests
- [ ] Old filter results never overwrite newer ones (only the final state is displayed)

---

## Step 4 — Bounded prefetch under interaction pressure

**Progress tracker step:** 5.5

### What to test

Normal watching stays smooth. Aggressive skipping does not cause runaway background fetches. Prefetch becomes conservative during high interaction pressure.

### Instructions

1. Open game mode. Load a clip set and let autoplay run normally for 10–15 seconds. Confirm prefetch triggers smoothly near the end of the loaded page.
2. Now skip forward rapidly — click the rail 5+ times in under 2 seconds to trigger the interaction pressure detector.
3. Watch the Network tab immediately after the burst of skips.
4. Wait 3–4 seconds (pressure decay window), then let autoplay resume or click forward slowly.

### What to look for

- **During normal autoplay:** Prefetch fires once when approaching the end of loaded clips. Exactly one load-more request.
- **During rapid skipping burst:** No new prefetch/load-more requests fire while the pressure signal is active. The app waits.
- **After pressure decays (2–3 seconds of calm):** Prefetch resumes normally.
- **Console:** Look for any unexpected fetch activity during the high-pressure window.

### Pass criteria

- [ ] Normal autoplay prefetch works smoothly (one load-more near page end)
- [ ] Aggressive skipping suppresses auto-prefetch temporarily
- [ ] Prefetch resumes after the pressure window clears (~2 seconds of inactivity)
- [ ] No runaway background fetch chains during rapid interaction

---

## Step 5 — Stress mode cooldown and backoff

**Progress tracker step:** 6.5

### What to test

A burst of failures causes the app to reduce upstream pressure temporarily. After the stress window passes, normal behavior resumes.

### Instructions

1. To simulate failures, either:
   - Temporarily modify the API to return errors for video asset lookups, or
   - Use browser DevTools to block specific `/api/` asset requests (Network tab → right-click → Block request URL), or
   - Throttle the network to cause timeouts.
2. Load a clip set. Allow 3+ clip fetches to fail within a 10-second window to trigger stress mode.
3. Observe behavior for the next 20 seconds (stress mode duration).
4. After 20 seconds, restore normal conditions and confirm the app recovers.

### What to look for

- **During stress mode (after 3+ failures):**
  - Auto-prefetch is suspended — no speculative load-more requests.
  - Load-more cooldown widens from 300ms to 600ms (visible as slower pagination if you trigger load-more manually).
  - The app does not aggressively retry failed keys.
- **After stress mode clears (~20 seconds):**
  - Normal prefetch and load-more behavior resumes.
  - Cooldown returns to 300ms.
- **Console:** No crash or unhandled errors. Stress mode activates and deactivates silently.

### Pass criteria

- [ ] 3+ failures within 10 seconds triggers stress mode (reduced fetch activity)
- [ ] Auto-prefetch is suspended during stress mode
- [ ] Load-more cooldown is visibly wider during stress mode
- [ ] Normal behavior resumes automatically after ~20 seconds
- [ ] No crash, error banner, or broken state during or after stress mode

---

## Step 6 — Client-side request cache and in-flight dedup

**Progress tracker step:** 7.5

### What to test

Repeating the same request key shortly after success does not hit the network. Identical in-flight requests collapse. Rail clip selection remains local-only.

### Instructions

1. Load a game in game mode. Note the `/api/clips` request in the Network tab.
2. Without changing any filters, navigate away (switch modes or dates) and then return to the exact same game and filters within 20 seconds.
3. Check whether a new `/api/clips` request fires. It should not — the cached response should be reused.
4. Load a player in player mode. Note the player game log metadata request. Switch away and back within 45 seconds. Confirm it is not re-fetched.
5. Click different clips in the rail. Confirm that selecting a clip in the rail does **not** trigger any network request — it should be purely local (`history.replaceState` only).

### What to look for

- **Network tab:** No duplicate `/api/clips` request for the same params within the cache TTL window (20s for clip pages, 45s for metadata).
- **Network tab:** Clicking a clip in the rail produces zero network requests.
- **Network tab:** If you manage to trigger two identical requests simultaneously (e.g., double-click), only one actual network request fires.

### Pass criteria

- [ ] Same-params clip request is served from cache within 20 seconds (no network hit)
- [ ] Same-params metadata request is served from cache within 45 seconds
- [ ] Rail clip selection triggers zero network requests
- [ ] Simultaneous identical requests collapse into one network call

---

## After all steps pass

1. Mark steps 2.4, 3.11, 4.5, 5.5, 6.5, and 7.5 as ✅ in [request-resilience-progress.md](./request-resilience-progress.md).
2. Run the full technical assertions check:
   - [ ] No duplicate in-flight request for same clip page key
   - [ ] No duplicate in-flight request for same video asset key at API layer
   - [ ] Aborts are silent and intentional
   - [ ] Stale request completions never overwrite current context
   - [ ] Load-more starts are serialized
3. Mark the overall plan as complete.
