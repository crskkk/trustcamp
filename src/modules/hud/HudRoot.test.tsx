import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Hud, useHudLang } from "./api";

// Mock localStorage per-test so the test is hermetic.
beforeEach(() => {
  localStorage.clear();
  cleanup();
});

describe("Hud", () => {
  it("renders the chrome bar with all HUD placeholders", () => {
    render(<Hud />);
    // The toggle button is always visible (collapsed or expanded).
    expect(screen.getByRole("button", { name: /collapse|hud\.collapse/i })).toBeInTheDocument();
    // The seven placeholder rows in the expanded default view.
    for (const key of ["score", "role", "level", "items", "notifications", "avatar", "leaderboard"]) {
      // The english label is the i18n key when the dictionary has no value,
      // but our en.json will define them; the test relies on the english
      // substring in the dict.
      expect(screen.getByText(new RegExp(key, "i"))).toBeInTheDocument();
    }
  });

  it("collapses to a single button on click and re-expands on second click", () => {
    render(<Hud />);
    // Initial state is expanded. Click collapse.
    const collapse = screen.getByRole("button", { name: /collapse/i });
    fireEvent.click(collapse);
    // After collapse: only the toggle button is visible.
    const toggles = screen.queryAllByRole("button");
    expect(toggles).toHaveLength(1);
    // The button now reads "expand".
    expect(screen.getByRole("button", { name: /expand/i })).toBeInTheDocument();
    // Rows are gone.
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();

    // Click expand → rows return.
    fireEvent.click(screen.getByRole("button", { name: /expand/i }));
    expect(screen.getByText(/score/i)).toBeInTheDocument();
    expect(screen.getByText(/leaderboard/i)).toBeInTheDocument();
  });

  it("persists the collapsed state to localStorage", () => {
    render(<Hud />);
    const collapse = screen.getByRole("button", { name: /collapse/i });
    fireEvent.click(collapse);
    expect(localStorage.getItem("tc.hud.collapsed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /expand/i }));
    expect(localStorage.getItem("tc.hud.collapsed")).toBe("false");
  });

  it("switches the active language when a language button is clicked", () => {
    render(<Hud />);
    // The HUD chrome's data-lang attribute is the source of truth.
    const root = screen.getByTestId("hud-root");
    expect(root).toHaveAttribute("data-lang", "en");
    // Click the in-chrome ES language button (aria-label is the Spanish name).
    fireEvent.click(screen.getByTestId("hud-lang-es"));
    expect(root).toHaveAttribute("data-lang", "es");
    // The Spanish label for `hud.score` is "Puntuación" — it should now render.
    expect(screen.getByText(/Puntuación/)).toBeInTheDocument();
    // Switch to pt.
    fireEvent.click(screen.getByTestId("hud-lang-pt"));
    expect(root).toHaveAttribute("data-lang", "pt");
    expect(screen.getByText(/Pontuação/)).toBeInTheDocument();
  });

  it("exposes a useHudLang hook for HUD-connected panels", () => {
    function Probe() {
      const { lang, setLang } = useHudLang();
      return (
        <div>
          <span data-testid="probe-lang">{lang}</span>
          <button onClick={() => setLang("pt")}>pt</button>
        </div>
      );
    }
    // When the probe is rendered inside <Hud />, both the chrome and the
    // probe read the same language state from the shared context.
    render(
      <Hud>
        <Probe />
      </Hud>,
    );
    expect(screen.getByTestId("probe-lang")).toHaveTextContent("en");
    fireEvent.click(screen.getByTestId("hud-lang-pt"));
    expect(screen.getByTestId("probe-lang")).toHaveTextContent("pt");
  });
});
