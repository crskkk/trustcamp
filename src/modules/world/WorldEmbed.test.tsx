import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { WorldEmbed } from "./WorldEmbed";

describe("WorldEmbed", () => {
  it("renders an iframe pointing at a Unity embed path (build or placeholder)", () => {
    const { container } = render(<WorldEmbed />);
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    const src = iframe?.getAttribute("src") ?? "";
    expect(
      src === "/unity/Build/index.html" || src === "/unity/placeholder.html"
    ).toBe(true);
  });

  it("shows a localized loading overlay until the iframe loads", () => {
    render(<WorldEmbed />);
    expect(screen.getByText(/loading/i, { exact: false })).toBeInTheDocument();
  });

  it("falls back to the placeholder when the build HEAD fails", async () => {
    const { container } = render(<WorldEmbed />);
    await waitFor(() => {
      const iframe = container.querySelector("iframe");
      expect(iframe?.getAttribute("src")).toBe("/unity/placeholder.html");
    });
  });
});
