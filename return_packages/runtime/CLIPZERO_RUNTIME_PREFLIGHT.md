# ClipZero Runtime Reliability Preflight

Date: 2026-05-08  
Repo: `Bet-Zero/clipzero`  
Branch inspected: `main`  
Local checkout HEAD during inspection: `97be857`

## 1. Current Runtime Architecture

The intended production path is:

1. Vercel serves the web frontend.
2. The API runs on the user's Mac.
3. The API listens locally on port `4000`.
4. Cloudflare Tunnel exposes that local API publicly at `https://clipzeroapi.xyz`.
5. PM2 keeps both the API process and the Cloudflare Tunnel process alive.

The repo already documents this model in `README.md` and `docs/operational-state-audit.md`. Do not replace this with a VPS, Render, or ordinary hosted API deployment. The local-Mac API path is intentional because hosted/VPS-style access is known to fail against the NBA-side source.

### Live PM2 snapshot observed

`pm2 status` showed both expected processes online:

- `clipzero-api`
- `clipzero-tunnel`

`pm2 describe clipzero-api` showed:

- script path: `/Users/brenthibbitts/clipzero/apps/api/dist/index.js`
- interpreter: `node`
- interpreter args: `--env-file-if-exists=../../.env`
- exec cwd: `/Users/brenthibbitts/clipzero/apps/api`
- mode: `fork_mode`

`pm2 describe clipzero-tunnel` showed:

- script path: `/bin/bash`
- script args: `-c cloudflared tunnel run clipzero-api`
- exec cwd: `/Users/brenthibbitts/clipzero`
- mode: `fork_mode`

`lsof -nP -iTCP:4000 -sTCP:LISTEN` showed `node` PID `12508` listening on `*:4000`. `ps -o pid,ppid,user,command -p 12508` showed:

```text
12508 645 brenthibbitts node /Users/brenthibbitts/clipzero/apps/api/dist/index.js
```

`ps -o pid,ppid,user,command -p 645` showed PID `645` is the PM2 daemon:

```text
645 1 brenthibbitts PM2 v6.0.14: God Daemon (/Users/brenthibbitts/.pm2)
```

So, at inspection time, the local port owner was the PM2-managed compiled API process.

### Live Cloudflare Tunnel config observed

The committed repo does not contain Cloudflare Tunnel ingress config. The live local config is external state under `/Users/brenthibbitts/.cloudflared/config.yml`.

Non-secret fields observed:

```yaml
ingress:
  - hostname: clipzeroapi.xyz
    service: http://localhost:4000
```

That matches the intended route: public hostname `clipzeroapi.xyz` forwards to the local API on port `4000`.

A separate `/Users/brenthibbitts/.cloudflared/config.broken.yml` also exists and appears malformed. Since PM2 runs `cloudflared tunnel run clipzero-api`, the active config appears to be `config.yml`, but the presence of a broken config file is an external-state hazard.

## 2. Required Production Path

The required path should be treated as:

```text
Vercel web
  -> browser/server API calls use https://clipzeroapi.xyz
  -> Cloudflare edge
  -> cloudflared tunnel process managed by PM2
  -> http://localhost:4000
  -> clipzero-api process managed by PM2
  -> node apps/api/dist/index.js
```

Required ownership:

- PM2 process `clipzero-api` owns port `4000`.
- PM2 process `clipzero-tunnel` owns the `cloudflared tunnel run clipzero-api` process.
- Cloudflare Tunnel ingress maps `clipzeroapi.xyz` to `http://localhost:4000`.
- The API runtime entrypoint is compiled JS in `apps/api/dist`, not TypeScript in `apps/api/src`.
- Vercel production env must keep `NEXT_PUBLIC_API_BASE_URL=https://clipzeroapi.xyz`.

## 3. How The API Is Built And Started

Root scripts in `package.json`:

- `dev:api`: `npm run dev -w apps/api`
- `build:api`: `npm run build -w apps/api`
- `start:api`: `npm run start -w apps/api`
- `test:api`: `npm run test -w apps/api`

API scripts in `apps/api/package.json`:

- `dev`: `tsx src/index.ts`
- `build`: `tsc`
- `start`: `node --env-file-if-exists=../../.env dist/index.js`
- `test`: `vitest run`
- cache admin helpers: `cache:inspect`, `cache:evict`, `cache:sweep`

`apps/api/tsconfig.json` compiles:

- root dir: `src`
- output dir: `dist`
- module: `CommonJS`
- target: `ES2020`

The API port defaults to `4000` through `apiConfig.port`, which reads `PORT` with fallback `4000`.

## 4. Whether PM2 Runs Dist Or Source

PM2 runs compiled dist code.

Evidence:

- `apps/api/package.json` has `"main": "dist/index.js"` and starts `node ... dist/index.js`.
- `README.md` explicitly says PM2 runs `apps/api/dist`, not `apps/api/src`.
- Live `pm2 describe clipzero-api` showed the script path is `/Users/brenthibbitts/clipzero/apps/api/dist/index.js`.
- Live `/health` returned `runtime.entrypoint` as `/Users/brenthibbitts/clipzero/apps/api/dist/index.js`.

## 5. What Process Should Own Port 4000

Only the PM2-managed `clipzero-api` process should own port `4000`.

The current code path is:

- `apps/api/src/lib/config.ts` reads `PORT`, fallback `4000`.
- `apps/api/src/index.ts` calls `app.listen(port, ...)`.
- PM2 starts the compiled API entrypoint.

Manual `npm run dev:api`, `npm run start:api`, `npm run dev -w apps/api`, or `node apps/api/dist/index.js` on port `4000` can mask PM2. The repo documents this risk, but no committed command currently enforces it.

## 6. How Cloudflare Tunnel Connects To The API

Expected:

- PM2 process `clipzero-tunnel` runs `cloudflared tunnel run clipzero-api`.
- Cloudflare Tunnel config maps `clipzeroapi.xyz` to `http://localhost:4000`.
- Public requests to `https://clipzeroapi.xyz/*` should reach the same API process as `http://127.0.0.1:4000/*`.

Observed:

- Local `/health` and public `/health` both returned HTTP success with the same runtime fields.
- The active local Cloudflare config maps `clipzeroapi.xyz` to `http://localhost:4000`.

Gap:

- This mapping is not committed to the repo.
- There is no repo-level check that the Cloudflare config still maps the expected hostname to the expected local service.

## 7. What `/health` Currently Proves

When called locally at `http://127.0.0.1:4000/health`, `/health` proves:

- Something is listening on local port `4000`.
- That listener is serving the ClipZero Express `/health` route.
- The API disabled flag is reflected as `ok` and `disabled`.
- The route can return runtime metadata:
  - package version
  - git SHA captured at API process startup
  - entrypoint file path
  - entrypoint file mtime as `buildTimestamp`
- The route can include the last NBA video CDN probe details if available.
- If `CLIPZERO_DEBUG=1`, it can include persistent cache summary data.

When called publicly at `https://clipzeroapi.xyz/health`, `/health` additionally proves:

- Cloudflare Tunnel is accepting public traffic for the hostname.
- The tunnel can reach the local API.
- The public path and local path are likely hitting the same running API when runtime fields match.

Live local and public health both returned:

```json
{
  "ok": true,
  "disabled": false,
  "videoCdnAvailable": true,
  "runtime": {
    "packageVersion": "1.0.0",
    "gitSha": "a62e58e",
    "buildTimestamp": "2026-05-08T08:31:45.972Z",
    "entrypoint": "/Users/brenthibbitts/clipzero/apps/api/dist/index.js"
  }
}
```

## 8. What `/health` Does Not Prove

`/health` does not prove that PM2 owns port `4000`. A stray manual process could serve the same route and still return healthy JSON.

`/health` does not prove the running compiled code matches the current checkout unless its runtime fields are compared against the repo. During this inspection:

- current checkout HEAD: `97be857`
- live `/health` runtime git SHA: `a62e58e`
- `apps/api/dist/index.js` mtime: `2026-05-08 04:31:45`
- `apps/api/src/index.ts` mtime: `2026-05-08 04:34:58`

That means the running API was not current with the checkout at inspection time.

`/health` does not prove the main NBA data endpoints work. It does not exercise:

- `/games`
- `/players`
- `/clips/game`
- `/clips/player`
- `/clips/matchup`
- upstream NBA JSON access
- video asset lookup behavior
- browser CORS from the Vercel origin
- rate-limit behavior under actual traffic

`/health` does not currently prove video CDN availability. The code updates `nbaVideoCdnAvailable` inside `refreshNbaVideoCdnHealth()`, but `checkNbaVideoCdnHealth()` returns `true` unconditionally after scheduling/refreshing the probe. The `probe` object is useful evidence, but the top-level `videoCdnAvailable` boolean in `/health` is currently telemetry-safe rather than a strict availability signal.

`/health` does not prove Vercel is configured with `NEXT_PUBLIC_API_BASE_URL=https://clipzeroapi.xyz`. That is external Vercel state.

## 9. Commands That Currently Exist

Root commands:

- `npm run dev:web`
- `npm run dev:api`
- `npm run build:web`
- `npm run build:api`
- `npm run start:web`
- `npm run start:api`
- `npm run lint:web`
- `npm run test:api`
- `npm run test:web`
- `npm run test`
- `npm run test:e2e`

API workspace commands:

- `npm run dev -w apps/api`
- `npm run build -w apps/api`
- `npm run start -w apps/api`
- `npm run data:test -w apps/api`
- `npm run cache:inspect -w apps/api`
- `npm run cache:evict -w apps/api`
- `npm run cache:sweep -w apps/api`
- `npm run test -w apps/api`
- `npm run test:watch -w apps/api`

Web workspace commands:

- `npm run dev -w apps/web`
- `npm run build -w apps/web`
- `npm run start -w apps/web`
- `npm run lint -w apps/web`
- `npm run test -w apps/web`
- `npm run test:watch -w apps/web`
- `npm run test:e2e -w apps/web`
- `npm run test:e2e:ui -w apps/web`

Missing commands:

- no `npm run doctor`
- no `npm run verify:prod`
- no PM2 start/reload command backed by committed ecosystem config
- no command that compares PM2, port ownership, local health, tunnel health, runtime SHA, and frontend API base URL in one pass

## 10. Committed PM2 Ecosystem Config

There is no committed PM2 ecosystem config.

The only committed PM2 setup is prose in `README.md`, including:

```bash
pm2 start "npm run start:api" --name clipzero-api --cwd /Users/brenthibbitts/clipzero
pm2 start "cloudflared tunnel run clipzero-api" --name clipzero-tunnel
```

This is enough for a human, but not enough for repeatable verification. A committed `ecosystem.config.cjs` should become the source of truth for PM2 process names, cwd, scripts, restart behavior, and expected port.

## 11. Whether Stale Compiled API Code Can Be Served

Yes.

Reasons:

- PM2 runs `apps/api/dist/index.js`.
- `dist` is ignored by `.gitignore`.
- Source edits under `apps/api/src` do not affect the PM2 process until `npm run build:api` and `pm2 restart clipzero-api` happen.
- There is no committed doctor script that checks whether `dist` is older than source or whether `/health.runtime.gitSha` matches the current checkout.

Observed during inspection:

- current checkout HEAD: `97be857`
- live runtime git SHA: `a62e58e`
- `apps/api/dist/index.js` was older than `apps/api/src/index.ts`

This is the main mystery-breakage risk.

## 12. Whether A Stray Manual Process Can Mask PM2

Yes.

The README already warns that a manual process can take over port `4000`, while PM2 may still appear online or be restarted into a conflict. There is no committed script that proves the port owner is the PM2-managed API PID.

Current inspection found the port owner was correct:

- port `4000` listener: node PID `12508`
- command: `node /Users/brenthibbitts/clipzero/apps/api/dist/index.js`
- parent: PM2 daemon PID `645`

But this is manual verification only.

## 13. Whether Frontend/Vercel API Base URL Can Drift

Yes.

Repo behavior:

- Browser requests use `NEXT_PUBLIC_API_BASE_URL` if set, otherwise `/api`.
- Server-side web requests use `INTERNAL_API_URL` if set, otherwise `/api`.
- Next rewrites `/api/:path*` to `INTERNAL_API_URL` or default `http://localhost:4000`.
- README says Vercel production env should be `NEXT_PUBLIC_API_BASE_URL=https://clipzeroapi.xyz`.
- `.env.example` uses `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` for local-style setup.

Fragility:

- Vercel env is external state.
- There is no committed command that verifies Vercel production still points to `https://clipzeroapi.xyz`.
- Browser and server API bases can diverge.
- If production falls back to `/api`, Vercel rewrites may use a bad `INTERNAL_API_URL` or default `http://localhost:4000`, which is not reachable from Vercel.
- CSP currently allows `connect-src` to `https://clipzeroapi.xyz`, local mock hosts, and self. CSP helps block some drift, but it does not diagnose the drift clearly.

## 14. Known Fragile Points

1. Stale dist can run after source edits.
2. PM2 process metadata is not committed as config.
3. Port `4000` ownership is checked manually, not automatically.
4. Cloudflare Tunnel ingress mapping is external to the repo.
5. A malformed `config.broken.yml` exists beside the active Cloudflare config.
6. Vercel API base URL is external to the repo.
7. `/health` is useful but does not verify PM2 ownership, source freshness, Vercel env, or actual NBA data paths.
8. `/health.videoCdnAvailable` is currently not a strict video CDN availability signal because the health check function returns `true` unconditionally.
9. PM2 setup docs use imperative commands instead of a committed ecosystem file.
10. The current live API runtime SHA did not match the current checkout SHA during this inspection.

## 15. Existing Health Checks And Gaps

Existing checks:

- `curl -sS http://127.0.0.1:4000/health`
- `curl -sS https://clipzeroapi.xyz/health`
- `pm2 status`
- manual `lsof -nP -iTCP:4000 -sTCP:LISTEN`
- manual logs through `pm2 logs clipzero-api` and `pm2 logs clipzero-tunnel`

Gaps:

- No machine-readable result summary.
- No check that local and public `/health` runtime fields match.
- No check that runtime SHA matches `git rev-parse --short HEAD`.
- No check that dist is newer than API source.
- No check that PM2 process command is `apps/api/dist/index.js`.
- No check that port `4000` owner is a child of the PM2 daemon or matches the PM2 process PID.
- No check that Cloudflare config maps `clipzeroapi.xyz` to `http://localhost:4000`.
- No check that Vercel production has the expected API base URL.
- No check that CORS accepts the Vercel origin.
- No check that a lightweight real endpoint such as `/games` succeeds through both local and public paths.

## 16. Specific Recommended Scripts To Add

Add root scripts:

```json
{
  "scripts": {
    "doctor": "node tools/runtime/doctor.mjs",
    "verify:prod": "node tools/runtime/verify-prod.mjs",
    "pm2:start": "pm2 start ecosystem.config.cjs",
    "pm2:restart": "pm2 restart ecosystem.config.cjs --update-env"
  }
}
```

Add implementation files:

- `tools/runtime/doctor.mjs`
- `tools/runtime/verify-prod.mjs`
- `tools/runtime/lib.mjs` for shared command, JSON, health, and assertion helpers

Recommended behavior:

- Print concise PASS/WARN/FAIL rows.
- Exit non-zero on FAIL.
- Avoid printing secrets from `.env`, Vercel env pulls, Cloudflare credential JSON, or PM2 env.
- Default to non-destructive checks. Do not restart or kill processes in `doctor`.
- Make `verify:prod` safe to run after deployment/restart, but do not hide failures by auto-fixing them.

## 17. Proposed `npm run doctor` Checklist

Purpose: fast local runtime sanity check. It should diagnose drift without changing process state.

Checklist:

1. Confirm current directory is the repo root.
2. Confirm branch is `main`.
3. Read current git short SHA.
4. Warn if the worktree is dirty.
5. Confirm `apps/api/dist/index.js` exists.
6. Compare newest `apps/api/src/**/*.ts` mtime to `apps/api/dist/index.js` mtime; fail or warn if source is newer.
7. Confirm `pm2` is available.
8. Parse `pm2 jlist` and require:
   - `clipzero-api` exists and is online.
   - `clipzero-tunnel` exists and is online.
   - `clipzero-api` script path ends in `apps/api/dist/index.js`.
   - `clipzero-api` cwd is `apps/api`.
   - `clipzero-tunnel` command includes `cloudflared tunnel run clipzero-api`.
9. Confirm port `4000` has exactly one listener.
10. Confirm the port `4000` listener PID matches the PM2 `clipzero-api` PID or is a child process clearly owned by that PM2 app.
11. Fetch `http://127.0.0.1:4000/health`.
12. Require local health `ok === true`, unless intentionally disabled mode is passed.
13. Require local health `runtime.entrypoint` ends in `apps/api/dist/index.js`.
14. Compare local health `runtime.gitSha` to current git short SHA; fail if mismatched unless an explicit `--allow-stale-runtime` flag is passed.
15. Fetch `https://clipzeroapi.xyz/health`.
16. Require public health `ok === true`.
17. Compare public and local health runtime fields:

- `gitSha`
- `buildTimestamp`
- `entrypoint`

18. Check local Cloudflare config, if readable:

- hostname `clipzeroapi.xyz`
- service `http://localhost:4000`

19. Warn if malformed Cloudflare config files matching `config*.yml` are present.
20. Check CORS response for Vercel origin:

- `curl -I -H "Origin: https://clipzero-web.vercel.app" https://clipzeroapi.xyz/health`
- require `access-control-allow-origin: https://clipzero-web.vercel.app` when `CLIPZERO_ALLOWED_ORIGINS` is configured.

21. Print a final diagnosis:

- `READY`
- `STALE_RUNTIME`
- `PORT_OWNERSHIP_DRIFT`
- `TUNNEL_DRIFT`
- `PUBLIC_HEALTH_DOWN`
- `CONFIG_DRIFT`

## 18. Proposed `npm run verify:prod` Checklist

Purpose: verify the full production path after an intentional build/restart/deploy operation.

Checklist:

1. Confirm repo root and branch `main`.
2. Confirm worktree state and print current git short SHA.
3. Run `npm run build:api`.
4. Run `npm run test:api`.
5. Verify `apps/api/dist/index.js` mtime is newer than all API source files.
6. Restart API through the committed ecosystem config:
   - `pm2 restart ecosystem.config.cjs --only clipzero-api --update-env`
7. Restart or reload tunnel only when requested by flag:
   - default should not bounce the tunnel unnecessarily.
8. Poll `http://127.0.0.1:4000/health` until healthy or timeout.
9. Require local health runtime SHA to match current git short SHA.
10. Require local health entrypoint to end in `apps/api/dist/index.js`.
11. Poll `https://clipzeroapi.xyz/health` until healthy or timeout.
12. Require public health runtime fields to match local health.
13. Probe a lightweight real data endpoint locally and publicly, for example:

- `/games?date=<stable-past-date>`

14. Check CORS for `https://clipzero-web.vercel.app`.
15. Verify Vercel production API base URL by one of these approaches:

- preferred: use Vercel API/CLI to read only `NEXT_PUBLIC_API_BASE_URL` and compare to `https://clipzeroapi.xyz`
- fallback: fetch deployed production JS and assert it references `https://clipzeroapi.xyz` and does not reference `localhost:4000`

16. Print final public URLs:

- `https://clipzero-web.vercel.app`
- `https://clipzeroapi.xyz/health`

17. Exit non-zero on any mismatch.

## 19. Proposed PM2 Ecosystem Config

Add `ecosystem.config.cjs` at repo root:

```js
const path = require("node:path");

const repoRoot = __dirname;

module.exports = {
  apps: [
    {
      name: "clipzero-api",
      cwd: path.join(repoRoot, "apps/api"),
      script: "dist/index.js",
      interpreter: "node",
      node_args: "--env-file-if-exists=../../.env",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 2000,
      time: true,
      env: {
        PORT: "4000",
      },
    },
    {
      name: "clipzero-tunnel",
      cwd: repoRoot,
      script: "cloudflared",
      args: "tunnel run clipzero-api",
      interpreter: "none",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 2000,
      time: true,
    },
  ],
};
```

Notes:

- Keep secrets in `.env` or existing external secret stores, not in the ecosystem file.
- Keep Cloudflare credentials in the Cloudflare config path, not in the repo.
- The ecosystem config should replace the README-only PM2 start commands.

## 20. Exact Files That Need Changes In The Next Execution Pass

Required tooling/config changes:

- `package.json`
  - add `doctor`
  - add `verify:prod`
  - add PM2 ecosystem-backed commands
- `ecosystem.config.cjs`
  - new committed PM2 process config
- `tools/runtime/doctor.mjs`
  - new non-destructive local runtime checker
- `tools/runtime/verify-prod.mjs`
  - new post-build/post-restart production path verifier
- `tools/runtime/lib.mjs`
  - shared helper module for command execution, HTTP fetches, JSON parsing, and PASS/WARN/FAIL output

Recommended docs changes:

- `README.md`
  - replace manual PM2 setup commands with `ecosystem.config.cjs` usage
  - document `npm run doctor`
  - document `npm run verify:prod`
  - clarify that `/health.videoCdnAvailable` is not currently a strict CDN availability proof
- `docs/operational-state-audit.md`
  - add the new doctor/verify commands and the exact drift surfaces they cover
- `.env.example`
  - consider adding comments that local `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` is not the Vercel production value

Optional API health hardening:

- `apps/api/src/index.ts`
  - either make `/health.videoCdnAvailable` accurately reflect `nbaVideoCdnAvailable`, or rename/add a separate health field so operators do not misread the current always-true health boolean
- `apps/api/src/lib/health.ts`
  - update `HealthPayload` if new health fields are added
- `apps/api/src/lib/health.test.ts`
  - update tests for any health payload change

Optional web drift hardening:

- `apps/web/src/lib/api.ts`
  - add validation or diagnostics for unexpected production API base values, if desired
- `apps/web/src/lib/api.test.ts`
  - add tests for any API-base validation behavior
- `apps/web/next.config.ts`
  - keep CSP in sync with the expected production tunnel URL

## 21. Stop Conditions / Risks

Stop if a proposed fix changes the deployment architecture away from Vercel web + local Mac API + Cloudflare Tunnel.

Stop if a command would print `.env` secrets, Cloudflare credential JSON contents, Vercel env values other than the expected public API base, or PM2 env secrets.

Stop if port `4000` is owned by an unknown process. The tool should report the PID and command, not auto-kill it.

Stop if local `/health` and public `/health` return different runtime SHAs or build timestamps.

Stop if `/health.runtime.entrypoint` is not `apps/api/dist/index.js` in the PM2 production path.

Stop if `apps/api/src` is newer than `apps/api/dist` after a claimed production restart.

Stop if the Cloudflare Tunnel config does not map `clipzeroapi.xyz` to `http://localhost:4000`.

Stop if Vercel production cannot be verified as using `https://clipzeroapi.xyz`.

Stop if `npm run verify:prod` would need to restart processes during an active incident without an explicit operator choice.

Stop if a health-check change would alter user-facing product behavior. Runtime diagnostics should be additive unless the follow-up pass explicitly chooses to correct the misleading `videoCdnAvailable` semantics.
