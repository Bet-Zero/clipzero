# ClipZero Runtime Reliability Execution 1

Date: 2026-05-08
Repo: `Bet-Zero/clipzero`
Branch: `main`
Checkout SHA during validation: `d18fb80`

## 1. Summary of files changed

- Added `ecosystem.config.cjs` with PM2 apps for `clipzero-api` and `clipzero-tunnel`.
- Added `tools/runtime/lib.mjs` for shared runtime checks, command helpers, PM2 parsing, health fetches, CORS checks, Cloudflare config checks, and frontend API-base verification.
- Added `tools/runtime/doctor.mjs` as a non-destructive runtime doctor.
- Added `tools/runtime/verify-prod.mjs` as the build/test/API-restart production verifier.
- Updated `package.json` with `doctor`, `verify:prod`, `pm2:start`, and `pm2:restart`.
- Updated `README.md` so the normal API-change flow is `npm run verify:prod`, the broken-site flow is `npm run doctor`, PM2 setup uses the committed ecosystem config, and final diagnoses are documented.
- Updated `docs/operational-state-audit.md` to document the new reliability tooling.
- Updated `.env.example` with a production API-base clarification.

## 2. Exact commands run

```bash
pwd && rg --files -g 'package.json' -g 'README.md' -g '.env.example' -g 'docs/operational-state-audit.md' -g 'return_packages/runtime/CLIPZERO_RUNTIME_PREFLIGHT.md' -g 'apps/api/**'
git status --short --branch
sed -n '1,240p' return_packages/runtime/CLIPZERO_RUNTIME_PREFLIGHT.md
sed -n '241,520p' return_packages/runtime/CLIPZERO_RUNTIME_PREFLIGHT.md
sed -n '520,760p' return_packages/runtime/CLIPZERO_RUNTIME_PREFLIGHT.md
sed -n '1,220p' package.json
sed -n '1,260p' apps/api/src/index.ts
sed -n '1,220p' apps/api/src/lib/health.ts
sed -n '1,220p' apps/api/src/lib/runtimeInfo.ts
rg -n "app\.(get|options|use)|cors|/health|/games" apps/api/src/index.ts
sed -n '1,220p' apps/api/src/lib/config.ts
sed -n '1,260p' README.md
sed -n '260,560p' README.md
sed -n '1,240p' docs/operational-state-audit.md
sed -n '680,870p' apps/api/src/index.ts
sed -n '1,220p' .env.example
find . -maxdepth 3 -type f -name '*vercel*' -o -name 'vercel.json'
rg -n "NEXT_PUBLIC_API_BASE_URL|clipzeroapi|localhost:4000|fetch\(" apps/web README.md docs -g '!node_modules'
find apps/web -maxdepth 3 -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.mjs' \) | sort
sed -n '1,220p' apps/web/next.config.ts
ls -la tools return_packages/runtime
git ls-files tools return_packages/runtime | sed -n '1,120p'
mkdir -p tools/runtime
node --check tools/runtime/lib.mjs
node --check tools/runtime/doctor.mjs
node --check tools/runtime/verify-prod.mjs
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json ok')"
npm run doctor
pm2 jlist
node -e "fetch('http://127.0.0.1:4000/health').then(async r=>console.log(r.status, await r.text())).catch(e=>{console.error(e.message); process.exit(1)})"
curl -sS -i http://127.0.0.1:4000/health
npm run doctor
npm run verify:prod
node -e "fetch('https://clipzero-web.vercel.app').then(async r=>{const t=await r.text(); console.log(r.status); console.log((t.match(/<script[^>]+src=\"([^\"]+\.js[^\"]*)\"/g)||[]).length); console.log(t.includes('https://clipzeroapi.xyz'), t.includes('localhost:4000')); console.log(t.slice(0,500));}).catch(e=>{console.error(e); process.exit(1)})"
node - <<'NODE'
(async () => {
const rootUrl='https://clipzero-web.vercel.app';
const html=await (await fetch(rootUrl)).text();
const srcs=[...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)].map(m=>m[1]);
for (const src of srcs) {
  const url=new URL(src,rootUrl).toString();
  const text=await (await fetch(url)).text();
  const hits=['clipzeroapi','NEXT_PUBLIC_API_BASE_URL','localhost:4000','/api'].filter(s=>text.includes(s));
  console.log(src, text.length, hits.join(',')||'-');
}
})().catch(e => { console.error(e); process.exit(1); });
NODE
npm run doctor
git status --short
git diff -- package.json ecosystem.config.cjs tools/runtime/lib.mjs tools/runtime/doctor.mjs tools/runtime/verify-prod.mjs README.md docs/operational-state-audit.md .env.example | sed -n '1,260p'
```

Notes:

- The first `npm run doctor` was run in the default sandbox and could not read the PM2 socket/log state. It was rerun with PM2 access.
- `npm run verify:prod` was run with PM2 access because it intentionally restarts the API.

## 3. Validation output summary

Syntax and JSON validation:

- `node --check tools/runtime/lib.mjs`: pass
- `node --check tools/runtime/doctor.mjs`: pass
- `node --check tools/runtime/verify-prod.mjs`: pass
- `package.json` JSON parse: pass

Initial runtime diagnosis before rebuild/restart:

- PM2 API and tunnel: pass
- Port `4000` ownership: pass
- Local health: pass
- Public health: pass
- Local/public runtime match: pass
- Cloudflare config: pass
- CORS for `https://clipzero-web.vercel.app`: pass
- Runtime freshness: fail, `STALE_RUNTIME`
- Initial running API SHA: `a62e58e`
- Checkout SHA: `d18fb80`

`npm run verify:prod` summary:

- `npm run build:api`: pass
- `npm run test:api`: pass, 11 files and 138 tests passed
- Dist freshness after build: pass
- PM2 API restart through `ecosystem.config.cjs`: pass
- Tunnel restart: skipped by default
- Local health after restart: pass
- Local runtime SHA after restart: `d18fb80`
- Public health after restart: pass
- Local/public runtime fields matched
- Local `/games?date=2024-01-15`: pass
- Public `/games?date=2024-01-15`: pass
- CORS for `https://clipzero-web.vercel.app`: pass
- Production frontend API-base check: fail, deployed frontend JS had `expected=no localhost4000=no`
- Final `verify:prod` diagnosis: `CONFIG_DRIFT`

Final `npm run doctor` summary after `verify:prod`:

- All required rows passed except the expected dirty-worktree warning.
- Final diagnosis: `READY`

## 4. Whether `npm run doctor` passes

Yes. After `verify:prod` rebuilt and restarted `clipzero-api`, `npm run doctor` passed with:

```text
DIAGNOSIS READY
```

## 5. Whether `npm run verify:prod` passes

No. It passed the API build, API tests, API restart, local health, public health, runtime match, stable data endpoint, and CORS checks, but failed the deployed frontend API-base check:

```text
FAIL production frontend API base - frontend-js: expected=no localhost4000=no
DIAGNOSIS CONFIG_DRIFT
```

The deployed frontend JavaScript inspected from `https://clipzero-web.vercel.app` did not contain `https://clipzeroapi.xyz`. Some chunks contained `/api`, and none contained `localhost:4000`.

## 6. Failures or skipped checks

- `verify:prod` failed on production frontend API-base verification.
- Vercel env was not read directly because no local `vercel` CLI was available; the script used the documented deployed-JS fallback.
- `verify:prod` skipped restarting `clipzero-tunnel` by default, as required.
- The initial sandboxed `doctor` run could not access PM2 state due `EPERM` on the PM2 socket/log path; the PM2-access run succeeded.

## 7. Manual follow-up needed

- Inspect Vercel production configuration for `NEXT_PUBLIC_API_BASE_URL`.
- Ensure production uses `NEXT_PUBLIC_API_BASE_URL=https://clipzeroapi.xyz`.
- Redeploy the frontend after confirming the Vercel env value, then rerun:

```bash
npm run verify:prod
```

## 8. Secret handling confirmation

No `.env` secrets, Cloudflare credential contents, Vercel secret values, or PM2 environment values were printed or committed.

## 9. Architecture confirmation

The deployment architecture was not changed. The tooling preserves the required path:

```text
Vercel web
-> https://clipzeroapi.xyz
-> Cloudflare Tunnel
-> local Mac API on http://localhost:4000
-> PM2-managed clipzero-api
-> apps/api/dist/index.js
```

No product behavior, clip logic, UI behavior, hosting provider, or CDN probing logic was changed.

## 10. Recommended next pass

Fix or confirm the Vercel production API-base configuration and redeploy the frontend so `npm run verify:prod` can prove the public web bundle points at `https://clipzeroapi.xyz`.
