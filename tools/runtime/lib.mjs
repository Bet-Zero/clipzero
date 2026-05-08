import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const runtimeDir = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(runtimeDir, "../..");
export const apiRoot = path.join(repoRoot, "apps/api");
export const apiSrcRoot = path.join(apiRoot, "src");
export const apiDistEntrypoint = path.join(apiRoot, "dist/index.js");
export const localHealthUrl = "http://127.0.0.1:4000/health";
export const publicApiBaseUrl = "https://clipzeroapi.xyz";
export const publicHealthUrl = `${publicApiBaseUrl}/health`;
export const productionWebUrl = "https://clipzero-web.vercel.app";
export const vercelOrigin = productionWebUrl;
export const stableDataPath = "/games?date=2024-01-15";

export class Reporter {
  constructor() {
    this.rows = [];
  }

  pass(label, detail = "") {
    this.row("PASS", label, detail);
  }

  warn(label, detail = "") {
    this.row("WARN", label, detail);
  }

  fail(label, detail = "", code = "CONFIG_DRIFT") {
    this.row("FAIL", label, detail, code);
  }

  row(status, label, detail = "", code = null) {
    this.rows.push({ status, label, detail, code });
    const suffix = detail ? ` - ${detail}` : "";
    console.log(`${status.padEnd(4)} ${label}${suffix}`);
  }

  hasFailures() {
    return this.rows.some((row) => row.status === "FAIL");
  }

  failureCodes() {
    return [...new Set(this.rows.filter((row) => row.status === "FAIL").map((row) => row.code))];
  }
}

export function relativeToRepo(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

export function commandExists(command) {
  const result = spawnSync("command", ["-v", command], {
    shell: true,
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 && result.stdout.trim().length > 0;
}

export function runCapture(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: options.timeoutMs ?? 30_000,
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    ok: result.status === 0,
    signal: result.signal,
    error: result.error,
  };
}

export async function runInteractive(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      stdio: "inherit",
      env: process.env,
    });

    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

export function getGitBranch() {
  const result = runCapture("git", ["branch", "--show-current"]);
  return result.ok ? result.stdout.trim() : null;
}

export function getGitShortSha() {
  const result = runCapture("git", ["rev-parse", "--short", "HEAD"]);
  return result.ok ? result.stdout.trim() : null;
}

export function getGitStatusShort() {
  const result = runCapture("git", ["status", "--short"]);
  return result.ok ? result.stdout.trim() : "";
}

export function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function statMtimeMs(filePath) {
  return fs.statSync(filePath).mtimeMs;
}

export function newestApiSourceMtime() {
  let newest = null;

  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        const mtimeMs = fs.statSync(entryPath).mtimeMs;
        if (!newest || mtimeMs > newest.mtimeMs) {
          newest = { filePath: entryPath, mtimeMs };
        }
      }
    }
  }

  visit(apiSrcRoot);
  return newest;
}

export function distIsFresh() {
  if (!fileExists(apiDistEntrypoint)) {
    return { fresh: false, newestSource: newestApiSourceMtime(), distMtimeMs: null };
  }

  const newestSource = newestApiSourceMtime();
  const distMtimeMs = statMtimeMs(apiDistEntrypoint);
  return {
    fresh: !newestSource || distMtimeMs >= newestSource.mtimeMs,
    newestSource,
    distMtimeMs,
  };
}

export function readPm2List() {
  const result = runCapture("pm2", ["jlist"], { timeoutMs: 30_000 });
  if (!result.ok) {
    return { ok: false, error: "pm2 jlist failed", apps: [] };
  }

  try {
    const apps = JSON.parse(result.stdout);
    return { ok: true, apps: Array.isArray(apps) ? apps : [] };
  } catch {
    return { ok: false, error: "pm2 jlist returned invalid JSON", apps: [] };
  }
}

export function findPm2App(apps, name) {
  return apps.find((app) => app?.name === name) ?? null;
}

export function pm2Status(app) {
  return app?.pm2_env?.status ?? "unknown";
}

export function pm2Cwd(app) {
  return app?.pm2_env?.pm_cwd ? path.resolve(app.pm2_env.pm_cwd) : null;
}

export function pm2ExecPath(app) {
  return app?.pm2_env?.pm_exec_path ? path.resolve(app.pm2_env.pm_exec_path) : null;
}

export function pm2CommandLine(app) {
  const env = app?.pm2_env ?? {};
  const parts = [
    env.pm_exec_path,
    ...(Array.isArray(env.args) ? env.args : typeof env.args === "string" ? [env.args] : []),
    ...(Array.isArray(env.node_args)
      ? env.node_args
      : typeof env.node_args === "string"
        ? [env.node_args]
        : []),
  ];
  return parts.filter(Boolean).join(" ");
}

export function pm2Pid(app) {
  return Number.isInteger(app?.pid) && app.pid > 0 ? app.pid : null;
}

export function readPortListeners(port = 4000) {
  const result = runCapture("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-F", "pcPn"], {
    timeoutMs: 10_000,
  });

  if (!result.ok && !result.stdout.trim()) {
    return { ok: false, listeners: [], error: result.stderr.trim() || "lsof failed" };
  }

  const listeners = [];
  let current = null;
  for (const line of result.stdout.split("\n")) {
    if (!line) continue;
    const type = line[0];
    const value = line.slice(1);
    if (type === "p") {
      if (current) listeners.push(current);
      current = { pid: Number(value), command: null, name: null };
    } else if (current && type === "c") {
      current.command = value;
    } else if (current && type === "n") {
      current.name = value;
    }
  }
  if (current) listeners.push(current);

  return {
    ok: true,
    listeners: listeners.filter((listener) => Number.isInteger(listener.pid)),
  };
}

export function readProcessTable() {
  const result = runCapture("ps", ["-axo", "pid=,ppid=,command="], { timeoutMs: 10_000 });
  if (!result.ok) return new Map();

  const processes = new Map();
  for (const line of result.stdout.split("\n")) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
    if (!match) continue;
    processes.set(Number(match[1]), {
      pid: Number(match[1]),
      ppid: Number(match[2]),
      command: match[3],
    });
  }
  return processes;
}

export function isDescendantPid(childPid, parentPid, processes) {
  if (!childPid || !parentPid) return false;
  let current = processes.get(childPid);
  const seen = new Set();
  while (current && !seen.has(current.pid)) {
    if (current.pid === parentPid || current.ppid === parentPid) return true;
    seen.add(current.pid);
    current = processes.get(current.ppid);
  }
  return false;
}

export async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  try {
    const res = await fetch(url, {
      headers: options.headers ?? {},
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, status: res.status, headers: res.headers, json: null, error: "invalid JSON" };
    }
    return { ok: res.ok, status: res.status, headers: res.headers, json, error: null };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      headers: new Headers(),
      json: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  try {
    const res = await fetch(url, {
      headers: options.headers ?? {},
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, headers: res.headers, text, error: null };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      headers: new Headers(),
      text: "",
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function pollHealth(url, options = {}) {
  const deadline = Date.now() + (options.timeoutMs ?? 60_000);
  let last = null;

  while (Date.now() <= deadline) {
    last = await fetchJson(url, { timeoutMs: options.requestTimeoutMs ?? 8_000 });
    if (last.ok && last.json?.ok === true) {
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, options.intervalMs ?? 2000));
  }

  return last ?? { ok: false, status: 0, headers: new Headers(), json: null, error: "timeout" };
}

export function runtimeFields(payload) {
  const runtime = payload?.runtime ?? {};
  return {
    gitSha: runtime.gitSha ?? null,
    buildTimestamp: runtime.buildTimestamp ?? null,
    entrypoint: runtime.entrypoint ?? null,
  };
}

export function runtimeFieldsMatch(left, right) {
  const a = runtimeFields(left);
  const b = runtimeFields(right);
  return a.gitSha === b.gitSha && a.buildTimestamp === b.buildTimestamp && a.entrypoint === b.entrypoint;
}

export function runtimeSummary(payload) {
  const fields = runtimeFields(payload);
  return `sha=${fields.gitSha ?? "null"} build=${fields.buildTimestamp ?? "null"} entry=${fields.entrypoint ?? "null"}`;
}

export async function checkCors(url, origin = vercelOrigin) {
  const res = await fetchJson(url, {
    headers: { Origin: origin },
    timeoutMs: 10_000,
  });

  const allowOrigin = res.headers.get("access-control-allow-origin");
  return {
    ok: res.ok && (allowOrigin === origin || allowOrigin === "*"),
    status: res.status,
    allowOrigin,
    error: res.error,
  };
}

export function readCloudflareConfig() {
  const dir = path.join(os.homedir(), ".cloudflared");
  const activePath = path.join(dir, "config.yml");
  let activeText = null;
  let entries = [];

  try {
    activeText = fs.readFileSync(activePath, "utf8");
  } catch {
    activeText = null;
  }

  try {
    entries = fs.readdirSync(dir).filter((name) => /^config.*\.ya?ml$/i.test(name));
  } catch {
    entries = [];
  }

  const malformed = [];
  for (const name of entries) {
    if (name === "config.yml") continue;
    try {
      const text = fs.readFileSync(path.join(dir, name), "utf8");
      const hasIngress = /\bingress\s*:/m.test(text);
      const hasHostnameOrService = /\bhostname\s*:/m.test(text) || /\bservice\s*:/m.test(text);
      if (!hasIngress || !hasHostnameOrService) {
        malformed.push(name);
      }
    } catch {
      malformed.push(name);
    }
  }

  return {
    activePath,
    activeReadable: activeText !== null,
    activeMatches:
      !!activeText &&
      /\bhostname\s*:\s*clipzeroapi\.xyz\b/.test(activeText) &&
      /\bservice\s*:\s*http:\/\/localhost:4000\b/.test(activeText),
    malformed,
  };
}

export async function verifyFrontendApiBase() {
  const root = await fetchText(productionWebUrl, { timeoutMs: 15_000 });
  if (!root.ok) {
    return { ok: false, method: "frontend-js", detail: `frontend fetch failed (${root.status || root.error})` };
  }

  const checked = [root.text];
  const scriptPaths = [...root.text.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)]
    .map((match) => match[1])
    .filter((src) => src.includes("/_next/static/"))
    .slice(0, 25);

  for (const scriptPath of scriptPaths) {
    const scriptUrl = new URL(scriptPath, productionWebUrl).toString();
    const script = await fetchText(scriptUrl, { timeoutMs: 15_000 });
    if (script.ok) {
      checked.push(script.text);
    }
  }

  const corpus = checked.join("\n");
  const hasExpected = corpus.includes(publicApiBaseUrl);
  const hasLocalhost = corpus.includes("localhost:4000") || corpus.includes("127.0.0.1:4000");

  return {
    ok: hasExpected && !hasLocalhost,
    method: "frontend-js",
    detail: `expected=${hasExpected ? "yes" : "no"} localhost4000=${hasLocalhost ? "yes" : "no"}`,
  };
}

export function requireMainBranch(reporter, branch, strict = true) {
  if (branch === "main") {
    reporter.pass("git branch", "main");
    return true;
  }

  const detail = branch ? `current branch is ${branch}` : "could not read current branch";
  if (strict) {
    reporter.fail("git branch", detail, "CONFIG_DRIFT");
  } else {
    reporter.warn("git branch", detail);
  }
  return false;
}

export function printDiagnosis(reporter) {
  const codes = reporter.failureCodes();
  const diagnosis = codes.length === 0 ? "READY" : codes.join(", ");
  console.log(`DIAGNOSIS ${diagnosis}`);
  return diagnosis;
}
