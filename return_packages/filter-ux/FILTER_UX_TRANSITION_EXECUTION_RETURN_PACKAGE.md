# FILTER_UX_TRANSITION_EXECUTION_RETURN_PACKAGE

## 1. Executive summary

Implemented a focused transition-state polish pass to make filter changes feel immediate and trustworthy without changing request plumbing.

What changed:

- Added an intent-time transition signal shared across game, player, matchup modes.
- Full-set replacement now has explicit visual transition shells.
- Pagination remains rail-level loading only.
- Matchup no longer presents stale clips as active content during replacement.
- Fixed the Step 5 status contradiction in progress docs with a minimal edit.

What did not change:

- Debounce timing (150ms) remains intact.
- AbortController, generation guards, interaction pressure, stress mode, and load-more single-flight logic are preserved.

## 2. Files changed

Code/docs changes:

- apps/web/src/lib/filterTransition.ts
- apps/web/src/lib/filterTransition.test.ts
- apps/web/src/components/FilterBar.tsx
- apps/web/src/components/ClipBrowser.tsx
- apps/web/src/components/PlayerModeBrowser.tsx
- apps/web/src/components/MatchupModeBrowser.tsx

- docs/plans/request-resilience-progress.md

Return package files:

- return_packages/filter-ux/FILTER_UX_TRANSITION_PREFLIGHT.md (pre-existing from preflight phase)
- return_packages/filter-ux/FILTER_UX_TRANSITION_EXECUTION_RETURN_PACKAGE.md (this file)

## 3. What UX behavior changed by mode

### Game mode

Changes:

- Filter intent now starts transition immediately in FilterBar via `beginFilterTransition("game")` before debounced navigation.
- ClipBrowser now consumes `useFilterTransition("game")` and shows a replacement shell (`Updating clips...`) while waiting for new server-prop context.
- Transition is cleared when new server-rendered clip context is applied.

Evidence:

- apps/web/src/components/FilterBar.tsx:16
- apps/web/src/components/FilterBar.tsx:510
- apps/web/src/components/FilterBar.tsx:610
- apps/web/src/components/ClipBrowser.tsx:15
- apps/web/src/components/ClipBrowser.tsx:108
- apps/web/src/components/ClipBrowser.tsx:181

- apps/web/src/components/ClipBrowser.tsx:461
- apps/web/src/components/ClipBrowser.tsx:465

### Player mode

Changes:

- `navigateTo` now starts transition immediately (`beginFilterTransition("player")`) at filter intent time.
- Replacement state is unified as `isReplacing = isTransitionPending || initialLoading`.
- Replacement skeleton can show during debounce/router gap (`Updating clips...`) and during offset-0 fetch (`Loading clips across ...`).
- Viewer/empty/error branches now gate on `!isReplacing`, so stale clips are not presented as current during replacement.
- Transition is explicitly cleared when replacement resolves or context has no fetchable clips.

Evidence:

- apps/web/src/components/PlayerModeBrowser.tsx:22
- apps/web/src/components/PlayerModeBrowser.tsx:294
- apps/web/src/components/PlayerModeBrowser.tsx:560
- apps/web/src/components/PlayerModeBrowser.tsx:778

- apps/web/src/components/PlayerModeBrowser.tsx:1398
- apps/web/src/components/PlayerModeBrowser.tsx:1425
- apps/web/src/components/PlayerModeBrowser.tsx:1431
- apps/web/src/components/PlayerModeBrowser.tsx:1444

### Matchup mode

Changes:

- `navigateTo` now starts transition immediately (`beginFilterTransition("matchup")`) at filter intent time.
- Replacement state is unified as `isReplacing = isTransitionPending || initialLoading`.
- During replacement, matchup shows a dedicated replacement shell; old clips are not rendered as primary current content.
- Pagination loading was separated: rail now receives `loading={clipsLoading}` only (not `initialLoading`).
- Transition is cleared when replacement resolves or no valid/fetchable matchup context exists.

Evidence:

- apps/web/src/components/MatchupModeBrowser.tsx:22
- apps/web/src/components/MatchupModeBrowser.tsx:359
- apps/web/src/components/MatchupModeBrowser.tsx:598
- apps/web/src/components/MatchupModeBrowser.tsx:804
- apps/web/src/components/MatchupModeBrowser.tsx:1296

- apps/web/src/components/MatchupModeBrowser.tsx:1320

## 4. How full replacement vs pagination is now separated

Full replacement:

- Triggered by filter/context intent (`beginFilterTransition(...)`) and/or offset-0 loading (`initialLoading`).
- Uses replacement shells in clip area.
- Viewer branches are hidden while replacing.

Pagination:

- Uses existing `clipsLoading` rail-level loading.
- Keeps current clips visible.

- No full replacement shell for load-more.

Evidence:

- apps/web/src/components/ClipBrowser.tsx:461-500
- apps/web/src/components/PlayerModeBrowser.tsx:1398-1414
- apps/web/src/components/PlayerModeBrowser.tsx:1446-1453
- apps/web/src/components/MatchupModeBrowser.tsx:1296-1313
- apps/web/src/components/MatchupModeBrowser.tsx:1320

## 5. Evidence that request-resilience behavior was preserved

Debounce preserved:

- Game mode FilterBar still debounces router push by 150ms.
- Player/matchup `navigateTo` still debounce router push by 150ms.

Abort/generation/stress/pressure/single-flight preserved:

- Existing fetch generation and abort logic remains in place for all mode loaders.
- Existing interaction pressure and stress mode hooks/guards unchanged.
- Existing load-more guard/cooldown logic unchanged.

Evidence:

- apps/web/src/components/FilterBar.tsx:562-568
- apps/web/src/components/PlayerModeBrowser.tsx:800-807
- apps/web/src/components/MatchupModeBrowser.tsx:829-835
- apps/web/src/components/ClipBrowser.tsx:109-120
- apps/web/src/components/PlayerModeBrowser.tsx:296-304
- apps/web/src/components/MatchupModeBrowser.tsx:361-369

## 6. Test/validation commands run with exact output

### Command

`npm run lint:web`

### Output

```text
> clipzero@1.0.0 lint:web
> npm run lint -w apps/web

> web@0.1.0 lint
> eslint

/Users/brenthibbitts/clipzero/apps/web/src/components/ClipBrowser.tsx
  91:10  warning  'videoCdnAvailable' is assigned a value but never used  @typescript-eslint/no-unused-vars


/Users/brenthibbitts/clipzero/apps/web/src/components/MatchupModeBrowser.tsx
  314:10  warning  'videoCdnAvailable' is assigned a value but never used  @typescript-eslint/no-unused-vars


/Users/brenthibbitts/clipzero/apps/web/src/components/PlayerModeBrowser.tsx
  200:10  warning  'videoCdnAvailable' is assigned a value but never used  @typescript-eslint/no-unused-vars

/Users/brenthibbitts/clipzero/apps/web/src/lib/failureLogger.ts
  45:3  warning  Unused eslint-disable directive (no problems were reported from 'no-console')

/Users/brenthibbitts/clipzero/apps/web/src/types/react-video-referrer-policy.d.ts
  4:33  warning  'T' is defined but never used  @typescript-eslint/no-unused-vars

✖ 5 problems (0 errors, 5 warnings)
  0 errors and 1 warning potentially fixable with the `--fix` option.
```

### Command

`npm run build:web`

### Output

```text
> clipzero@1.0.0 build:web
> npm run build -w apps/web

> web@0.1.0 build
> next build

▲ Next.js 16.2.4 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 10.1s

✓ Finished TypeScript in 12.9s
✓ Collecting page data using 3 workers in 1776ms
✓ Generating static pages using 3 workers (8/8) in 540ms

✓ Finalizing page optimization in 25ms

Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /auth/login
├ ƒ /auth/logout
├ ƒ /login
└ ○ /robots.txt

ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

### Command

`npm run test:web`

### Output

```text
> clipzero@1.0.0 test:web
> npm run test -w apps/web

> web@0.1.0 test
> vitest run

 RUN  v4.1.4 /Users/brenthibbitts/clipzero/apps/web

 ✓ src/lib/filterConfig.test.ts (14 tests) 39ms
 ❯ src/lib/api.test.ts (10 tests | 8 failed) 42ms
     ✓ returns default API rewrite path when env var is not set 4ms
     × returns env var value when set 19ms
     × returns host from the API base URL 2ms
     × includes port in the label 2ms
     × returns raw base string if URL parsing fails 1ms
     × includes the API label in the message 6ms
     × builds URL without search params 4ms
     × builds URL with search params 1ms
     × builds URL with empty search params (no query string) 1ms
     ✓ builds URL with multiple search params 1ms
 ✓ src/lib/filters.test.ts (42 tests) 34ms
 ✓ src/lib/access.test.ts (23 tests) 138ms
 ✓ src/lib/access.server.test.ts (9 tests) 15ms
 ✓ src/lib/season.test.ts (27 tests) 137ms
 ✓ src/lib/filterTransition.test.ts (3 tests) 21ms

 FAIL  src/lib/api.test.ts > getApiBase > returns env var value when set
AssertionError: expected '/api' to be 'https://api.example.com'

 FAIL  src/lib/api.test.ts > getApiLabel > returns host from the API base URL
AssertionError: expected '/api' to be 'api.example.com'

 FAIL  src/lib/api.test.ts > getApiLabel > includes port in the label

AssertionError: expected '/api' to be 'localhost:4000'

 FAIL  src/lib/api.test.ts > getApiLabel > returns raw base string if URL parsing fails
AssertionError: expected '/api' to be 'not-a-url'

 FAIL  src/lib/api.test.ts > getApiUnavailableMessage > includes the API label in the message
AssertionError: expected 'API unavailable — check the configured API (/api).' to contain 'localhost:4000'


 FAIL  src/lib/api.test.ts > buildApiUrl > builds URL without search params
AssertionError: expected '/api/games' to be 'http://localhost:4000/games'

 FAIL  src/lib/api.test.ts > buildApiUrl > builds URL with search params
AssertionError: expected '/api/games?date=2024-01-15' to be 'http://localhost:4000/games?date=2024-01-15'

 FAIL  src/lib/api.test.ts > buildApiUrl > builds URL with empty search params (no query string)
AssertionError: expected '/api/clips' to be 'http://localhost:4000/clips'

 Test Files  1 failed | 6 passed (7)
      Tests  8 failed | 120 passed (128)
```

Notes:

- Newly added `filterTransition` tests pass.
- Failing tests are in existing `src/lib/api.test.ts`, unrelated to filter-transition UX polish changes.

## 7. Manual QA notes / remaining checklist

Manual checklist not executed in this run.

Recommended manual QA to complete:

1. Game mode rapid filter toggles show immediate transition feedback.
2. Game mode multi-filter changes within 150ms collapse to final query.

3. Player mode transition starts immediately on filter intent.
4. Matchup mode does not show old clips as active during replacement.
5. All modes: pagination loading remains rail-only.
6. All modes: empty/loading/pagination/replacing states are visually distinct.
7. Keyboard navigation and clip selection remain unaffected.

8. Rapid filter + rail interactions do not create obvious request storms.

## 8. Any unresolved risks

1. Manual interaction QA is still required to fully validate all UX acceptance points.
2. `test:web` is currently blocked by existing `src/lib/api.test.ts` failures unrelated to this change.
3. Existing lint warnings remain (no lint errors).

## 9. Before/after summary of request-resilience progress doc correction

File:

- docs/plans/request-resilience-progress.md

Before:

- Duplicate Step 5 headings with conflicting statuses:
  - `Phase status: 🔲 Not started`
  - `Phase status: ✅ Complete`

After:

- Removed the duplicate "Not started" Step 5 block.
- Step 5 now has one unambiguous heading/status:
  - `Phase status: ✅ Complete`

Evidence:

- docs/plans/request-resilience-progress.md:168-172
