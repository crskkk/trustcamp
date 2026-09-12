import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const orbit = vi.hoisted(() => ({ setOrbit: vi.fn(), setOrbitYaw: vi.fn() }));
vi.mock("../world3d/api", () => ({ setOrbit: orbit.setOrbit, setOrbitYaw: orbit.setOrbitYaw }));

import { startOrbit, stopOrbit, isOrbiting, getYaw } from "./api";

describe("screensaver api — shell-driven camera orbit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stopOrbit();
    orbit.setOrbit.mockClear();
    orbit.setOrbitYaw.mockClear();
    delete (window as unknown as { __tcBridge?: unknown }).__tcBridge;
  });

  afterEach(() => {
    stopOrbit();
    vi.useRealTimers();
  });

  it("startOrbit begins an orbit and switches the world camera to orbit mode", () => {
    startOrbit({ degPerSec: 60 });
    expect(isOrbiting()).toBe(true);
    expect(orbit.setOrbit).toHaveBeenCalledWith(true);
  });

  it("advances yaw over time and pushes it to the world + the __tcBridge.__camera sentinel", () => {
    startOrbit({ degPerSec: 60 });
    const y0 = getYaw();
    vi.advanceTimersByTime(1000);
    const y1 = getYaw();
    expect(y1).toBeGreaterThan(y0);
    expect(y1 - y0).toBeGreaterThan(30);
    const last = orbit.setOrbitYaw.mock.calls.at(-1)![0] as number;
    expect(last).toBeCloseTo(y1, 0);
    const cam = (window as unknown as { __tcBridge?: { __camera?: { yaw?: number } } }).__tcBridge?.__camera;
    expect(cam?.yaw).toBeCloseTo(y1, 0);
  });

  it("stopOrbit freezes the yaw (detached state for host steering)", () => {
    startOrbit({ degPerSec: 60 });
    vi.advanceTimersByTime(500);
    const frozen = getYaw();
    stopOrbit();
    expect(isOrbiting()).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(getYaw()).toBe(frozen);
  });

  it("start after stop resumes from the frozen yaw", () => {
    startOrbit({ degPerSec: 60 });
    vi.advanceTimersByTime(500);
    stopOrbit();
    const resumeFrom = getYaw();
    startOrbit({ degPerSec: 60 });
    vi.advanceTimersByTime(500);
    expect(getYaw()).toBeGreaterThan(resumeFrom);
  });

  it("installs a window.__tcScreensaver dev hook (start / stop / isOrbiting)", () => {
    const hook = (window as unknown as { __tcScreensaver?: Record<string, unknown> }).__tcScreensaver;
    expect(hook).toBeDefined();
    expect(typeof hook!.start).toBe("function");
    expect(typeof hook!.stop).toBe("function");
    expect(typeof hook!.isOrbiting).toBe("function");
  });
});
