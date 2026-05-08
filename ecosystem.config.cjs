const path = require("node:path");

const repoRoot = __dirname;

module.exports = {
  apps: [
    {
      name: "clipzero-api",
      cwd: path.join(repoRoot, "apps/api"),
      script: "dist/index.js",
      interpreter: "node",
      node_args: "--env-file-if-exists=../../.env",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 2000,
      time: true,
      env: {
        PORT: "4000",
      },
    },
    {
      name: "clipzero-tunnel",
      cwd: repoRoot,
      script: "cloudflared",
      args: "tunnel run clipzero-api",
      interpreter: "none",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 2000,
      time: true,
    },
  ],
};
