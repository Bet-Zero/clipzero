#!/usr/bin/env node
import path from "node:path";
import {
  apiDistEntrypoint,
  checkCors,
  distIsFresh,
  fetchJson,
  getGitBranch,
  getGitShortSha,
  getGitStatusShort,
  localHealthUrl,
  pollHealth,
  printDiagnosis,
  publicApiBaseUrl,
  publicHealthUrl,
  productionWebUrl,
  repoRoot,
  Reporter,
  requireMainBranch,
  runInteractive,
  runtimeFields,
  runtimeFieldsMatch,
  runtimeSummary,
  stableDataPath,
  vercelOrigin,
  verifyFrontendApiBase,
} from "./lib.mjs";

const args = new Set(process.argv.slice(2));
const restartTunnel = args.has("--restart-tunnel");
const reporter = new Reporter();

function endsWithApiDist(filePath) {
  return !!filePath && filePath.split(path.sep).join("/").endsWith("apps/api/dist/index.js");
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

console.log("RUN  npm run build:api");
let exitCode = await runInteractive("npm", ["run", "build:api"], { cwd: repoRoot });
if (exitCode === 0) {
  reporter.pass("build:api", "completed");
} else {
  reporter.fail("build:api", `exit=${exitCode}`, "STALE_RUNTIME");
}

console.log("RUN  npm run test:api");
exitCode = await runInteractive("npm", ["run", "test:api"], { cwd: repoRoot });
if (exitCode === 0) {
  reporter.pass("test:api", "completed");
} else {
  reporter.fail("test:api", `exit=${exitCode}`, "CONFIG_DRIFT");
}

const freshness = distIsFresh();
if (freshness.fresh) {
  reporter.pass("dist freshness", "dist/index.js is newer than API source");
} else if (freshness.newestSource) {
  reporter.fail("dist freshness", `${freshness.newestSource.filePath} is newer than ${apiDistEntrypoint}`, "STALE_RUNTIME");
} else {
  reporter.fail("dist freshness", "could not compare API source and dist", "STALE_RUNTIME");
}

console.log("RUN  pm2 restart ecosystem.config.cjs --only clipzero-api --update-env");
exitCode = await runInteractive("pm2", ["restart", "ecosystem.config.cjs", "--only", "clipzero-api", "--update-env"], {
  cwd: repoRoot,
});
if (exitCode === 0) {
  reporter.pass("pm2 restart API", "clipzero-api restarted through ecosystem config");
} else {
  reporter.fail("pm2 restart API", `exit=${exitCode}`, "PORT_OWNERSHIP_DRIFT");
}

if (restartTunnel) {
  console.log("RUN  pm2 restart ecosystem.config.cjs --only clipzero-tunnel --update-env");
  exitCode = await runInteractive("pm2", ["restart", "ecosystem.config.cjs", "--only", "clipzero-tunnel", "--update-env"], {
    cwd: repoRoot,
  });
  if (exitCode === 0) {
    reporter.pass("pm2 restart tunnel", "clipzero-tunnel restarted by explicit flag");
  } else {
    reporter.fail("pm2 restart tunnel", `exit=${exitCode}`, "TUNNEL_DRIFT");
  }
} else {
  reporter.pass("pm2 restart tunnel", "skipped by default");
}

const localHealth = await pollHealth(localHealthUrl, { timeoutMs: 60_000 });
if (localHealth.ok && localHealth.json?.ok === true) {
  reporter.pass("local health", "ok=true");
} else {
  reporter.fail("local health", `status=${localHealth.status || localHealth.error}`, "PUBLIC_HEALTH_DOWN");
}

const localRuntime = runtimeFields(localHealth.json);
if (currentSha && localRuntime.gitSha === currentSha) {
  reporter.pass("local runtime sha", currentSha);
} else {
  reporter.fail("local runtime sha", `expected=${currentSha ?? "unknown"} actual=${localRuntime.gitSha ?? "missing"}`, "STALE_RUNTIME");
}

if (endsWithApiDist(localRuntime.entrypoint)) {
  reporter.pass("local runtime entrypoint", localRuntime.entrypoint);
} else {
  reporter.fail("local runtime entrypoint", localRuntime.entrypoint || "missing", "STALE_RUNTIME");
}

const publicHealth = await pollHealth(publicHealthUrl, { timeoutMs: 60_000 });
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

const localData = await fetchJson(`http://127.0.0.1:4000${stableDataPath}`, { timeoutMs: 20_000 });
if (localData.ok && localData.json) {
  reporter.pass("local data endpoint", stableDataPath);
} else {
  reporter.fail("local data endpoint", `status=${localData.status || localData.error}`, "PUBLIC_HEALTH_DOWN");
}

const publicData = await fetchJson(`${publicApiBaseUrl}${stableDataPath}`, { timeoutMs: 20_000 });
if (publicData.ok && publicData.json) {
  reporter.pass("public data endpoint", stableDataPath);
} else {
  reporter.fail("public data endpoint", `status=${publicData.status || publicData.error}`, "PUBLIC_HEALTH_DOWN");
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

const accessToken = process.env.CLIPZERO_VERIFY_ACCESS_TOKEN;
const frontendResults = await verifyFrontendApiBase({ accessToken });
for (const result of frontendResults) {
  if (result.warn) {
    reporter.warn(result.label, result.detail);
  } else if (result.ok) {
    reporter.pass(result.label, result.detail);
  } else {
    reporter.fail(result.label, result.detail, result.code ?? "CONFIG_DRIFT");
  }
}

console.log(`URL  web=${productionWebUrl}`);
console.log(`URL  apiHealth=${publicHealthUrl}`);
printDiagnosis(reporter);
process.exit(reporter.hasFailures() ? 1 : 0);
