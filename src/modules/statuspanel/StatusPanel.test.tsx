import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPanel } from "./StatusPanel";

// Mock the worker invocations + readers so the component test is deterministic.
vi.mock("./panelRuntime", () => ({
  runAllWorkers: vi.fn(async () => ({
    results: {
      "arch-check": { ok: true, message: "ok" },
      "i18n-check": { ok: true, message: "ok" },
      "system-update": { ok: true, message: "ok" },
      "bundle-guard": { ok: true, message: "ok" },
    },
  })),
  readTestResults: vi.fn(async () => ({ total: 10, passed: 10 })),
  readVersion: vi.fn(async () => "v0.1"),
  readSystemMd: vi.fn(async () => "# SYSTEM.md\n## Modules\n- demo"),
  readTaskLog: vi.fn(async () => []),
  parseTaskLog: vi.fn(() => []),
}));

describe("StatusPanel", () => {
  it("renders the four worker rows, test count, version chip, and SYSTEM.md preview", async () => {
    render(<StatusPanel />);
    expect(await screen.findByText("System Status")).toBeInTheDocument();
    expect(await screen.findByText("arch:check")).toBeInTheDocument();
    expect(await screen.findByText("i18n:check")).toBeInTheDocument();
    expect(await screen.findByText("system:update")).toBeInTheDocument();
    expect(await screen.findByText("bundle:guard")).toBeInTheDocument();
    expect(await screen.findByText(/10 \/ 10/)).toBeInTheDocument();
    expect(await screen.findByText("v0.1")).toBeInTheDocument();
    expect(await screen.findByText(/## Modules/)).toBeInTheDocument();
  });

  it("renders the task log table when readTaskLog returns rows", async () => {
    // Re-mock readTaskLog for this test only.
    const runtime = await import("./panelRuntime");
    (runtime.readTaskLog as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { task: "0001", version: "v0.1", title: "spine", commit: "d046763", codeIn: 0, codeOut: 480, tools: 8, convIn: 18000, convOut: 6000, total: 24488 },
      { task: "0102", version: "v1.2", title: "presence", commit: "deaf6e3", codeIn: 760, codeOut: 480, tools: 14, convIn: 28000, convOut: 9000, total: 38264 },
    ]);
    render(<StatusPanel />);
    const section = await screen.findByTestId("task-log");
    expect(section).toBeInTheDocument();
    // 0102 is the most recent, so it appears first.
    const rows = section.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute("data-task")).toBe("0102");
    expect(rows[0]).toHaveTextContent("0102");
    expect(rows[0]).toHaveTextContent("v1.2");
    expect(rows[0]).toHaveTextContent("38.3k");
  });
});
