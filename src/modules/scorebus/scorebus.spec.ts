import { describe, it, expect, vi } from "vitest";
import {
  ROUND_ENVELOPE_VERSION,
  validateEnvelope,
  createSink,
  type RoundEnvelope,
} from "./api";

function goodEnvelope(over: Partial<RoundEnvelope> = {}): RoundEnvelope {
  return {
    version: ROUND_ENVELOPE_VERSION,
    roundId: "round-abc123",
    sessionId: "sess-xxxxxxxxxxxx",
    minigame: "scouting",
    playerId: "p-0007",
    role: "scout",
    points: 40,
    maxPoints: 100,
    startedAt: 1_700_000_000_000,
    endedAt: 1_700_000_030_000,
    ...over,
  };
}

describe("scorebus — round envelope schema", () => {
  it("accepts a well-formed envelope", () => {
    const res = validateEnvelope(goodEnvelope());
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toMatchObject({ roundId: "round-abc123", points: 40 });
  });

  it("rejects non-objects", () => {
    for (const bad of [null, undefined, 3, "x", [], true]) {
      const res = validateEnvelope(bad);
      expect(res.ok).toBe(false);
    }
  });

  it("rejects the wrong envelope version", () => {
    const res = validateEnvelope(goodEnvelope({ version: 2 as 1 }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.join(" ")).toMatch(/version/i);
  });

  it("rejects missing / empty opaque id + string fields", () => {
    for (const key of ["roundId", "sessionId", "minigame", "playerId", "role"] as const) {
      expect(validateEnvelope(goodEnvelope({ [key]: "" })).ok).toBe(false);
      const missing = goodEnvelope();
      delete (missing as Record<string, unknown>)[key];
      expect(validateEnvelope(missing).ok).toBe(false);
    }
  });

  it("rejects out-of-range points", () => {
    expect(validateEnvelope(goodEnvelope({ points: -1 })).ok).toBe(false);
    expect(validateEnvelope(goodEnvelope({ maxPoints: 0 })).ok).toBe(false);
    expect(validateEnvelope(goodEnvelope({ points: 120, maxPoints: 100 })).ok).toBe(false);
    expect(validateEnvelope(goodEnvelope({ points: Number.NaN })).ok).toBe(false);
  });

  it("rejects a round that ends before it starts", () => {
    const res = validateEnvelope(goodEnvelope({ startedAt: 2000, endedAt: 1000 }));
    expect(res.ok).toBe(false);
  });

  it("rejects an envelope carrying PII (AGENTS §5)", () => {
    for (const piiKey of ["name", "email", "picture", "givenName", "family_name", "displayName"]) {
      const res = validateEnvelope({ ...goodEnvelope(), [piiKey]: "should-not-be-here" });
      expect(res.ok, `${piiKey} must be rejected`).toBe(false);
      if (!res.ok) expect(res.errors.join(" ")).toMatch(/pii/i);
    }
  });
});

describe("scorebus — in-memory ingest sink", () => {
  it("accepts valid envelopes, counts them, and drains", () => {
    const sink = createSink();
    expect(sink.ingest(goodEnvelope()).accepted).toBe(true);
    expect(sink.ingest(goodEnvelope({ roundId: "round-2" })).accepted).toBe(true);
    expect(sink.count()).toBe(2);
    const drained = sink.drain();
    expect(drained).toHaveLength(2);
    expect(sink.count()).toBe(0);
  });

  it("rejects invalid envelopes without storing them", () => {
    const sink = createSink();
    const res = sink.ingest({ version: 1, roundId: "" });
    expect(res.accepted).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
    expect(sink.count()).toBe(0);
  });

  it("fires onAccept with the parsed envelope (the debug-overlay seam)", () => {
    const onAccept = vi.fn();
    const sink = createSink({ onAccept });
    sink.ingest(goodEnvelope());
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept.mock.calls[0][0]).toMatchObject({ roundId: "round-abc123" });
    sink.ingest({ bad: true });
    expect(onAccept).toHaveBeenCalledTimes(1);
  });
});
