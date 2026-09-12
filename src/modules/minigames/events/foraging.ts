// src/modules/minigames/events/foraging.ts — passive foraging (always on).
// Pinecones and berries dot the trails and meadows; walking into one grants
// a little XP and it regrows elsewhere after a while. No timer, no envelope.
import type { MinigameContext, MinigameEvent, MinigameMeta } from "../api";
import { REGIONS, TRAIL_SAMPLES, angDist, offsetDir, worldPosition, type V3 } from "../../world3d/api";

export const meta: MinigameMeta = {
  slug: "foraging",
  title: { en: "Foraging", es: "Recolección", pt: "Coleta" },
  inputs: ["move"],
  solo: true,
  versus: false,
  durationSec: 0,
  maxPoints: 0,
  passive: true,
};

const COUNT = 36;
const XP = 3;
const PICK_RADIUS = 1.4;
const REGROW_SEC = 45;

const T = { xp: { en: "+3 XP", es: "+3 XP", pt: "+3 XP" } };

interface Item { id: string; pos: V3; kind: "pinecone" | "berry"; regrowAt: number }

function spot(i: number, salt: number): V3 {
  const candidates = TRAIL_SAMPLES.filter((s) => angDist(s, REGIONS.camp) > 0.2 && angDist(s, REGIONS.lake) > 0.2);
  const s = candidates[(i * 53 + salt * 17) % candidates.length];
  const k = (i * 31 + salt * 7) % 11;
  return offsetDir(s, (k % 5) - 2 + (k > 5 ? 1.5 : -1.5), ((k * 3) % 7) - 3);
}

export function createForaging(): MinigameEvent {
  let items: Item[] = [];
  let clock = 0;
  return {
    meta,
    activate(ctx: MinigameContext) {
      clock = 0;
      items = [];
      for (let i = 0; i < COUNT; i++) {
        const it: Item = { id: `f${i}`, pos: worldPosition(spot(i, 0)), kind: i % 3 === 0 ? "berry" : "pinecone", regrowAt: 0 };
        items.push(it);
        ctx.spawn(it.id, it.kind, it.pos);
      }
    },
    tick(ctx: MinigameContext, dt: number) {
      clock += dt;
      if (!ctx.playerPos()) return;
      for (const it of items) {
        if (it.regrowAt > 0) {
          if (clock >= it.regrowAt) {
            it.regrowAt = 0;
            it.pos = worldPosition(spot(Number(it.id.slice(1)), Math.floor(clock)));
            ctx.spawn(it.id, it.kind, it.pos);
          }
          continue;
        }
        if (ctx.distanceToPlayer(it.pos) < PICK_RADIUS) {
          ctx.despawn(it.id);
          it.regrowAt = clock + REGROW_SEC;
          ctx.award(XP, T.xp);
        }
      }
    },
    deactivate() {
      items = [];
    },
  };
}
