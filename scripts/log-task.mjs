#!/usr/bin/env node
// scripts/log-task.mjs — print a TASK_LOG.md row from the current branch's
// diff vs main. Pure heuristic: tokens ≈ lines × ~5 chars / 4 chars-per-token
// = ~lines × 1.25, plus a per-tool overhead the agent edits in.
//
// Usage:
//   node scripts/log-task.mjs               # estimates from current branch
//   node scripts/log-task.mjs HEAD~1        # from a specific ref
//   node scripts/log-task.mjs --json        # machine-readable
//
// The agent pastes the printed row into TASK_LOG.md and overwrites the
// placeholder numbers with the real conversation I/O it tracked.
//
import { execSync } from "node:child_process";

const arg = process.argv.find((a) => !a.startsWith("--"));
const json = process.argv.includes("--json");
const ref = arg ?? "HEAD";

// Diff vs main
let diffOut = "";
try {
  diffOut = execSync(`git diff --shortstat main...${ref}`, { encoding: "utf8" });
} catch (e) {
  // No main yet (e.g. initial bootstrap). Use the last commit.
  diffOut = execSync(`git diff --shortstat ${ref}~1 ${ref}`, { encoding: "utf8" });
}

const m = diffOut.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
const files = m?.[1] ? Number(m[1]) : 0;
const insert = m?.[2] ? Number(m[2]) : 0;
const del = m?.[3] ? Number(m[3]) : 0;

// Token heuristic: ~4 chars per token, code-heavy text is ~5 chars/token.
const codeTok = Math.round((insert + del) * 1.25);
// Assume 1 tool call per ~25 lines of diff, ~400 tokens per tool call avg.
const tools = Math.max(1, Math.round((insert + del) / 25));
const toolTok = tools * 400;
// Conversation overhead (input+output), agent overrides these on paste.
const convIn = 12000;  // placeholder; agent overwrites
const convOut = 4000;  // placeholder; agent overwrites
const total = codeTok + toolTok + convIn + convOut;

const refLabel = ref;
const row = {
  ref: refLabel,
  files,
  insert,
  del,
  codeTok,
  tools,
  toolTok,
  convIn,
  convOut,
  total,
};

if (json) {
  process.stdout.write(JSON.stringify(row, null, 2) + "\n");
} else {
  process.stdout.write(`TASK_LOG row suggestion (ref=${refLabel})\n`);
  process.stdout.write(`  files=${files} +${insert}/-${del}\n`);
  process.stdout.write(`  code tokens  ≈ ${codeTok}\n`);
  process.stdout.write(`  tool tokens  ≈ ${toolTok}  (${tools} tool calls)\n`);
  process.stdout.write(`  conv in/out  = ${convIn} / ${convOut}  (OVERRIDE — agent fills real numbers)\n`);
  process.stdout.write(`  total est    = ${total} tokens\n`);
  process.stdout.write(`\nPaste into TASK_LOG.md and override convIn/convOut with real numbers from your tool run.\n`);
}
