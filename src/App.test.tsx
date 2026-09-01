import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { App } from "./App";

// Reset localStorage between tests
beforeEach(() => {
  localStorage.clear();
  cleanup();
});

describe("App shell", () => {
  it("renders the localized title", () => {
    render(<App />);
    expect(screen.getByText("TrustCamp")).toBeInTheDocument();
  });

  it("renders the localized subtitle (defaults to English)", () => {
    render(<App />);
    expect(screen.getByText("A mini-planet camping world. Under construction.")).toBeInTheDocument();
  });

  it("subtitle updates when language is changed via HUD toggle", () => {
    render(<App />);
    
    // Initial English subtitle
    expect(screen.getByText(/mini-planet camping world/i)).toBeInTheDocument();
    
    // Click Spanish language button
    fireEvent.click(screen.getByTestId("hud-lang-es"));
    
    // Subtitle should now be in Spanish
    expect(screen.getByText(/mini-planeta/i)).toBeInTheDocument();
    
    // Click Portuguese language button
    fireEvent.click(screen.getByTestId("hud-lang-pt"));
    
    // Subtitle should now be in Portuguese
    expect(screen.getByText(/mini-planeta/i)).toBeInTheDocument();
  });
});
