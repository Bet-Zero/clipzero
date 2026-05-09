# ClipZero Verify Token Setup

## Summary

Added a macOS Keychain-backed one-time setup for the production verifier token.
`npm run verify:prod` now checks `CLIPZERO_VERIFY_ACCESS_TOKEN` first, then reads
the local Keychain entry `service=clipzero account=verify-access-token`, then
falls back to the existing authenticated rewrite proof warning when no token is
configured.

No product runtime behavior, PM2 behavior, tunnel behavior, password gate logic,
or `/api/*` middleware behavior was changed.

## Files changed

- `package.json`
- `tools/runtime/lib.mjs`
- `tools/runtime/verify-prod.mjs`
- `tools/runtime/verify-token-store.mjs`
- `tools/runtime/set-verify-token.mjs`
- `tools/runtime/clear-verify-token.mjs`
- `tools/runtime/check-verify-token.mjs`
- `return_packages/runtime/CLIPZERO_VERIFY_TOKEN_SETUP.md`

## Commands run

```bash
node --check tools/runtime/lib.mjs
node --check tools/runtime/verify-prod.mjs
node --check tools/runtime/verify-token-store.mjs
node --check tools/runtime/set-verify-token.mjs
node --check tools/runtime/clear-verify-token.mjs
node --check tools/runtime/check-verify-token.mjs
npm run verify:token:status
npm run verify:prod
security add-generic-password -U -s clipzero-token-store-smoke -a verify-access-token-smoke -w clipzero-smoke-token
security find-generic-password -s clipzero-token-store-smoke -a verify-access-token-smoke
security delete-generic-password -s clipzero-token-store-smoke -a verify-access-token-smoke
```

## Validation result

`npm run verify:prod` passed and returned:

```text
DIAGNOSIS READY
```

The local machine did not have the real ClipZero verify token configured, so the
existing fallback warning remained during this run:

```text
WARN production rewrite proof - skipped — set CLIPZERO_VERIFY_ACCESS_TOKEN to enable authenticated /api/health check
```

With a valid configured token, `verify:prod` will use it automatically and the
authenticated rewrite proof can pass as:

```text
PASS production rewrite proof - /api/health matches public API health
DIAGNOSIS READY
```

## Token storage testing

Keychain write/find/delete behavior was smoke-tested with a separate test
service/account:

```text
service=clipzero-token-store-smoke
account=verify-access-token-smoke
```

The real `service=clipzero account=verify-access-token` entry was not written,
overwritten, read aloud, or deleted during validation.

## Security confirmations

- No real secret was printed.
- No real secret was committed.
- The token is not stored in `package.json`.
- The token is not stored in README examples.
- The token is not stored in any tracked repo file.
- The token is not included in this return package.
- The password gate was not removed or weakened.
- `/api/*` middleware behavior was not exempted or changed.
- PM2, tunnel, and API runtime behavior were not changed.

## User instructions

Run the one-time setup and paste the `clipzero_access` value when prompted:

```bash
npm run verify:token:set
```

The prompt is silent and does not echo the pasted token. After setup, run the
normal verifier:

```bash
npm run verify:prod
```

Check whether a token is configured:

```bash
npm run verify:token:status
```

Remove the stored token if needed:

```bash
npm run verify:token:clear
```

If macOS Keychain is unavailable, use the environment variable path for that
single command:

```bash
CLIPZERO_VERIFY_ACCESS_TOKEN=<token> npm run verify:prod
```
