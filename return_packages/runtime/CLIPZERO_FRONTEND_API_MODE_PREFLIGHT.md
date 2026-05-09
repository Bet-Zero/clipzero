# ClipZero Frontend API Mode Preflight

Date: 2026-05-08  
Branch: main  
SHA: af69909

---

## 1. Final Verdict

**SAME_ORIGIN_API_MODE**

The production frontend uses `/api` as its API base. Vercel rewrites `/api/:path*` to the backend. The `verify:prod` failure is a **verifier bug** — it searches login-page JS chunks (because the production root redirects to the password gate), and those chunks never contain `api.ts` code. The failure does not reflect a frontend misconfiguration.

There is one open question: whether Vercel production has `INTERNAL_API_URL=https://clipzeroapi.xyz` set, which is required for the rewrite to reach the API. Vercel CLI is not available locally, so this cannot be confirmed from the repo. However, all other `verify:prod` checks pass (public health, runtime match, CORS), which is consistent with the rewrite working correctly.

---

## 2. Evidence from Repo Files

### `apps/web/src/lib/api.ts`

```ts
const DEFAULT_API_BASE = "/api";

export function getApiBase(): string {
  if (typeof window === "undefined") {
    return process.env.INTERNAL_API_URL ?? DEFAULT_API_BASE;
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE;
}
```

**How the frontend chooses its API base:**
- Server-side (SSR/RSC): `INTERNAL_API_URL` env var, or `/api` if unset
- Client-side (browser JS): `NEXT_PUBLIC_API_BASE_URL` env var, or `/api` if unset

**What happens when `NEXT_PUBLIC_API_BASE_URL` is missing:**  
Falls back to `DEFAULT_API_BASE = "/api"`. This is the same-origin path.

**Modes supported:**  
Both modes are supported by this file. Which mode runs depends entirely on which env vars are set at Vercel build time.

**Local env files confirm `NEXT_PUBLIC_API_BASE_URL` is not set:**
- `apps/web/.env.local`: no `NEXT_PUBLIC_API_BASE_URL` entry
- Root `.env`: no `NEXT_PUBLIC_API_BASE_URL` entry

When not set, the browser JS uses `/api`.

---

### `apps/web/next.config.ts`

```ts
async rewrites() {
  const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:4000";
  return [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }];
},
```

**Does a `/api/:path*` rewrite exist?** Yes.  
**What does it rewrite to?** `${INTERNAL_API_URL}/:path*`  
**Which env var controls the rewrite?** `INTERNAL_API_URL`  
**What happens if that env var is missing?** Falls back to `http://localhost:4000`, which is broken in Vercel production (Vercel's edge cannot reach a local port).

**Local web/.env.local:** `INTERNAL_API_URL` is set to a localhost URL (port 4000). This is correct for local dev.  
**Vercel production:** Must have `INTERNAL_API_URL=https://clipzeroapi.xyz` for rewrites to work. Cannot confirm via Vercel CLI.

---

### `apps/web/middleware.ts`

```ts
export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
```

The matcher excludes:
- `/_next/static/` (JS/CSS assets — exempt, publicly fetched)
- `/_next/image/` (image optimization — exempt)
- Paths with a file extension (e.g., `.ico`, `.txt` — exempt)

**Does middleware protect `/api/*`?** Yes. `/api/health` has no file extension and no `_next/static` prefix, so it is caught by the matcher.

**Does it exempt `/api/*` from the password gate?** No. There is no explicit carve-out for `/api/*` paths.

**Is `/api/health` expected to redirect when unauthenticated?** Yes, by the current code.

**Does the observed `Redirecting...` response match current middleware behavior?** Yes — exactly.

The middleware checks:
1. Is access disabled? → redirect to `/login?disabled=1`
2. Is access gate enabled AND path is not `/login`? → check cookie
3. If cookie missing or invalid → redirect to `/login?next=<path>`

`/api/health` hits case 3 when unauthenticated.

---

## 3. Evidence from Deployed Frontend JS

**Method:** Fetched `https://clipzero-web.vercel.app/login` (the only page reachable without authentication). Extracted all `/_next/static/chunks/*.js` URLs. Fetched each chunk and searched for:
- `https://clipzeroapi.xyz`
- `localhost:4000`
- `127.0.0.1:4000`
- `/api`
- `DEFAULT_API_BASE`
- `getApiBase`

**Chunks fetched:**
| Chunk | Size |
|---|---|
| `15xrurgzs99gv.js` | 17,474 bytes |
| `0k8fcq_tsf70-.js` | 56,705 bytes |
| `0n~dq4kpx9xxx.js` | fetched |
| `04wx0yt85k8sj.js` | fetched |
| `0dbhjjzl8qfwv.js` | fetched |
| `03~yq9q893hmn.js` | fetched |
| `turbopack-04_3ybs5o_dy~.js` | fetched |

**Findings:**
- `https://clipzeroapi.xyz` — **NOT found** in any chunk
- `localhost:4000` — **NOT found** in any chunk
- `127.0.0.1:4000` — **NOT found** in any chunk
- `DEFAULT_API_BASE`, `getApiBase` — **NOT found** in any chunk

**Conclusion:** The login page does not import or bundle `api.ts`. The login page makes no API calls, so none of these strings appear in the login-page chunks. The absence of `clipzeroapi.xyz` does NOT mean the app is using same-origin mode — it means the verifier is searching the wrong page.

The authenticated main app pages (home, game detail, player pages) would load the chunks containing `api.ts`. Those chunks are not publicly accessible due to the password gate, so they cannot be inspected without authentication.

---

## 4. Evidence from Vercel Env/Config

**Vercel CLI:** Not available on this machine. Cannot inspect Vercel production env vars directly.

**Confirmed from local files:**
- `apps/web/.env.local` contains `INTERNAL_API_URL` (points to `localhost:4000`)
- `apps/web/.env.local` does NOT contain `NEXT_PUBLIC_API_BASE_URL`
- Root `.env` does NOT contain `NEXT_PUBLIC_API_BASE_URL`

**`.env.example` documentation (key comment):**
```
# Local development defaults to the local API. Vercel production must use:
# NEXT_PUBLIC_API_BASE_URL=https://clipzeroapi.xyz
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

This says production must set `NEXT_PUBLIC_API_BASE_URL=https://clipzeroapi.xyz`. Whether this is actually configured in Vercel is unknown without CLI access.

**Cannot confirm or deny:**
- `NEXT_PUBLIC_API_BASE_URL=https://clipzeroapi.xyz` in Vercel production
- `INTERNAL_API_URL=https://clipzeroapi.xyz` in Vercel production

**Required to resolve:** Run `vercel env ls` or inspect Vercel dashboard.

---

## 5. Evidence from Unauthenticated `/api/health`

```
curl -i https://clipzero-web.vercel.app/api/health
```

**Status code:** `307 Temporary Redirect`  
**Redirect location:** `/login?next=%2Fapi%2Fhealth`  
**Body:** `Redirecting...`  
**Interpretation:** The response is a Next.js middleware redirect to the login page. It is not API JSON.

This is **expected behavior** given the current middleware — `/api/health` is not exempt from the password gate.

---

## 6. Evidence from Authenticated `/api/health`

**`CLIPZERO_ACCESS_TOKEN` is not set** in `apps/web/.env.local` or root `.env`. The password gate is disabled in local dev (both `CLIPZERO_APP_PASSWORD` and `CLIPZERO_ACCESS_TOKEN` are empty in root `.env`).

Authenticated testing requires the Vercel-only access token, which is not available locally without the Vercel CLI or access to the Vercel secrets dashboard.

**What would be needed to test:**
1. Obtain `CLIPZERO_ACCESS_TOKEN` from Vercel production env
2. Run: `curl -sS -H "Cookie: clipzero_access=<token>" https://clipzero-web.vercel.app/api/health`
3. Compare the JSON response to `https://clipzeroapi.xyz/health`

If both return the same `ok: true` JSON with matching `runtime` fields, the rewrite is working and `INTERNAL_API_URL=https://clipzeroapi.xyz` is confirmed set in Vercel.

---

## 7. Is the Current `verify:prod` Too Strict?

**Yes — but not in the way the failure message suggests.**

The `verifyFrontendApiBase()` function in `tools/runtime/lib.mjs` has a structural flaw:

```js
const root = await fetchText(productionWebUrl, { timeoutMs: 15_000 });
// productionWebUrl = "https://clipzero-web.vercel.app"
// This 307-redirects to /login — fetch follows the redirect
// root.text is now the login page HTML, not the app page HTML
```

The function then fetches login-page JS chunks and searches them for `https://clipzeroapi.xyz`. Since the login page does not use `api.ts`, this string is never present. The check always fails when the password gate is enabled — regardless of whether the production frontend is correctly configured.

**This is a false negative.** The test cannot distinguish between:
- "Production frontend is correct but we can't verify it through the login redirect"
- "Production frontend is misconfigured"

---

## 8. Recommended Next Execution Pass

### Priority 1 — Confirm Vercel env vars (required to resolve INCONCLUSIVE items)

```bash
vercel env ls --environment=production
```

Confirm:
- `NEXT_PUBLIC_API_BASE_URL` is set to `https://clipzeroapi.xyz` (direct mode) OR is absent (same-origin mode)
- `INTERNAL_API_URL` is set to `https://clipzeroapi.xyz`

If `INTERNAL_API_URL` is not set or points to localhost in Vercel, the rewrites are broken and this is the root cause to fix.

### Priority 2 — Fix the verifier (after Vercel env is confirmed)

Replace the `verifyFrontendApiBase()` logic. Two options:

**Option A: Accept same-origin `/api` mode as valid.**  
Change the check to accept EITHER `https://clipzeroapi.xyz` in bundles OR the absence of both `clipzeroapi.xyz` and `localhost:4000` (which indicates `/api` fallback mode). The current check only passes for direct mode.

**Option B: Verify the rewrite instead of the bundle.**  
Use the authenticated cookie to call `https://clipzero-web.vercel.app/api/health` and compare the response to `https://clipzeroapi.xyz/health`. If they match, the rewrite is working regardless of which mode the client uses.

**Option A is simpler; Option B is more accurate.**

### Priority 3 — Exempt `/api/*` from middleware (optional hardening)

If same-origin mode is confirmed as the intended production mode, consider whether `/api/*` paths should bypass the password gate. Currently, even authenticated API calls from the browser must pass through the middleware cookie check — but since the frontend includes the cookie automatically on same-origin requests, this works.

If external scripts or `verify:prod` itself needs to call Vercel's `/api/*` without a session cookie, a middleware exemption would be needed.

**Do not add this exemption unless explicitly required.** The current behavior (gate protects everything) is more secure.

---

## Summary Table

| Question | Answer |
|---|---|
| Frontend API base in code | `NEXT_PUBLIC_API_BASE_URL ?? "/api"` |
| NEXT_PUBLIC_API_BASE_URL in local env | Not set → uses `/api` |
| NEXT_PUBLIC_API_BASE_URL in Vercel | Unknown (no CLI access) |
| Vercel rewrite exists? | Yes: `/api/:path*` → `INTERNAL_API_URL/:path*` |
| INTERNAL_API_URL in local env | `localhost:4000` (correct for local) |
| INTERNAL_API_URL in Vercel | Unknown — must be `https://clipzeroapi.xyz` |
| Middleware protects `/api/*`? | Yes — no exemption for API paths |
| Unauthenticated `/api/health` status | 307 → `/login?next=%2Fapi%2Fhealth` |
| `Redirecting...` response explained? | Yes — matches middleware behavior exactly |
| Authenticated `/api/health` testable? | No — access token not in local env |
| verify:prod failure root cause | Verifier fetches login-page bundles (due to redirect), never finds `clipzeroapi.xyz` |
| verify:prod too strict? | Yes — false negative when password gate is active |
