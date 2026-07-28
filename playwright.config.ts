import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://localhost:3102", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- -H 127.0.0.1 -p 3102",
    url: "http://localhost:3102/login",
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      TASK_STORE_MODE: "memory",
      APP_PASSPHRASE_HASH: "scrypt$16384$8$1$14d504cccf28af2d8c0a34e3a6a1ee49$7ef0f4ea280941dc9ce0f0aad04447226bd8ace086979d8a47401f165b282e55f76a44afc1ebefb401257d75a946858da2bf4c801630a51c8a276dbdb5e94565",
      SESSION_SECRET: "e2e-only-session-secret-not-production-32",
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
});
