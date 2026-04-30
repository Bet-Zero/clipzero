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

1. Start the API:

```bash
cd /home/runner/work/clipzero/clipzero
npm run dev:api
```

1. Start the web app in a second shell:

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

## Vercel web + local API

Frontend is on Vercel: https://clipzero-web.vercel.app
API runs locally and is exposed via Cloudflare Tunnel at: https://clipzeroapi.xyz

### Daily operations

Most days, you do not need to run anything. PM2 keeps both the API and tunnel
running in the background.

Quick health check:

```bash
cd /Users/brenthibbitts/clipzero
pm2 status
curl -sS http://127.0.0.1:4000/health
curl -sS https://clipzeroapi.xyz/health
```

Expected PM2 processes:

```text
clipzero-api      online
clipzero-tunnel   online
```

Expected health response includes:

```json
{ "ok": true, "disabled": false, "videoCdnAvailable": true }
```

`videoCdnAvailable: false` does not mean the API or tunnel is down. It means the
NBA video CDN is currently serving placeholder video content, so ClipZero should
hide/suppress clip playback and show the warning state instead of attempting to
play the placeholder for every clip.

### PM2 ownership rule

For the normal deployed-style setup, PM2 should own both long-running processes:

- `clipzero-api` owns local port `4000`
- `clipzero-tunnel` exposes that local API at `https://clipzeroapi.xyz`

Do not manually run `npm run start:api`, `npm run start -w apps/api`, or
`npm run dev:api` on port `4000` unless you are intentionally doing local-only
debugging outside PM2. A manual process can take over port `4000`, make PM2 look
healthy while serving the wrong process, and confuse tunnel troubleshooting.

### Important runtime rule

PM2 runs the compiled API from `apps/api/dist`, not the TypeScript source in
`apps/api/src`.

After any API source change:

1. Run `npm run build -w apps/api`.
2. Restart PM2 with `pm2 restart clipzero-api`.
3. Verify the running API changed by checking `/health` or a known endpoint.
4. Do not assume source changes are live until this is verified.

If debugging local API:

1. First check `pm2 list`.
2. Check `lsof -i :4000`.
3. Do not start `npm run dev` on port `4000` while PM2 is already running.

Open the app:

```text
https://clipzero-web.vercel.app
```

### Restart commands

```bash
# Restart API only, usually after API code changes
pm2 restart clipzero-api --update-env

# Restart tunnel only, if public URL is down but local API works
pm2 restart clipzero-tunnel --update-env

# Restart both, if unsure
pm2 restart clipzero-api --update-env
pm2 restart clipzero-tunnel --update-env
```

### After API code changes

```bash
cd /Users/brenthibbitts/clipzero
npm install
npm run build:api
npm run test:api
pm2 restart clipzero-api --update-env
curl -sS https://clipzeroapi.xyz/health
```

### After frontend code changes

```bash
cd /Users/brenthibbitts/clipzero
npm run test:web
npm run build:web
git add .
git commit -m "Describe the frontend change"
git push
```

Vercel deploys the frontend after `git push`.

### Logs

```bash
pm2 logs clipzero-api --lines 100
pm2 logs clipzero-tunnel --lines 100
```

### Common incident checks

#### Public site is broken, but local API may still be fine

```bash
cd /Users/brenthibbitts/clipzero
curl -sS http://127.0.0.1:4000/health
curl -sS https://clipzeroapi.xyz/health
pm2 restart clipzero-tunnel --update-env
```

If local health works but the public URL does not, the likely problem is the
tunnel, not the API.

#### All clips show unavailable or the NBA placeholder condition is suspected

```bash
cd /Users/brenthibbitts/clipzero
curl -sS http://127.0.0.1:4000/health
curl -sS https://clipzeroapi.xyz/health
pm2 logs clipzero-api --lines 100 --nostream
```

If health returns `videoCdnAvailable: false`, the API and tunnel can still be
working normally. That means the upstream NBA video CDN is serving placeholder
video content, and ClipZero should suppress playback until the upstream recovers.

**Debugging and long-term fixes**

- Inspect recent classified failures and probe history (internal-only) at:

```bash
curl -sS http://127.0.0.1:4000/debug/failures/recent
```

- The API now retains a short rolling history of CDN probe results and exposes
  them in the debug endpoint so you can see recent `etag`/status/content-length
  samples and trends.

- Long-term remediation steps:
  - Use minimal headers for CDN/static JSON fetches (we now separate stats vs
    CDN headers to avoid triggering 403/placeholder behavior).
  - Add retries with exponential backoff for transient upstream errors (timeouts,
    5xx, 429) while treating 403 as a hard failure to avoid masking auth/ACL
    issues.
  - Limit concurrency and use streaming/parsing to avoid large memory spikes.
  - Add alerting on prolonged `videoCdnAvailable:false` with evidence (ETag
    fingerprint) so the on-call team can triage upstream incidents promptly.

#### PM2 says online, but the wrong process is serving port 4000

```bash
cd /Users/brenthibbitts/clipzero
lsof -nP -iTCP:4000 -sTCP:LISTEN
ps -fp $(lsof -tiTCP:4000 -sTCP:LISTEN)
```

If port `4000` is owned by a stray manual shell process instead of the expected
PM2-managed API process, clear it and restart the managed stack:

```bash
cd /Users/brenthibbitts/clipzero
kill $(lsof -tiTCP:4000 -sTCP:LISTEN)
pm2 restart clipzero-api --update-env
pm2 restart clipzero-tunnel --update-env
pm2 status
curl -sS http://127.0.0.1:4000/health
curl -sS https://clipzeroapi.xyz/health
```

### If the Mac rebooted

```bash
cd /Users/brenthibbitts/clipzero
pm2 resurrect
pm2 status
curl -sS https://clipzeroapi.xyz/health
```

### Permanent PM2 setup

Only run this when setting PM2 up from scratch or changing the process list.
You do not need `pm2 save` after normal restarts.

```bash
cd /Users/brenthibbitts/clipzero
npm run build:api
pm2 delete clipzero-api clipzero-tunnel 2>/dev/null || true
pm2 start "npm run start:api" --name clipzero-api --cwd /Users/brenthibbitts/clipzero
pm2 start "cloudflared tunnel run clipzero-api" --name clipzero-tunnel
pm2 save
pm2 startup
```

Run the `sudo ...` command that `pm2 startup` prints. After that, no terminals needed.

### Vercel env var (already set, do not change)

```
NEXT_PUBLIC_API_BASE_URL=https://clipzeroapi.xyz
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

## Monitoring checklist

- Watch API logs for `clips_game_ready`, `clips_player_ready`, and `*_failed` events
- Add an external uptime monitor against the deployed `/health` URL
- Treat repeated `429` responses as a sign to tune the rate limits or reduce invite scope

## Planned filters (not yet implemented)

- **Playoffs / Regular Season** — filter clips by game type
- **Home vs Away** — filter by whether the team was home or away
- **Date Range** — filter clips to a specific date window
- **Clutch time** — 5 minutes or less remaining in 4th quarter or OT with the score within 5 points
- **Vs specific player** — filter matchup clips involving a particular opponent (feasibility TBD)
