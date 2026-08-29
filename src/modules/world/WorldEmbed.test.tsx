import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorldEmbed } from "./WorldEmbed";

describe("WorldEmbed", () => {
  it("renders an iframe pointing at the Unity build path", () => {
    const { container } = render(<WorldEmbed />);
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("src")).toContain("/unity/Build/index.html");
  });

  it("shows a localized loading overlay until the iframe loads", () => {
    render(<WorldEmbed />);
    // Default English dictionary value for world.loading.
    expect(screen.getByText(/loading/i, { exact: false })).toBeInTheDocument();
  });
});
