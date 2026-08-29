// Node CLI entrypoint: pnpm bundle:guard
// First-cut: asserts `vite build` succeeds. Size-budget enforcement tightens in a later task.
import { run } from "./logic";

async function main() {
  const res = await run();
  if (!res.ok) {
    console.error(res.message);
    process.exit(1);
  }
  console.log(`bundle:guard → ${res.message}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
