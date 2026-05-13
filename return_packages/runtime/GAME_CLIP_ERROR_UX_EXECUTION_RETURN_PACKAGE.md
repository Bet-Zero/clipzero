# Game Clip Error UX Execution Return Package

## Files Changed

- `apps/web/src/app/page.tsx`
- `apps/web/src/lib/api.ts`
- `apps/web/src/lib/api.test.ts`
- `return_packages/runtime/GAME_CLIP_ERROR_UX_EXECUTION_RETURN_PACKAGE.md`

## Exact Behavior Changed

- `getClips()` in `apps/web/src/app/page.tsx` now returns clip-specific failure state instead of treating a single `/clips/game` failure like a global API outage.
- Non-OK `/clips/game` responses now preserve a safe error summary and status code through `clipError`, `clipErrorStatus`, and `clipErrorMessage`.
- `/clips/game` failures now render a game-level message:
  - `Clips unavailable for this game`
  - `The API is online, but NBA data for this selected game could not be loaded. Try another game or check back later.`
- When matchup context is available, the UI now shows `Selected matchup: ...`.
- The clip-failure branch now preserves the existing `FilterBar` context with the selected teams and matchup while still using an empty player list.
- The existing `/games` failure path still uses the global API unavailable behavior.
- Successful clip responses still render `ClipBrowser` unchanged.

## Tests Added Or Updated

- Updated `apps/web/src/lib/api.test.ts` to align API-base assertions with the server-side Vitest environment.
- Added coverage for `getGameClipsUnavailableCopy()`.
- Added coverage for `sanitizeApiErrorDetail()`.
- Added coverage for `readApiErrorDetail()` with JSON, plain-text, and HTML-error-body cases.

## Commands Run

```bash
npx vitest run apps/web/src/lib/api.test.ts
npm run test:web
npm run build:web
INTERNAL_API_URL=https://clipzeroapi.xyz NEXT_PUBLIC_API_BASE_URL=https://clipzeroapi.xyz PORT=3001 npm run start -w apps/web
git status --short
```

## Test And Build Output

- `npx vitest run apps/web/src/lib/api.test.ts`: passed, 17/17 tests passed.
- `npm run test:web`: passed, 137/137 tests passed across 7 files.
- `npm run build:web`: passed, Next.js 16.2.4 production build completed successfully; production compile finished in 16.3s and type checks finished in 15.9s.

## Manual Validation Notes

- Local validation used the built web app on `http://localhost:3001` with both `INTERNAL_API_URL` and `NEXT_PUBLIC_API_BASE_URL` pointed at `https://clipzeroapi.xyz`.
- Working game: `http://localhost:3001/?season=2025-26&date=2026-05-11&gameId=0042500204`
  - The page rendered a populated clip rail and active clip content.
  - The page did not show `Clips unavailable for this game`.
  - The page did not show `API unavailable — check the configured API`.
- Known risky game: `http://localhost:3001/?season=2025-26&date=2026-05-13&gameId=0042500205`
  - The page showed `Clips unavailable for this game`.
  - The page showed `Selected matchup: CLE @ DET`.
  - The page showed `The API is online, but NBA data for this selected game could not be loaded. Try another game or check back later.`
  - The page did not show `API unavailable — check the configured API`.
  - The game selector and team context remained visible.

## Backend CDN Retry Logic

- Untouched.
- No backend files were edited.
- `apps/api/src/lib/nba.ts` was not changed.

## Final Git Status --short

```bash
M apps/web/src/app/page.tsx
M apps/web/src/lib/api.test.ts
M apps/web/src/lib/api.ts
?? return_packages/runtime/GAME_CLIP_ERROR_UX_EXECUTION_RETURN_PACKAGE.md
```