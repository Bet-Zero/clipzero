#!/usr/bin/env node
import path from "node:path";
import {
  apiDistEntrypoint,
  apiRoot,
  checkCors,
  commandExists,
  distIsFresh,
  fileExists,
  findPm2App,
  getGitBranch,
  getGitShortSha,
  getGitStatusShort,
  isDescendantPid,
  localHealthUrl,
  pm2CommandLine,
  pm2Cwd,
  pm2ExecPath,
  pm2Pid,
  pm2Status,
  printDiagnosis,
  publicHealthUrl,
  readCloudflareConfig,
  readPm2List,
  readPortListeners,
  readProcessTable,
  relativeToRepo,
  repoRoot,
  Reporter,
  requireMainBranch,
  runtimeFields,
  runtimeFieldsMatch,
  runtimeSummary,
  fetchJson,
  vercelOrigin,
} from "./lib.mjs";

const args = new Set(process.argv.slice(2));
const allowStaleRuntime = args.has("--allow-stale-runtime");
const allowDisabled = args.has("--allow-disabled");
const reporter = new Reporter();

function endsWithApiDist(filePath) {
  return !!filePath && filePath.split(path.sep).join("/").endsWith("apps/api/dist/index.js");
}

function endsWithApiRoot(filePath) {
  return !!filePath && path.resolve(filePath) === apiRoot;
}

if (path.resolve(process.cwd()) === repoRoot) {
  reporter.pass("repo root", repoRoot);
} else {
  reporter.fail("repo root", `run from ${repoRoot}`, "CONFIG_DRIFT");
}

requireMainBranch(reporter, getGitBranch(), true);

const currentSha = getGitShortSha();
if (currentSha) {
  reporter.pass("git sha", currentSha);
} else {
  reporter.fail("git sha", "could not read HEAD", "CONFIG_DRIFT");
}

const dirty = getGitStatusShort();
if (dirty) {
  reporter.warn("worktree", "dirty");
} else {
  reporter.pass("worktree", "clean");
}

if (fileExists(apiDistEntrypoint)) {
  reporter.pass("dist entrypoint", relativeToRepo(apiDistEntrypoint));
} else {
  reporter.fail("dist entrypoint", `${relativeToRepo(apiDistEntrypoint)} is missing`, "STALE_RUNTIME");
}

const freshness = distIsFresh();
if (freshness.fresh) {
  reporter.pass("dist freshness", "dist/index.js is newer than API source");
} else if (freshness.newestSource) {
  reporter.fail(
    "dist freshness",
    `${relativeToRepo(freshness.newestSource.filePath)} is newer than dist/index.js`,
    "STALE_RUNTIME",
  );
} else {
  reporter.fail("dist freshness", "could not compare API source and dist", "STALE_RUNTIME");
}

if (commandExists("pm2")) {
  reporter.pass("pm2 binary", "available");
} else {
  reporter.fail("pm2 binary", "pm2 not found on PATH", "CONFIG_DRIFT");
}

const pm2 = readPm2List();
let apiApp = null;
let tunnelApp = null;
if (pm2.ok) {
  reporter.pass("pm2 jlist", `${pm2.apps.length} processes reported`);
  apiApp = findPm2App(pm2.apps, "clipzero-api");
  tunnelApp = findPm2App(pm2.apps, "clipzero-tunnel");
} else {
  reporter.fail("pm2 jlist", pm2.error, "CONFIG_DRIFT");
}

if (apiApp && pm2Status(apiApp) === "online") {
  reporter.pass("pm2 clipzero-api", "online");
} else {
  reporter.fail("pm2 clipzero-api", `status=${apiApp ? pm2Status(apiApp) : "missing"}`, "PORT_OWNERSHIP_DRIFT");
}

if (tunnelApp && pm2Status(tunnelApp) === "online") {
  reporter.pass("pm2 clipzero-tunnel", "online");
} else {
  reporter.fail("pm2 clipzero-tunnel", `status=${tunnelApp ? pm2Status(tunnelApp) : "missing"}`, "TUNNEL_DRIFT");
}

const apiExec = pm2ExecPath(apiApp);
if (endsWithApiDist(apiExec)) {
  reporter.pass("pm2 API script", relativeToRepo(apiExec));
} else {
  reporter.fail("pm2 API script", apiExec || "missing", "STALE_RUNTIME");
}

const apiCwd = pm2Cwd(apiApp);
if (endsWithApiRoot(apiCwd)) {
  reporter.pass("pm2 API cwd", relativeToRepo(apiCwd));
} else {
  reporter.fail("pm2 API cwd", apiCwd || "missing", "PORT_OWNERSHIP_DRIFT");
}

const tunnelCommand = pm2CommandLine(tunnelApp);
if (/cloudflared\b.*\btunnel\b.*\brun\b.*\bclipzero-api\b/.test(tunnelCommand)) {
  reporter.pass("pm2 tunnel command", "cloudflared tunnel run clipzero-api");
} else {
  reporter.fail("pm2 tunnel command", tunnelCommand || "missing", "TUNNEL_DRIFT");
}

const port = readPortListeners(4000);
let listener = null;
if (!port.ok) {
  reporter.fail("port 4000 listener", port.error, "PORT_OWNERSHIP_DRIFT");
} else if (port.listeners.length === 1) {
  listener = port.listeners[0];
  reporter.pass("port 4000 listener", `pid=${listener.pid} command=${listener.command ?? "unknown"}`);
} else {
  reporter.fail("port 4000 listener", `${port.listeners.length} listeners found`, "PORT_OWNERSHIP_DRIFT");
}

const apiPid = pm2Pid(apiApp);
if (listener && apiPid) {
  const processes = readProcessTable();
  const owned = listener.pid === apiPid || isDescendantPid(listener.pid, apiPid, processes);
  if (owned) {
    reporter.pass("port 4000 ownership", `owned by clipzero-api pid=${apiPid}`);
  } else {
    const processInfo = processes.get(listener.pid);
    reporter.fail(
      "port 4000 ownership",
      `listener pid=${listener.pid} does not belong to clipzero-api pid=${apiPid}; command=${processInfo?.command ?? "unknown"}`,
      "PORT_OWNERSHIP_DRIFT",
    );
  }
} else {
  reporter.fail("port 4000 ownership", "missing listener or PM2 API pid", "PORT_OWNERSHIP_DRIFT");
}

const localHealth = await fetchJson(localHealthUrl);
if (localHealth.ok && localHealth.json?.ok === true) {
  reporter.pass("local health", "ok=true");
} else if (allowDisabled && localHealth.json?.disabled === true) {
  reporter.warn("local health", "disabled mode accepted by --allow-disabled");
} else {
  reporter.fail("local health", `status=${localHealth.status || localHealth.error}`, "PUBLIC_HEALTH_DOWN");
}

const localRuntime = runtimeFields(localHealth.json);
if (endsWithApiDist(localRuntime.entrypoint)) {
  reporter.pass("local runtime entrypoint", localRuntime.entrypoint);
} else {
  reporter.fail("local runtime entrypoint", localRuntime.entrypoint || "missing", "STALE_RUNTIME");
}

if (currentSha && localRuntime.gitSha === currentSha) {
  reporter.pass("local runtime sha", currentSha);
} else if (allowStaleRuntime) {
  reporter.warn("local runtime sha", `stale runtime accepted; ${runtimeSummary(localHealth.json)}`);
} else {
  reporter.fail("local runtime sha", `expected=${currentSha ?? "unknown"} actual=${localRuntime.gitSha ?? "missing"}`, "STALE_RUNTIME");
}

const publicHealth = await fetchJson(publicHealthUrl);
if (publicHealth.ok && publicHealth.json?.ok === true) {
  reporter.pass("public health", "ok=true");
} else {
  reporter.fail("public health", `status=${publicHealth.status || publicHealth.error}`, "PUBLIC_HEALTH_DOWN");
}

if (runtimeFieldsMatch(localHealth.json, publicHealth.json)) {
  reporter.pass("local/public runtime match", runtimeSummary(localHealth.json));
} else {
  reporter.fail(
    "local/public runtime match",
    `local=[${runtimeSummary(localHealth.json)}] public=[${runtimeSummary(publicHealth.json)}]`,
    "TUNNEL_DRIFT",
  );
}

const cloudflare = readCloudflareConfig();
if (cloudflare.activeReadable && cloudflare.activeMatches) {
  reporter.pass("cloudflare config", "~/.cloudflared/config.yml maps clipzeroapi.xyz to http://localhost:4000");
} else if (!cloudflare.activeReadable) {
  reporter.fail("cloudflare config", "~/.cloudflared/config.yml is not readable", "CONFIG_DRIFT");
} else {
  reporter.fail("cloudflare config", "expected hostname/service mapping not found", "CONFIG_DRIFT");
}

if (cloudflare.malformed.length > 0) {
  reporter.warn("cloudflare extra configs", `malformed-looking: ${cloudflare.malformed.join(", ")}`);
} else {
  reporter.pass("cloudflare extra configs", "no malformed config*.yml files detected");
}

const cors = await checkCors(publicHealthUrl, vercelOrigin);
if (cors.ok) {
  reporter.pass("CORS Vercel origin", `access-control-allow-origin=${cors.allowOrigin}`);
} else {
  reporter.fail(
    "CORS Vercel origin",
    `status=${cors.status || cors.error} access-control-allow-origin=${cors.allowOrigin ?? "missing"}`,
    "CONFIG_DRIFT",
  );
}

printDiagnosis(reporter);
process.exit(reporter.hasFailures() ? 1 : 0);
