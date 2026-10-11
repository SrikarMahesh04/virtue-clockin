import { execFileSync } from "node:child_process";
import path from "node:path";
export default function teardown() {
  const python = path.resolve(
    "../backend/.venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
  execFileSync(python, ["../scripts/e2e_cleanup.py"], {
    stdio: "inherit",
    env: process.env,
  });
}
