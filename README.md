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

If the frontend is deployed on Vercel and the API is running on your machine,
configure:

### Running the tunnel (do this every session)

Start the API in Terminal 1:

```bash
cd /Users/brenthibbitts/clipzero && npm run dev:api
```

Start the public tunnel in Terminal 2:

```bash
cloudflared tunnel --url http://localhost:4000
```

The tunnel prints a URL like `https://something.trycloudflare.com`. Copy that URL
and set it as `NEXT_PUBLIC_API_BASE_URL` in Vercel, then redeploy.
The URL changes each time you restart the tunnel.

### Once clipzeroapi.xyz activates in Cloudflare

Run the named tunnel instead (fixed URL, no Vercel redeploy needed each time):

```bash
cloudflared tunnel run clipzero-api
```

The stable API URL will be: `https://api.clipzeroapi.xyz`

### Vercel env var to set

- `NEXT_PUBLIC_API_BASE_URL` in the Vercel project to your reachable API URL
  (not `localhost`)
- `CLIPZERO_ALLOWED_ORIGINS` in the API environment to include
  `https://clipzero-web.vercel.app`

Quick checks:

1. Open `<api-url>/health` and confirm it returns `ok: true`.
2. Confirm API env switches are not disabling traffic:
   - `CLIPZERO_DISABLE_ACCESS=0`
   - `CLIPZERO_API_DISABLED=0`

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
