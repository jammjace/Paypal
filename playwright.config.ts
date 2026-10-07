import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  // This local SQLite prototype shares one Next server across browser projects.
  workers: 2,
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:3100", channel: "chrome", headless: true },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1050 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
  // Do not accidentally test a stale preview build.
  webServer: { command: "npm run start -- --hostname 127.0.0.1 --port 3100", url: "http://127.0.0.1:3100/pal", reuseExistingServer: false, timeout: 60_000,
    env: { PAL_DB_PATH: ".local/browser-tests.sqlite", FINANCIAL_PROVIDER: "demo", PAL_COOKIE_SECURE: "false", PAL_AI_MODE: process.env.PAL_RUN_LOCAL_AI_TESTS === "1" ? "ollama" : "local" } },
});
