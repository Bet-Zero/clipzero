import { spawnSync } from "node:child_process";

export const verifyTokenService = "clipzero";
export const verifyTokenAccount = "verify-access-token";

const fallbackHint = "You can still run CLIPZERO_VERIFY_ACCESS_TOKEN=<token> npm run verify:prod";

function unavailable(message) {
  return { ok: false, token: null, exists: false, unavailable: true, message };
}

function runSecurity(args, options = {}) {
  return spawnSync("security", args, {
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });
}

export function keychainAvailable() {
  if (process.platform !== "darwin") {
    return unavailable(`macOS Keychain is unavailable on ${process.platform}. ${fallbackHint}.`);
  }

  const result = runSecurity(["help"]);
  if (result.error?.code === "ENOENT") {
    return unavailable(`macOS security command is unavailable. ${fallbackHint}.`);
  }

  return { ok: true, unavailable: false, message: "" };
}

export function readVerifyToken() {
  const available = keychainAvailable();
  if (!available.ok) return available;

  const result = runSecurity([
    "find-generic-password",
    "-s",
    verifyTokenService,
    "-a",
    verifyTokenAccount,
    "-w",
  ]);

  if (result.status === 0) {
    const token = result.stdout.trim();
    return { ok: token.length > 0, token, exists: token.length > 0, unavailable: false, message: "" };
  }

  if (result.status === 44) {
    return { ok: true, token: null, exists: false, unavailable: false, message: "" };
  }

  return {
    ok: false,
    token: null,
    exists: false,
    unavailable: false,
    message: result.stderr.trim() || "Could not read ClipZero verify token from macOS Keychain.",
  };
}

export function writeVerifyToken(token) {
  const available = keychainAvailable();
  if (!available.ok) return available;

  const value = token.trim();
  if (!value) {
    return { ok: false, message: "No token was provided." };
  }

  const result = runSecurity([
    "add-generic-password",
    "-U",
    "-s",
    verifyTokenService,
    "-a",
    verifyTokenAccount,
    "-w",
    value,
  ]);

  if (result.status === 0) {
    return { ok: true, message: "" };
  }

  return {
    ok: false,
    message: result.stderr.trim() || `Could not save ClipZero verify token to macOS Keychain. ${fallbackHint}.`,
  };
}

export function clearVerifyToken() {
  const available = keychainAvailable();
  if (!available.ok) return available;

  const result = runSecurity([
    "delete-generic-password",
    "-s",
    verifyTokenService,
    "-a",
    verifyTokenAccount,
  ]);

  if (result.status === 0 || result.status === 44) {
    return { ok: true, message: "" };
  }

  return {
    ok: false,
    message: result.stderr.trim() || `Could not remove ClipZero verify token from macOS Keychain. ${fallbackHint}.`,
  };
}
