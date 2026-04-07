# ClipZero

Private-launch setup for a fast NBA clip explorer.

## Apps

- `/home/runner/work/clipzero/clipzero/apps/web` — Next.js frontend
- `/home/runner/work/clipzero/clipzero/apps/api` — Express API

## Local development

1. Copy `/home/runner/work/clipzero/clipzero/.env.example` to `.env` and fill in the values for the API and web environments you need.
2. Install dependencies:

```bash
cd /home/runner/work/clipzero/clipzero
npm ci
```

3. Start the API:

```bash
cd /home/runner/work/clipzero/clipzero
npm run dev:api
```

4. Start the web app in a second shell:

```bash
cd /home/runner/work/clipzero/clipzero
npm run dev:web
```

## Build and start

```bash
cd /home/runner/work/clipzero/clipzero
npm run build:api
npm run build:web
npm run start:api
npm run start:web
```

## Private-launch environment variables

### Web

- `NEXT_PUBLIC_API_BASE_URL` — public API base URL
- `CLIPZERO_APP_PASSWORD` — shared private-launch password
- `CLIPZERO_ACCESS_TOKEN` — random session token stored in the auth cookie
- `CLIPZERO_DISABLE_ACCESS` — set to `1` to force the login/maintenance gate

### API

- `PORT` — API port
- `CLIPZERO_ALLOWED_ORIGINS` — comma-separated web origins allowed by CORS
- `CLIPZERO_CACHE_DIR` — disk-backed cache directory
- `CLIPZERO_DISABLE_ACCESS` or `CLIPZERO_API_DISABLED` — quick API off switch
- `CLIPZERO_*RATE_LIMIT*` — per-IP rate-limit tuning

## Private-launch controls now in the repo

- Password gate around the full web app
- `robots.txt` + `X-Robots-Tag` + metadata no-index protections
- API request/error logging with route timings for heavy clip routes
- API-wide and endpoint-specific rate limiting
- Disk-backed cache for games, player directory, player game logs, play-by-play, season actions, and video asset metadata
- `/health` endpoint for health checks and uptime monitors
- Kill switch via `CLIPZERO_DISABLE_ACCESS`

## Deploy on Render

`/home/runner/work/clipzero/clipzero/render.yaml` defines two services:

- `clipzero-api`
- `clipzero-web`

Recommended flow:

1. Create both services from the blueprint.
2. Replace placeholder secrets before first deploy.
3. Point `NEXT_PUBLIC_API_BASE_URL` at the API service URL.
4. Keep `autoDeploy: false` until you want updates to go live.
5. Use `/health` as the uptime check target.

## Restart and rollback

### Restart

- API: restart the `clipzero-api` service from Render
- Web: restart the `clipzero-web` service from Render
- The API cache survives process restarts when `CLIPZERO_CACHE_DIR` points at persistent disk

### Rollback

1. Redeploy the previous successful Render release for the affected service.
2. If needed, set `CLIPZERO_DISABLE_ACCESS=1` first to contain traffic.
3. Confirm `/health` returns healthy before reopening access.

## Monitoring checklist

- Watch API logs for `clips_game_ready`, `clips_player_ready`, and `*_failed` events
- Add an external uptime monitor against the deployed `/health` URL
- Treat repeated `429` responses as a sign to tune the rate limits or reduce invite scope
