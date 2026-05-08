# Cache Guide

## Purpose

ClipZero uses cache to reduce repeated upstream requests and make the app feel fast.
The cache is not the source of truth. The source of truth is the upstream NBA data
or the fresh computation done by the API.

If cache ever disagrees with reality, ClipZero should prefer safety over speed:
stale entries should expire, legacy formats should be ignored, and failures should
not become permanent.

## Cache layers

### Web in-memory request cache

- Location: `apps/web/src/lib/requestCache.ts`
- Scope: browser memory only
- Lifetime: short TTLs, cleared by reload/navigation context
- Purpose: dedupe repeated UI fetches and reduce flicker
- Safety property: failures are not cached

### API in-memory caches

- Location: `apps/api/src/index.ts`
- Scope: current Node process only
- Lifetime: until PM2 restart/process restart
- Purpose: avoid repeated expensive upstream fetches during normal traffic
- Safety property: bounded by process lifetime, so a restart clears them

### API persistent disk caches

- Location: `apps/api/.cache/*.json`
- Scope: survives PM2 restart
- Purpose: keep stable upstream data from being refetched unnecessarily
- Safety property: entries now carry version metadata and can expire by cache type

## Current persistent cache policies

These policies live in `apps/api/src/lib/cachePolicy.ts`.

- `games-by-date`: 12 hours
- `video-assets`: 7 days
- `play-by-play`: 30 days
- `player-directory`: 24 hours
- `player-game-logs`: 12 hours
- `team-game-logs`: 12 hours
- `player-season-actions`: 6 hours

If a cache policy version changes, older entries are treated as legacy and ignored.
If an entry is older than the max age for that cache, it is treated as expired and ignored.

## When cache is helping

Cache is helping when:

- repeated requests return faster
- upstream load drops
- transient upstream slowness does not cause visible UI degradation
- stale entries are automatically replaced without manual work

## When cache is becoming a liability

Cache is becoming a liability when:

- old results outlive the bug that created them
- schema changes are silently mixed with old data formats
- operators need to clear cache manually as part of normal use
- there is no easy way to tell whether a cached value is valid or stale

## Debugging commands

Inspect one cache key:

```bash
npm run cache:inspect -w apps/api -- games-by-date 2026-05-06
```

Evict one cache key:

```bash
npm run cache:evict -w apps/api -- games-by-date 2026-05-06
```

Sweep legacy and expired persistent entries across all configured caches:

```bash
npm run cache:sweep -w apps/api
```

Inspect aggregate cache health:

```bash
curl -sS http://127.0.0.1:4000/debug/cache
```

## Rule of thumb

Cache should make normal operation boring. If people have to think about it often,
the cache policy is probably too weak or too opaque.
