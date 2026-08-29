// Node CLI entrypoint: pnpm system:update
// Generates SYSTEM.md at repo root from src/modules/**/module.yaml.
import { run } from "./logic";
import { nodeReader } from "../shared/node-reader";
import { writeFileSync } from "node:fs";

async function main() {
  const reader = await nodeReader();
  const res = await run({ reader });
  if (!res.ok) {
    console.error(res.message);
    process.exit(1);
  }
  const md = res.details?.markdown as string;
  writeFileSync("SYSTEM.md", md, "utf8");
  console.log(`system:update → wrote SYSTEM.md (${res.message})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
