#!/usr/bin/env node
import { readVerifyToken } from "./verify-token-store.mjs";

const result = readVerifyToken();
console.log(`ClipZero verify token: ${result.exists ? "configured" : "not configured"}`);
