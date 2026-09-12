import { useEffect, useState } from "react";
import { t } from "./modules/i18n/api";
import { useHudLang } from "./modules/hud/api";
import { StatusPanel } from "./modules/statuspanel/StatusPanel";
import { WorldCanvas, getWorld, npcWanderBy } from "./modules/world3d/api";
import { Hud } from "./modules/hud/api";
import { startOrbit, stopOrbit } from "./modules/screensaver/api";
import { PresenceOverlay, startPresence, subscribePresence } from "./modules/presence/api";
import { joinWorld as bridgeJoinWorld, sendState as bridgeSendState, mountBridge } from "./modules/bridge/api";
import { spawnNpc, clearNpcs, listNpcs, setNpcCap } from "./modules/npc/api";
import { startNpcMotion, stopNpcMotion } from "./modules/npc/bridge";
import * as bridgeApi from "./modules/bridge/api";

export function App() {
  if (typeof window !== "undefined" && window.location.pathname === "/screensaver") {
    return <Screensaver />;
  }
  return (
    <div className="tc-app">
      <Bootstrap />
      <Hud>
        <AppSubtitle />
        <WorldCanvas seed={PLAYER_SEED} />
      </Hud>
      {import.meta.env.DEV && (
        <>
          <StatusPanel />
          <PresenceOverlay selfId={SELF_ID} />
          <NpcDevControls />
        </>
      )}
    </div>
  );
}

// Each tab mints its own opaque session id at module load. Sharing this with
// the cross-tab heartbeat lets other tabs dedupe "self" correctly without
// needing a backend identity provider.
const SELF_ID: string =
  (typeof window !== "undefined" &&
    (window.crypto?.randomUUID?.() ?? "self-" + Math.random().toString(36).slice(2, 12))) ||
  "self";

const SEED_KEY = "tc.avatar.seed";

/** The local camper's look. Persisted so a reload keeps the same avatar. */
const PLAYER_SEED: number = (() => {
  try {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(SEED_KEY) : null;
    if (stored && /^\d+$/.test(stored)) return Number(stored);
    const fresh = Math.floor(Math.random() * 1_000_000);
    window.localStorage.setItem(SEED_KEY, String(fresh));
    return fresh;
  } catch {
    return 4242;
  }
})();

const NPC_SEEDS = [101, 202, 303, 404, 505];
const PUBLISH_MS = 250;

/**
 * Join the bridge world, publish the player's real position at PUBLISH_MS,
 * mirror presence into 3D bodies, and stroll a small NPC population along
 * the trails. Multiplayer transport lands in v2.2 (server/); today the
 * in-memory bridge + localStorage heartbeat make sibling tabs visible.
 */
function Bootstrap(): null {
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let unsub: (() => void) | null = null;
    mountBridge(window); // host-console / e2e seam: window.__tcBridge
    (async () => {
      const join = await bridgeJoinWorld();
      const id = join.sessionId || SELF_ID;
      if (stopped) return;
      startPresence({ selfId: id, role: "scout" });
      unsub = subscribePresence((evt) => {
        const w = getWorld();
        if (!w) return;
        if (evt.kind === "leave") w.removeRemote(evt.playerId);
        else if (evt.state) w.setRemote(evt.playerId, { x: evt.state.x, y: evt.state.y, z: evt.state.z, role: evt.state.role });
      });
      const tick = () => {
        const s = getWorld()?.getPlayerSnapshot();
        const pos = s ? { x: s.x, y: s.y, z: s.z } : { x: 0, y: 0, z: 0 };
        bridgeSendState({ playerId: id, ...pos, role: "scout" }).catch(() => undefined);
        startPresence({ selfId: id, role: "scout", position: pos });
      };
      tick();
      timer = setInterval(tick, PUBLISH_MS);

      setNpcCap(8);
      for (const seed of NPC_SEEDS) spawnNpc({ seed, role: "prospect", position: npcWanderBy(seed, 0) });
      startNpcMotion({
        bridge: bridgeApi,
        tickMs: PUBLISH_MS,
        speedMps: 2.4,
        stepPosition: (npc, distance) => {
          const m = /^npc-(\d+)$/.exec(npc.id);
          return m ? npcWanderBy(Number(m[1]), distance) : npc.position;
        },
      });
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      unsub?.();
      stopNpcMotion();
    };
  }, []);
  return null;
}

/**
 * Dev-only NPC controls: a "Clear NPCs" button next to the status panel
 * and a counter showing the current NPC count. Tree-shaken in production.
 */
function NpcDevControls(): JSX.Element {
  const [count, setCount] = useStateNpcs();
  const { lang } = useHudLang();
  return (
    <div className="tc-npc-dev" data-testid="npc-dev">
      <span className="tc-npc-dev-label">{t("npc.dev.label", lang)}: </span>
      <span className="tc-npc-dev-count" data-testid="npc-count">{count}</span>
      <button
        type="button"
        className="tc-npc-dev-clear"
        data-testid="npc-clear"
        onClick={() => {
          clearNpcs();
          setCount(0);
        }}
      >
        {t("npc.dev.clear", lang)}
      </button>
    </div>
  );
}

function useStateNpcs(): [number, (n: number) => void] {
  const [n, setN] = useState(() => (typeof window === "undefined" ? 0 : listNpcs().length));
  useEffect(() => {
    const i = setInterval(() => setN(listNpcs().length), 500);
    return () => clearInterval(i);
  }, []);
  return [n, setN];
}

/**
 * Screensaver / landing mode (task 0009): the planet full-bleed with no HUD
 * chrome, camera auto-orbiting under shell control. The detach hook
 * (window.__tcScreensaver.stop) is where host steering lands later.
 */
function Screensaver(): JSX.Element {
  useEffect(() => {
    startOrbit();
    return () => stopOrbit();
  }, []);
  return (
    <div className="tc-app">
      <WorldCanvas seed={PLAYER_SEED} />
    </div>
  );
}

function AppSubtitle(): JSX.Element {
  const { lang } = useHudLang();
  return <p className="tc-app-subtitle">{t("app.subtitle", lang)}</p>;
}
