// Use the TypeScript entry so `selectVideoFromEventAsset` stays in one place:
//   npm run data:video-api -w apps/api
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(__dirname, "../src/scripts/testVideoApi.ts");
const child = spawn("npx", ["tsx", script], {
  stdio: "inherit",
  shell: true,
  cwd: path.join(__dirname, ".."),
});
child.on("exit", (code) => process.exit(code ?? 1));
