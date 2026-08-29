// scripts/dev-unity.js — builds the Unity WebGL player into public/unity/Build/.
// Replaces the task-0002 stub. Auto-detects the Unity Editor; override with UNITY_EDITOR_PATH.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";

function findUnityEditor() {
  if (process.env.UNITY_EDITOR_PATH && existsSync(process.env.UNITY_EDITOR_PATH)) {
    return process.env.UNITY_EDITOR_PATH;
  }
  // Auto-detect: pick the highest-versioned Editor under the Hub.
  const hub = "C:\\Program Files\\Unity\\Hub\\Editor";
  if (existsSync(hub)) {
    const versions = readdirSync(hub)
      .filter((d) => existsSync(`${hub}\\${d}\\Editor\\Unity.exe`))
      .sort()
      .reverse();
    if (versions.length > 0) return `${hub}\\${versions[0]}\\Editor\\Unity.exe`;
  }
  return null;
}

const unity = findUnityEditor();
if (!unity) {
  console.error("[dev:unity] Unity Editor not found. Set UNITY_EDITOR_PATH or install Unity Hub + an LTS Editor with WebGL support.");
  process.exit(1);
}

const projectPath = new URL("../unity/", import.meta.url).pathname.replace(/^\//, "");
const logFile = new URL("../unity/Logs/dev-unity.log", import.meta.url).pathname.replace(/^\//, "");

console.log(`[dev:unity] Editor: ${unity}`);
console.log(`[dev:unity] Project: ${projectPath}`);
console.log("[dev:unity] Building WebGL (IL2CPP) — this can take several minutes on the first run...");

const args = [
  "-batchmode",
  "-nographics",
  `-projectPath`, projectPath,
  `-executeMethod`, "TrustCamp.EditorTools.BuildScript.BuildWebGL",
  `-logFile`, logFile,
];
// No -quit: BuildScript calls EditorApplication.Exit on failure; on success the batchmode quits.
const res = spawnSync(unity, args, { stdio: "inherit", timeout: 900000 });

if (res.error) {
  console.error("[dev:unity] spawn error:", res.error.message);
  process.exit(1);
}
const code = res.status ?? 1;
if (code !== 0) {
  console.error(`[dev:unity] Unity build failed (exit ${code}). See ${logFile}.`);
  process.exit(code);
}
console.log("[dev:unity] build complete -> public/unity/Build/");
