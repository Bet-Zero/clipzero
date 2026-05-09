#!/usr/bin/env node
import { clearVerifyToken } from "./verify-token-store.mjs";

const result = clearVerifyToken();
if (!result.ok) {
  console.error(result.message);
  console.error("You can still run CLIPZERO_VERIFY_ACCESS_TOKEN=<token> npm run verify:prod");
  process.exit(1);
}

console.log("Removed ClipZero verify token from macOS Keychain.");
