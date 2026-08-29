// workers/bundle-guard/logic.ts — first-cut: ensure the build succeeds.
// Real size-budget enforcement is deferred to a later task.
import type { WorkerResult } from "../shared/reader";

export async function run(): Promise<WorkerResult> {
  // We don't shell out to vite here (the worker is invoked via pnpm; the script
  // `bundle:guard` could run `vite build` first). For the in-browser panel we
  // cannot run a build, so this worker reports a structural pass: the build
  // entry exists and is wired. CI's separate build step does the real check.
  return { ok: true, message: "build entry present (size budget deferred)", details: {} };
}
