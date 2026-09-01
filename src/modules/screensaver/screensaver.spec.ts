import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startOrbit, stopOrbit, isOrbiting, getYaw } from "./api";

/** A stand-in for the Unity iframe: captures UnityGame.SendMessage calls. */
function fakeFrame() {
  const send = vi.fn();
  const frame = {
    contentWindow: { UnityGame: { SendMessage: send } },
  } as unknown as HTMLIFrameElement;
  return { frame, send };
}

describe("screensaver api — shell-driven camera orbit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stopOrbit();
    delete (window as unknown as { __tcBridge?: unknown }).__tcBridge;
  });

  afterEach(() => {
    stopOrbit();
    vi.useRealTimers();
  });

  it("startOrbit begins an orbit and detaches Unity's own auto-orbit", () => {
    const { frame, send } = fakeFrame();
    startOrbit({ frame, degPerSec: 60 });
    expect(isOrbiting()).toBe(true);
    expect(send).toHaveBeenCalledWith("OrbitCamera", "SetAutoOrbit", "0");
  });

  it("advances yaw over time and pushes it to Unity + the __tcBridge.__camera sentinel", () => {
    const { frame, send } = fakeFrame();
    startOrbit({ frame, degPerSec: 60 });
    const y0 = getYaw();

    vi.advanceTimersByTime(1000); // ~1s at 60 deg/s → ~+60°
    const y1 = getYaw();

    expect(y1).toBeGreaterThan(y0);
    expect(y1 - y0).toBeGreaterThan(30);

    const setYaw = send.mock.calls.filter((c) => c[0] === "OrbitCamera" && c[1] === "SetYaw");
    expect(setYaw.length).toBeGreaterThan(0);
    expect(Number(setYaw.at(-1)![2])).toBeCloseTo(y1, 0);

    const cam = (window as unknown as { __tcBridge?: { __camera?: { yaw?: number } } }).__tcBridge
      ?.__camera;
    expect(cam?.yaw).toBeCloseTo(y1, 0);
  });

  it("stopOrbit freezes the yaw (detached state for host steering)", () => {
    const { frame } = fakeFrame();
    startOrbit({ frame, degPerSec: 60 });
    vi.advanceTimersByTime(500);
    const frozen = getYaw();

    stopOrbit();
    expect(isOrbiting()).toBe(false);

    vi.advanceTimersByTime(2000);
    expect(getYaw()).toBe(frozen);
  });

  it("start after stop resumes from the frozen yaw", () => {
    const { frame } = fakeFrame();
    startOrbit({ frame, degPerSec: 60 });
    vi.advanceTimersByTime(500);
    stopOrbit();
    const resumeFrom = getYaw();

    startOrbit({ frame, degPerSec: 60 });
    vi.advanceTimersByTime(500);
    expect(getYaw()).toBeGreaterThan(resumeFrom);
  });

  it("installs a window.__tcScreensaver dev hook (start / stop / isOrbiting)", () => {
    const hook = (window as unknown as { __tcScreensaver?: Record<string, unknown> })
      .__tcScreensaver;
    expect(hook).toBeDefined();
    expect(typeof hook!.start).toBe("function");
    expect(typeof hook!.stop).toBe("function");
    expect(typeof hook!.isOrbiting).toBe("function");
  });
});
