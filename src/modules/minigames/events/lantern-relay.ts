// src/modules/minigames/events/lantern-relay.ts — Lantern Relay (45 s).
// Six unlit lanterns line the trail from the camp gate toward the lake.
// Light them in order by running past each one: 12 points a lantern, plus
// half a point for every second left when the last one glows.
import type { MinigameContext, MinigameEvent, MinigameMeta } from "../api";
import { REGIONS, TRAIL_SAMPLES, angDist, worldPosition, type V3 } from "../../world3d/api";

export const meta: MinigameMeta = {
  slug: "lantern-relay",
  title: { en: "Lantern Relay", es: "Relevo de Faroles", pt: "Revezamento das Lanternas" },
  inputs: ["move"],
  solo: true,
  versus: true,
  durationSec: 45,
  maxPoints: 95,
};

const COUNT = 6;
const LIGHT_RADIUS = 2.0;
const POINTS = 12;

const T = {
  intro: { en: "Light the lanterns toward the lake, in order!", es: "¡Enciende los faroles hacia el lago, en orden!", pt: "Acenda as lanternas em direção ao lago, em ordem!" },
  lit: { en: "Lanterns lit", es: "Faroles encendidos", pt: "Lanternas acesas" },
  wrong: { en: "Not that one yet - follow the trail", es: "Ese todavía no - sigue el sendero", pt: "Essa ainda não - siga a trilha" },
  bonus: { en: "Time bonus!", es: "¡Bono de tiempo!", pt: "Bônus de tempo!" },
};

/** Lantern spots: on the camp -> lake trail, 6-30 m from camp, ordered outward. */
export function lanternSpots(): V3[] {
  const onLakeTrail = TRAIL_SAMPLES.filter((s) => {
    const d = angDist(s, REGIONS.camp);
    return d > 0.12 && d < 0.62 && angDist(s, REGIONS.lake) < angDist(s, REGIONS.hills);
  }).sort((a, b) => angDist(a, REGIONS.camp) - angDist(b, REGIONS.camp));
  const out: V3[] = [];
  for (let i = 0; i < COUNT; i++) out.push(onLakeTrail[Math.floor(((i + 0.5) * onLakeTrail.length) / COUNT) % onLakeTrail.length]);
  return out;
}

export function createLanternRelay(): MinigameEvent {
  let spots: V3[] = [];
  let next = 0;
  let warnedAt = -1;
  return {
    meta,
    activate(ctx: MinigameContext) {
      spots = lanternSpots().map((d) => worldPosition(d));
      next = 0;
      warnedAt = -1;
      spots.forEach((pos, i) => ctx.spawn(`lantern${i}`, "lantern", pos, { lit: false }));
      ctx.progress(0, COUNT, T.lit);
      ctx.toast(T.intro);
    },
    tick(ctx: MinigameContext) {
      if (!ctx.playerPos() || next >= COUNT) return;
      if (ctx.distanceToPlayer(spots[next]) < LIGHT_RADIUS) {
        ctx.setPickup(`lantern${next}`, { lit: true });
        ctx.award(POINTS);
        next++;
        ctx.progress(next, COUNT, T.lit);
        if (next >= COUNT) {
          const bonus = Math.round(Math.max(0, ctx.timeLeft()) * 0.5);
          if (bonus > 0) ctx.award(bonus, T.bonus);
          ctx.end();
        }
        return;
      }
      for (let i = next + 1; i < COUNT; i++) {
        if (ctx.distanceToPlayer(spots[i]) < LIGHT_RADIUS && warnedAt !== i) {
          warnedAt = i;
          ctx.toast(T.wrong);
        }
      }
    },
    deactivate() {
      spots = [];
    },
  };
}
