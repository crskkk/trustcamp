// Shared reader contract so worker logic runs in BOTH Node (CI, fs/glob) and
// the browser (StatusPanel, import.meta.glob + fetch). Workers never touch fs
// directly; they accept a Reader.

export interface ModuleEntry {
  /** Folder path relative to repo root, e.g. "src/modules/i18n". */
  dir: string;
  /** Parsed module.yaml contents. */
  yaml: ModuleYaml;
}

export interface ModuleYaml {
  name: string;
  description: string;
  version: string;
  api: string;
  depends_on: string[];
}

export interface Reader {
  /** Return every module.yaml under src/modules (and any other roots). */
  listModules(): Promise<ModuleEntry[]>;
  /** Read a file as UTF-8 text, or throw if absent. */
  readFile(path: string): Promise<string>;
  /** List files matching a glob under repo root (posix-style). */
  glob(pattern: string): Promise<string[]>;
}

export interface WorkerResult {
  ok: boolean;
  /** Human-readable summary; structured fields may be added per worker. */
  message: string;
  /** Keyed extras for the panel/UI. */
  details?: Record<string, unknown>;
}
