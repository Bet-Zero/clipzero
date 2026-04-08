import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,

  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Reuse an already-running dev server in local development.
  // In CI, always start a fresh one.
  webServer: [
    {
      command: "node e2e/mock-api-server.mjs",
      url: "http://127.0.0.1:4100/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run dev",
      url: "http://127.0.0.1:3000",
      env: {
        ...process.env,
        NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:4100",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
