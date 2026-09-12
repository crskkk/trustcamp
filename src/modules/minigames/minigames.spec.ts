import { describe, it, expect, beforeEach } from "vitest";
import {
  register, list, startRound, startPassive, tickRound, endRound, getActive, subscribe, resetMinigames, getSink,
  type RoundEvent, type StartOptions,
} from "./api";
import { createFirewoodDash, logSpots } from "./events/firewood-dash";
import { createLanternRelay, lanternSpots } from "./events/lantern-relay";
import { createForaging } from "./events/foraging";
import { REGIONS, angDist, worldPosition, PLANET_RADIUS, normalize, type V3 } from "../world3d/api";

/** A headless world: the test moves the player by setting `player`. */
function fakeWorld() {
  const spawned = new Map<string, { kind: string; pos: V3; lit?: boolean }>();
  let player: V3 | null = worldPosition(REGIONS.camp);
  let clock = 1_000_000;
  const surface = (a: V3, b: V3) => angDist(normalize(a), normalize(b)) * PLANET_RADIUS;
  const opts: StartOptions = {
    sessionId: "s1",
    playerId: "p1",
    context: {
      now: () => clock,
      playerPos: () => player,
      distanceToPlayer: (pos) => (player ? surface(player, pos) : Infinity),
      spawn: (id, kind, pos, o) => spawned.set(id, { kind, pos, lit: o?.lit }),
      setPickup: (id, o) => { const e = spawned.get(id); if (e) e.lit = o.lit; },
      despawn: (id) => spawned.delete(id),
      clear: () => spawned.clear(),
      campfire: () => worldPosition(REGIONS.camp),
    },
  };
  return {
    opts, spawned,
    moveTo(pos: V3) { player = pos; },
    advance(sec: number) { clock += sec * 1000; tickRound(sec); },
  };
}

describe("minigames engine", () => {
  const events: RoundEvent[] = [];
  beforeEach(() => {
    resetMinigames();
    events.length = 0;
    register(createFirewoodDash());
    register(createLanternRelay());
    register(createForaging());
    subscribe((e) => events.push(e));
  });

  it("registers event files by slug with 15-90 s rounds and <= 2 inputs", () => {
    const metas = list();
    expect(metas.map((m) => m.slug).sort()).toEqual(["firewood-dash", "foraging", "lantern-relay"]);
    for (const m of metas.filter((m) => !m.passive)) {
      expect(m.durationSec).toBeGreaterThanOrEqual(15);
      expect(m.durationSec).toBeLessThanOrEqual(90);
      expect(m.inputs.length).toBeLessThanOrEqual(2);
      expect(m.title.en && m.title.es && m.title.pt).toBeTruthy();
    }
  });

  it("firewood dash: pick up logs (max 3), deliver at the campfire for 10 each, complete when all 8 land", () => {
    const w = fakeWorld();
    expect(startRound("firewood-dash", w.opts)).toBe(true);
    expect(w.spawned.size).toBe(8);
    const spots = logSpots();
    expect(spots.every((d) => { const m = angDist(d, REGIONS.camp) * PLANET_RADIUS; return m > 12 && m < 36; })).toBe(true);
    const logs = [...w.spawned.entries()];
    // Walk onto four logs: only three fit in the arms.
    for (let i = 0; i < 4; i++) { w.moveTo(logs[i][1].pos); w.advance(0.1); }
    expect(w.spawned.size).toBe(5);
    // Deliver at the fire.
    w.moveTo(worldPosition(REGIONS.camp));
    w.advance(0.1);
    expect(getActive()!.points).toBe(30);
    expect(getActive()!.progress).toMatchObject({ current: 3, total: 8 });
    // Fetch the rest.
    for (const [, e] of [...w.spawned.entries()]) {
      w.moveTo(e.pos); w.advance(0.1);
      w.moveTo(worldPosition(REGIONS.camp)); w.advance(0.1);
    }
    const end = events.find((e) => e.kind === "end");
    expect(end && end.kind === "end" && end.reason).toBe("complete");
    expect(end && end.kind === "end" && end.envelope?.points).toBe(80);
    expect(getActive()).toBeNull();
    expect(w.spawned.size).toBe(0);
  });

  it("firewood dash times out after 60 s and still emits an envelope", () => {
    const w = fakeWorld();
    startRound("firewood-dash", w.opts);
    w.advance(59);
    expect(getActive()!.timeLeft).toBeCloseTo(1, 0);
    w.advance(2);
    const end = events.find((e) => e.kind === "end");
    expect(end && end.kind === "end" && end.reason).toBe("timeout");
    expect(getSink().count()).toBe(1);
  });

  it("lantern relay: lanterns light only in trail order and the finish awards a time bonus", () => {
    const w = fakeWorld();
    startRound("lantern-relay", w.opts);
    const spots = lanternSpots().map((d) => worldPosition(d));
    expect(spots.length).toBe(6);
    for (let i = 1; i < 6; i++) expect(angDist(normalize(spots[i]), REGIONS.camp)).toBeGreaterThan(angDist(normalize(spots[i - 1]), REGIONS.camp));
    w.moveTo(spots[2]); w.advance(0.1);
    expect(w.spawned.get("lantern2")!.lit).toBe(false);
    expect(events.some((e) => e.kind === "toast" && /not that one/i.test(e.text.en))).toBe(true);
    for (let i = 0; i < 6; i++) { w.moveTo(spots[i]); w.advance(0.5); }
    const end = events.find((e) => e.kind === "end");
    expect(end && end.kind === "end" && end.reason).toBe("complete");
    const pts = end && end.kind === "end" ? end.envelope!.points : 0;
    expect(pts).toBeGreaterThan(72); // 6 x 12 + time bonus
    expect(pts).toBeLessThanOrEqual(95);
  });

  it("stopping a round emits no envelope; starting another ends the first", () => {
    const w = fakeWorld();
    startRound("lantern-relay", w.opts);
    startRound("firewood-dash", w.opts);
    expect(events.filter((e) => e.kind === "end").length).toBe(1);
    endRound("stopped");
    expect(events.filter((e) => e.kind === "end" && e.envelope === null).length).toBe(2);
    expect(getSink().count()).toBe(0);
  });

  it("passive foraging awards XP on pickup and regrows the item later", () => {
    const w = fakeWorld();
    expect(startPassive("foraging", w.opts)).toBe(true);
    expect(w.spawned.size).toBe(36);
    const [id, first] = [...w.spawned.entries()][0];
    w.moveTo(first.pos); w.advance(0.1);
    expect(w.spawned.has(id)).toBe(false);
    const award = events.find((e) => e.kind === "award");
    expect(award && award.kind === "award" && award.passive && award.points).toBe(3);
    w.moveTo(worldPosition(REGIONS.lake));
    w.advance(50);
    expect(w.spawned.has(id)).toBe(true);
  });
});
