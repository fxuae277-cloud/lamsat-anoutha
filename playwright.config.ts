import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "tests/playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5000",
    headless: true,
    screenshot: "only-on-failure",
    video: "off",
    locale: "ar",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
