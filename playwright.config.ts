import { defineConfig } from "@playwright/test";

const baseURL =
  process.env.BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  "http://127.0.0.1:3000";

function isLocalBaseUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  } catch {
    return false;
  }
}

const shouldLaunchLocalServer = !process.env.BASE_URL || isLocalBaseUrl(baseURL);

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  webServer: shouldLaunchLocalServer
    ? {
        command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3000",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      }
    : undefined,
  use: {
    baseURL,
  },
});
