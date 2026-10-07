import { spawnSync } from "node:child_process";
const args = process.argv.includes("--browser")
  ? ["node_modules/@playwright/test/cli.js", "test", "tests/browser/local-ai.spec.ts", "--project=desktop", "--workers=1"]
  : ["node_modules/vitest/vitest.mjs", "run", "tests/local-ai.test.ts"];
const result = spawnSync(process.execPath, args, {
  stdio: "inherit", env: { ...process.env, PAL_RUN_LOCAL_AI_TESTS: "1" },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
