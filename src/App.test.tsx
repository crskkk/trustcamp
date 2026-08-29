import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("App shell", () => {
  it("renders the localized title", () => {
    render(<App />);
    expect(screen.getByText("TrustCamp")).toBeInTheDocument();
  });

  it("mounts the Unity placeholder", () => {
    render(<App />);
    expect(screen.getByTestId("unity-placeholder")).toBeInTheDocument();
  });

  it("mounts the dev-only System Status panel", () => {
    render(<App />);
    // The panel reads i18n key status.title in English by default.
    expect(screen.getByText("System Status")).toBeInTheDocument();
  });
});
