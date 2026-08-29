// TASK 0002 STUB. The real Unity batch build lands in task 0003 (it needs the
// Unity Editor/CLI installed). For now this verifies the placeholder build is
// present so `pnpm dev:unity` resolves and DEVELOPMENT.md stays honest.
import { existsSync } from "node:fs";

const PLACEHOLDER = "public/unity/Build/index.html";

if (!existsSync(PLACEHOLDER)) {
  console.error(`[dev:unity] placeholder build missing at ${PLACEHOLDER}`);
  process.exit(1);
}

console.log(`[dev:unity] placeholder build present at ${PLACEHOLDER}`);
console.log("[dev:unity] real Unity WebGL batch build is implemented in task 0003.");
