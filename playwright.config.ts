import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 45000,
  expect: { timeout: 10000 },
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3100",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 1000 },
    trace: "off", // Authenticated traces can include credentials and private form bodies.
    video: "off",
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "outputs/playwright-report" }],
  ],
  outputDir: "outputs/test-results",
});
