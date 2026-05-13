# NBA CDN Header Retry Execution Return Package

## Files Changed

- `apps/api/src/lib/nba.ts`
- `apps/api/src/lib/nba.test.ts`
- `return_packages/runtime/NBA_CDN_HEADER_RETRY_EXECUTION_RETURN_PACKAGE.md`

## Exact Behavior Changed

- Added a guarded CDN liveData helper that tries the existing minimal `CDN_HEADERS` first, then retries once with browser-like CDN headers only when the first response is clearly denied.
- CDN denial detection now treats these as blocked responses for retry/failure handling: HTTP 403, HTML content types, XML content types, `Access Denied` bodies, and `<Code>AccessDenied</Code>` bodies.
- The helper now rejects non-JSON CDN payloads instead of returning them as valid data, including parsing `text/plain` JSON bodies when the CDN returns real JSON with a non-JSON content type.
- `getPlayByPlay(gameId)` now uses the helper and rejects payloads unless `data.game.actions` is an array.
- `getPlayerNameMapForGame(gameId)` now uses the helper so denied boxscore payloads are retried once and never treated as valid player data.
- `getTodaysGames()` now uses the helper and rejects payloads unless `data.scoreboard.games` is an array.
- `getGamesByDate()` and all `stats.nba.com` request paths were left unchanged.

## Tests Added

- `getPlayByPlay` succeeds on the first CDN attempt with minimal headers.
- `getPlayByPlay` retries with browser-like headers after a denied CDN response.
- `getPlayByPlay` throws when both CDN attempts are denied.
- `getPlayByPlay` rejects invalid payload shapes instead of returning bad data.
- `getPlayerNameMapForGame` retries after CDN denial.
- `getTodaysGames` retries after CDN denial and accepts real JSON returned as `text/plain`.

## Commands Run

```bash
npx vitest run apps/api/src/lib/nba.test.ts
npm run test:api
npm run build:api
git status --short
```

## Test And Build Output

- `npx vitest run apps/api/src/lib/nba.test.ts`: passed, 7 tests passed.
- `npm run test:api`: passed, 11 test files and 144 tests passed in 11.74s.
- `npm run build:api`: passed, `tsc` completed with no errors.

## Constraint Checks

- Stats fallback avoided: yes. No `stats.nba.com` play-by-play fallback was added.
- Cache policy preserved: yes. The change stays inside the fetch layer; denied or invalid play-by-play responses still throw before the existing cache write path in `index.ts`, so failed CDN responses are not cached.
- Deployment/runtime config avoided: yes. No PM2, Vercel, Cloudflare, env, tunnel, or deployment scripts were changed.

## Known Remaining Limitation

- This is a partial recovery path only. Some game IDs may still return upstream `AccessDenied` responses even after the browser-like retry, and those failures now surface cleanly instead of being treated as valid JSON.

## Final Git Status --short

```bash
 M apps/api/src/lib/nba.test.ts
 M apps/api/src/lib/nba.ts
?? return_packages/runtime/NBA_CDN_HEADER_RETRY_EXECUTION_RETURN_PACKAGE.md
```
