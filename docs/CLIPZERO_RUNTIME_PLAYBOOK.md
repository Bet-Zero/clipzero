# ClipZero Runtime Playbook

## 1. Current Production URL

- Real frontend URL: <https://clipzerohoops.com>
- Do not use <https://clipzero-web.vercel.app> as the source of truth for NBA playback testing.
- The `vercel.app` origin triggered NBA placeholder behavior.

## 2. Architecture

- `apps/web` is hosted on Vercel.
- `apps/api` runs on the local Mac under PM2.
- Cloudflare Tunnel exposes the API publicly at <https://clipzeroapi.xyz>.
- The frontend calls the API for games and clips.
- The API returns `videos.nba.com` URLs.
- The browser video player loads `videos.nba.com` directly.

## 3. Runtime Rules

- PM2 runs the built API from `apps/api/dist`, not raw `apps/api/src`.
- After API source changes, run build and restart PM2.
- Required API deploy sequence:

```bash
npm run build -w apps/api
pm2 restart clipzero-api --update-env
```

- Verify:

```bash
pm2 list
curl -sS http://localhost:4000/health
curl -sS https://clipzeroapi.xyz/health
```

## 4. Placeholder-Video Facts

- API, PM2, and tunnel were ruled out for the known action-4 placeholder case once the same URL was returned.
- The same `videoUrl` can produce real footage or placeholder depending on browser, request, or origin context.
- `video.readyState=4` does not prove real footage.
- A placeholder MP4 is still a valid playable MP4.
- Use `videoWidth` and `videoHeight` as a quick signal:
  - `960x540` = expected real clip for known test clip.
  - `1920x1080` = NBA placeholder for known bad case.
- Playwright/agent browser visual playback is not authoritative because NBA/Akamai may serve placeholder to automated contexts.

## 5. Known Test Clip

- URL:
  <https://clipzerohoops.com/?date=2026-04-22&season=2025-26&gameId=0042500102&actionNumber=4>
- Expected `currentSrc`:
  <https://videos.nba.com/nba/pbp/media/2026/04/22/0042500102/4/33352025-6c88-c1f5-577e-94370aee37ca_960x540.mp4>
- Expected video dimensions on working browser:
  `960x540`
- Bad placeholder dimensions:
  `1920x1080`

## 6. Failed Experiments / Do Not Repeat Blindly

- `no-referrer` on the video element did not solve it and broke local playback.
- Page-level `Referrer-Policy: no-referrer` did not solve it and broke local playback.
- Same-origin Vercel `/api/media` route did not solve it.
- Forcing `_1280x720` is not a universal fix.
- CDN health probe has false positives and should not be treated as root cause by itself.

## 7. Validation Standard

Playback is only confirmed by:

- Human-visible real footage in a normal browser, or
- `videoWidth`/`videoHeight` matching expected real clip dimensions, plus correct `currentSrc`.

Do not claim success based only on:

- `readyState`
- `currentSrc`
- Non-null `videoUrl`
- DOM text search
- Agent/Playwright screenshot alone

## 8. Current Working Baseline

- `clipzerohoops.com` works in real browser.
- API calls work.
- Games and clips load.
- Real footage plays.
