#!/usr/bin/env node
import { writeVerifyToken } from "./verify-token-store.mjs";

function readSilent(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      reject(new Error("A TTY is required to enter the token silently."));
      return;
    }

    let value = "";
    const stdin = process.stdin;

    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    function cleanup() {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      process.stdout.write("\n");
    }

    function onData(char) {
      if (char === "\u0003") {
        cleanup();
        reject(new Error("Token entry canceled."));
        return;
      }

      if (char === "\r" || char === "\n") {
        cleanup();
        resolve(value);
        return;
      }

      if (char === "\u007f" || char === "\b") {
        value = value.slice(0, -1);
        return;
      }

      value += char;
    }

    stdin.on("data", onData);
  });
}

try {
  const token = await readSilent("Paste clipzero_access token: ");
  const result = writeVerifyToken(token);
  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }

  console.log("Saved ClipZero verify token to macOS Keychain.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error("You can still run CLIPZERO_VERIFY_ACCESS_TOKEN=<token> npm run verify:prod");
  process.exit(1);
}
