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
});
