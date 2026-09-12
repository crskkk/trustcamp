import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { Hud, setHudGame } from "../hud/api";
import { Menu, openMenu, closeMenu, toggleMenu, getMenuState, setMenuIdentity } from "./api";
import { setSelf, addSelfScore, resetLeaderboard } from "../leaderboard/api";

vi.mock("../world3d/api", async () => {
  const actual = await vi.importActual<typeof import("../world3d/api")>("../world3d/api");
  return { ...actual, getWorld: () => null };
});

describe("menu module", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    act(() => closeMenu());
    resetLeaderboard();
    act(() => setMenuIdentity({ playerId: "p1", sessionId: "solo", host: false }));
    act(() => setHudGame({ games: [{ slug: "firewood-dash", title: { en: "Firewood Dash", es: "Leña", pt: "Lenha" } }], round: null }));
  });

  it("is closed by default and opens on the requested tab", () => {
    render(<Hud><Menu /></Hud>);
    expect(screen.queryByTestId("menu")).toBeNull();
    act(() => openMenu("customize"));
    expect(getMenuState()).toMatchObject({ open: true, tab: "customize" });
    act(() => toggleMenu("customize"));
    expect(getMenuState().open).toBe(false);
    act(() => toggleMenu("play"));
    expect(getMenuState()).toMatchObject({ open: true, tab: "play" });
  });

  it("renders the four tabs, lists games on Play, and closes with the X and Escape", () => {
    render(<Hud><Menu /></Hud>);
    act(() => openMenu("play"));
    expect(screen.getByTestId("menu")).toBeInTheDocument();
    for (const tab of ["play", "customize", "leaderboard", "settings"]) expect(screen.getByTestId(`menu-tab-${tab}`)).toBeInTheDocument();
    expect(screen.getByTestId("menu-play-firewood-dash")).toHaveTextContent("Firewood Dash");
    fireEvent.click(screen.getByTestId("menu-close"));
    expect(screen.queryByTestId("menu")).toBeNull();
    act(() => openMenu("play"));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("menu")).toBeNull();
  });

  it("leaderboard tab shows the local row, team score, and localizes with the HUD language", () => {
    setSelf({ playerId: "p1", seed: 7 });
    addSelfScore(42);
    render(<Hud><Menu /></Hud>);
    act(() => openMenu("leaderboard"));
    expect(screen.getByTestId("menu-team")).toHaveTextContent("42");
    expect(screen.getByTestId("menu-board")).toHaveTextContent(/\(you\)/);
    fireEvent.click(screen.getByTestId("hud-lang-es"));
    expect(screen.getByTestId("menu-board")).toHaveTextContent(/\(tú\)/);
  });

  it("customize re-roll persists a new seed and settings shows the solo transport", () => {
    const seeds: number[] = [];
    render(<Hud><Menu onSeed={(s) => seeds.push(s)} /></Hud>);
    act(() => openMenu("customize"));
    fireEvent.click(screen.getByTestId("menu-reroll"));
    expect(seeds).toHaveLength(1);
    expect(localStorage.getItem("tc.avatar.seed")).toBe(String(seeds[0]));
    fireEvent.click(screen.getByTestId("menu-tab-settings"));
    expect(screen.getByTestId("menu-transport")).toHaveTextContent(/Solo/);
    expect(screen.queryByTestId("menu-wrap")).toBeNull();
  });

  it("the HUD menu button and the Avatar/Leaderboard rows open the drawer", () => {
    render(<Hud onMenu={(tab) => openMenu(tab)}><Menu /></Hud>);
    fireEvent.click(screen.getByTestId("hud-menu"));
    expect(getMenuState().open).toBe(true);
    fireEvent.click(screen.getByTestId("hud-row-leaderboard"));
    expect(getMenuState().tab).toBe("leaderboard");
    fireEvent.click(screen.getByTestId("hud-row-avatar"));
    expect(getMenuState().tab).toBe("customize");
  });
});
