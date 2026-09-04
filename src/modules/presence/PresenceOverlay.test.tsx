// src/modules/presence/PresenceOverlay.test.tsx — task 0102 RED tests for
// the dev-only HUD strip. The overlay is a presentational component that
// reads the list of remote players and renders one chip per remote.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";

describe("PresenceOverlay", () => {
  beforeEach(() => {
    localStorage.clear();
    cleanup();
    vi.resetModules();
  });
  afterEach(() => {
    cleanup();
    vi.resetModules();
  });

  it("renders one chip per remote player and none for the local self", async () => {
    const handlers: Array<(s: unknown) => void> = [];
    vi.doMock("../bridge/api", () => ({
      onState: (cb: (s: unknown) => void) => {
        handlers.push(cb);
        return () => {};
      },
    }));
    const api = await import("./api");
    const ov = await import("./PresenceOverlay");
    api.startPresence({ selfId: "self" });
    render(<ov.PresenceOverlay selfId="self" />);
    expect(screen.queryByTestId("presence-chip")).toBeNull();
    act(() => {
      handlers[handlers.length - 1]?.({ playerId: "p1", x: 0, y: 0, z: 0, role: "scout" });
      handlers[handlers.length - 1]?.({ playerId: "p2", x: 0, y: 0, z: 0, role: "camp" });
      handlers[handlers.length - 1]?.({ playerId: "self", x: 0, y: 0, z: 0, role: "scout" });
    });
    const chips = screen.getAllByTestId("presence-chip");
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveTextContent(/scout/i);
    expect(chips[1]).toHaveTextContent(/camp/i);
    api.clearPresence();
  });

  it("collapses to a title-only header when no remotes are present", async () => {
    vi.doMock("../bridge/api", () => ({ onState: () => () => {} }));
    const api = await import("./api");
    const ov = await import("./PresenceOverlay");
    api.startPresence({ selfId: "self" });
    render(<ov.PresenceOverlay selfId="self" />);
    expect(screen.getByTestId("presence-overlay")).toBeInTheDocument();
    expect(screen.queryByTestId("presence-chip")).toBeNull();
    api.clearPresence();
  });
});
