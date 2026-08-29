// Node CLI entrypoint: pnpm arch:check
import { run } from "./logic";
import { nodeReader } from "../shared/node-reader";

async function main() {
  const reader = await nodeReader();
  const res = await run({ reader });
  if (!res.ok) {
    console.error(res.message);
    process.exit(1);
  }
  console.log(`arch:check → ${res.message}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
