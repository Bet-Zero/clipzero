# ClipZero web

Frontend for the private launch.

## Required env vars

- `NEXT_PUBLIC_API_BASE_URL`
- `CLIPZERO_APP_PASSWORD`
- `CLIPZERO_ACCESS_TOKEN`
- `CLIPZERO_DISABLE_ACCESS`

## Commands

```bash
cd /home/runner/work/clipzero/clipzero
npm run dev:web
npm run build:web
npm run start:web
```

The web app is intentionally private-only:

- login gate enabled when password/token env vars are set
- `robots.txt` disallows crawling
- `X-Robots-Tag` headers mark the site as no-index
