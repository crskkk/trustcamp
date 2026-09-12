// src/modules/minigames/events/firewood-dash.ts — Firewood Dash (60 s).
// Eight logs lie along the trails near camp. Carry up to three at a time and
// drop them at the campfire: 10 points per log. Solo or with teammates
// (everyone delivers to the same fire).
import type { MinigameContext, MinigameEvent, MinigameMeta } from "../api";
import { REGIONS, TRAIL_SAMPLES, angDist, offsetDir, worldPosition, type V3 } from "../../world3d/api";

export const meta: MinigameMeta = {
  slug: "firewood-dash",
  title: { en: "Firewood Dash", es: "Carrera de Leña", pt: "Corrida da Lenha" },
  inputs: ["move"],
  solo: true,
  versus: true,
  durationSec: 60,
  maxPoints: 80,
};

const LOGS = 8;
const CARRY = 3;
const PICK_RADIUS = 1.7;
const DELIVER_RADIUS = 3.2;
const POINTS_PER_LOG = 10;

const T = {
  intro: { en: "Grab logs along the trails and drop them at the campfire (3 at a time)", es: "Recoge leña en los senderos y déjala en la fogata (3 a la vez)", pt: "Pegue lenha nas trilhas e leve para a fogueira (3 por vez)" },
  carrying: { en: "Carrying logs", es: "Llevando leña", pt: "Carregando lenha" },
  delivered: { en: "Logs delivered", es: "Leña entregada", pt: "Lenha entregue" },
  full: { en: "Arms full! Bring these to the fire", es: "¡Brazos llenos! Llévalos a la fogata", pt: "Braços cheios! Leve para a fogueira" },
};

/** Log spots: trail samples 13-35 m from camp, spread evenly, nudged off the path. */
export function logSpots(): V3[] {
  const near = TRAIL_SAMPLES.filter((s) => {
    const d = angDist(s, REGIONS.camp);
    return d > 0.28 && d < 0.72;
  });
  const out: V3[] = [];
  for (let i = 0; i < LOGS; i++) {
    const s = near[Math.floor(((i + 0.5) * near.length) / LOGS) % near.length];
    const side = i % 2 ? 1 : -1;
    out.push(offsetDir(s, side * (1.4 + (i % 3) * 0.5), ((i * 7) % 5) - 2));
  }
  return out;
}

export function createFirewoodDash(): MinigameEvent {
  let logs = new Map<string, V3>();
  let carrying = 0;
  let delivered = 0;
  return {
    meta,
    activate(ctx: MinigameContext) {
      logs = new Map();
      carrying = 0;
      delivered = 0;
      logSpots().forEach((d, i) => {
        const pos = worldPosition(d);
        logs.set(`log${i}`, pos);
        ctx.spawn(`log${i}`, "log", pos);
      });
      ctx.progress(0, LOGS, T.delivered);
      ctx.toast(T.intro);
    },
    tick(ctx: MinigameContext) {
      if (!ctx.playerPos()) return;
      if (carrying < CARRY) {
        for (const [id, pos] of logs) {
          if (ctx.distanceToPlayer(pos) < PICK_RADIUS) {
            logs.delete(id);
            ctx.despawn(id);
            carrying++;
            ctx.toast(carrying >= CARRY ? T.full : { en: `${T.carrying.en}: ${carrying}/${CARRY}`, es: `${T.carrying.es}: ${carrying}/${CARRY}`, pt: `${T.carrying.pt}: ${carrying}/${CARRY}` });
            break;
          }
        }
      }
      if (carrying > 0 && ctx.distanceToPlayer(ctx.campfire()) < DELIVER_RADIUS) {
        ctx.award(POINTS_PER_LOG * carrying);
        delivered += carrying;
        carrying = 0;
        ctx.progress(delivered, LOGS, T.delivered);
        if (delivered >= LOGS) ctx.end();
      }
    },
    deactivate() {
      logs.clear();
    },
  };
}
