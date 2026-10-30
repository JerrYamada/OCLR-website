import { defineConfig, devices } from "@playwright/test";

const componentPort = process.env.COMPONENT_TEST_PORT ?? "31449";

export default defineConfig({
  testDir: "./tests/components",
  fullyParallel: true,
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL,
    baseURL: `http://127.0.0.1:${componentPort}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "node --import tsx tests/components/server.ts",
    url: `http://127.0.0.1:${componentPort}`,
    reuseExistingServer: false,
  },
});
