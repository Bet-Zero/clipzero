# Operational State Audit

## Purpose

This note documents the important hidden state in ClipZero that is not obvious from
the UI alone. The goal is to make the runtime model legible.

## Hidden state surfaces

### 1. API base URL selection

- Web server-side requests use `INTERNAL_API_URL` when present, otherwise `/api`
- Browser requests use `NEXT_PUBLIC_API_BASE_URL` when present, otherwise `/api`
- Files: `apps/web/src/lib/api.ts`, `apps/web/next.config.ts`

Why it matters:

- a bad public API base can bypass the local rewrite path entirely
- server-side and browser-side requests can disagree if env vars diverge

### 2. Deployment topology assumptions

- the normal deployed shape is Vercel web + local PM2 API + Cloudflare Tunnel
- PM2 owns port `4000`
- `clipzeroapi.xyz` depends on the tunnel being healthy and the local API listening
- File: `README.md`

Why it matters:

- the public site can fail even while local API health is good
- restarting PM2 can create a short public 502 window while the edge reconnects

### 3. Compiled-vs-source runtime split

- PM2 serves `apps/api/dist/index.js`, not `apps/api/src/index.ts`
- File: `apps/api/src/lib/runtimeInfo.ts` and `README.md`

Why it matters:

- source edits are not live until the API is rebuilt and PM2 is restarted
- debugging can become confusing if source and runtime drift

### 4. Persistent cache directory

- API disk caches live under `CLIPZERO_CACHE_DIR`
- default example: `apps/api/.cache`
- Files: `apps/api/src/lib/config.ts`, `.env.example`

Why it matters:

- restarting the API does not clear disk state
- a stale cache file can outlive the process that created it

### 5. Debug mode gating

- internal debug endpoints only exist when `CLIPZERO_DEBUG=1`
- Files: `apps/api/src/index.ts`, `.env.example`

Why it matters:

- missing debug output may be a configuration issue, not a missing feature

### 6. Access gate configuration

- web access behavior depends on `CLIPZERO_APP_PASSWORD`, `CLIPZERO_ACCESS_TOKEN`, and `CLIPZERO_DISABLE_ACCESS`
- Files: `apps/web/src/lib/access.ts`, `apps/web/src/app/auth/login/route.ts`

Why it matters:

- login behavior can change without code changes if env vars drift

## Practical checks

If the public app breaks:

1. Check `pm2 status`
2. Check `curl -sS http://127.0.0.1:4000/health`
3. Check `curl -sS https://clipzeroapi.xyz/health`
4. Check whether the web app is pointing at `/api` or an explicit public API base

If runtime behavior feels confusing:

1. Verify whether PM2 is serving fresh `dist` output
2. Inspect `runtime` fields in `/health`
3. Inspect `cacheSummary` in `/health` or `/debug/cache` when debug mode is enabled

## Design goal

The runtime should have hidden state only where it is necessary, and each such
state surface should be visible, bounded, and documented.
