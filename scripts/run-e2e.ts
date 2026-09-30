import { spawnSync } from "node:child_process";
import { testEnvironment } from "./test-environment";
const env = testEnvironment();
for (const args of [["node_modules/prisma/build/index.js", "migrate", "deploy"], ["node_modules/tsx/dist/cli.mjs", "scripts/seed.ts"], ["node_modules/@playwright/test/cli.js", "test"]]) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
