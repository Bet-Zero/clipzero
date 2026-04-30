import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { RuntimeInfo } from "./health";

type PackageJson = {
  version?: string;
};

const apiRoot = path.resolve(__dirname, "../..");

function readPackageVersion(): string | null {
  try {
    const packageJsonPath = path.join(apiRoot, "package.json");
    const raw = fs.readFileSync(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as PackageJson;
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
}

function readGitSha(): string | null {
  const envSha =
    process.env.CLIPZERO_GIT_SHA ??
    process.env.GIT_SHA ??
    process.env.SOURCE_VERSION;
  if (envSha && envSha.trim()) {
    return envSha.trim();
  }

  try {
    const sha = execSync("git rev-parse --short HEAD", {
      cwd: apiRoot,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
    return sha || null;
  } catch {
    return null;
  }
}

function readBuildTimestampIso(entrypointPath: string | null): string | null {
  if (!entrypointPath) return null;

  try {
    const stats = fs.statSync(entrypointPath);
    return stats.mtime.toISOString();
  } catch {
    return null;
  }
}

function getEntrypointPath(): string | null {
  const pmExecPath = process.env.pm_exec_path;
  if (pmExecPath && pmExecPath.trim()) {
    return path.resolve(pmExecPath);
  }

  const entry = process.argv[1];
  if (!entry || !entry.trim()) return null;
  return path.resolve(entry);
}

export function getRuntimeInfo(): RuntimeInfo {
  const entrypoint = getEntrypointPath();
  return {
    packageVersion: readPackageVersion(),
    gitSha: readGitSha(),
    buildTimestamp: readBuildTimestampIso(entrypoint),
    entrypoint,
  };
}
