import { describe, it, expect } from "vitest";
import { parseTaskLog } from "./panelRuntime";

describe("parseTaskLog", () => {
  it("extracts rows from a TASK_LOG.md markdown table", () => {
    const md = `# TASK_LOG

Some preamble.

| task | version | title | commit | code_in | code_out | tools | conv_in | conv_out | total |
|------|---------|-------|--------|---------|----------|-------|---------|----------|-------|
| 0001 | v0.1 | spine | \`d046763\` | 0 | 480 | 8 | 18000 | 6000 | 24488 |
| 0102 | v1.2 | presence | \`deaf6e3\` | 760 | 480 | 14 | 28000 | 9000 | 38264 |
`;
    const rows = parseTaskLog(md);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      task: "0001",
      version: "v0.1",
      title: "spine",
      commit: "d046763",
      codeIn: 0,
      codeOut: 480,
      tools: 8,
      convIn: 18000,
      convOut: 6000,
      total: 24488,
    });
    expect(rows[1].task).toBe("0102");
    expect(rows[1].total).toBe(38264);
  });

  it("returns an empty array for empty input", () => {
    expect(parseTaskLog("")).toEqual([]);
    expect(parseTaskLog("# not a table\n\nno rows here")).toEqual([]);
  });
});
