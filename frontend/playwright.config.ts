import { defineConfig } from "@playwright/test";
import path from "node:path";
const python = path.resolve(
  "../backend/.venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  globalTeardown: "./e2e/teardown.ts",
  timeout: 45000,
  use: {
    baseURL: "http://localhost:3000",
    timezoneId: "UTC",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: `"${python}" ../scripts/e2e_server.py`,
      url: "http://127.0.0.1:8000/health",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: "pnpm run dev",
      env: {
        NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "",
        NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: "",
      },
      url: "http://localhost:3000/login",
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
