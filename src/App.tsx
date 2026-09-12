import { useEffect, useState } from "react";
import { t, type Lang } from "./modules/i18n/api";
import { useHudLang, Hud, setHudGame, showHudToast, type LangText } from "./modules/hud/api";
import { StatusPanel } from "./modules/statuspanel/StatusPanel";
import { WorldCanvas, getWorld, npcWanderBy } from "./modules/world3d/api";
import { startOrbit, stopOrbit } from "./modules/screensaver/api";
import { PresenceOverlay, startPresence, subscribePresence, removePeer } from "./modules/presence/api";
import {
  joinWorld as bridgeJoinWorld, leaveWorld, sendState as bridgeSendState, onState as bridgeOnState, onLeave as bridgeOnLeave,
  configureWs, getTransport, sendRound, sendProgress, mountBridge,
} from "./modules/bridge/api";
import { spawnNpc, clearNpcs, listNpcs, setNpcCap } from "./modules/npc/api";
import { startNpcMotion, stopNpcMotion } from "./modules/npc/bridge";
import * as bridgeApi from "./modules/bridge/api";
import { registerDefaults, list as listGames, startRound, endRound, startPassive, attachFrameDriver, subscribe as subscribeRounds, type RoundState } from "./modules/minigames/api";
import { getProgress, grantXp, subscribeProgress, setProgressPersistence } from "./modules/progress/api";
import { setSelf, addSelfScore, setSelfLevel, selfPublish, startLeaderboard, subscribeLeaderboard, nickFor } from "./modules/leaderboard/api";

export function App() {
  if (typeof window !== "undefined" && window.location.pathname === "/screensaver") {
    return <Screensaver />;
  }
  return (
    <div className="tc-app">
      <Bootstrap />
      <Hud onAction={(slug) => startRound(slug, { playerId: playerIdRef.id, sessionId: SESSION_ID, role: "scout" })} onStop={() => endRound("stopped")}>
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

// Each tab mints its own opaque player id at module load. No PII anywhere.
const SELF_ID: string =
  (typeof window !== "undefined" &&
    (window.crypto?.randomUUID?.() ?? "self-" + Math.random().toString(36).slice(2, 12))) ||
  "self";
const SESSION_ID = "solo";
/** The id the server assigned us (ws) or SELF_ID (solo). Set after joinWorld. */
const playerIdRef = { id: SELF_ID };

/** Server URL: build-time VITE_WS_URL, then ?ws=, then a remembered choice. Empty = solo. */
function resolveWsUrl(): string | null {
  try {
    const env = (import.meta.env.VITE_WS_URL as string | undefined) ?? "";
    const param = new URLSearchParams(window.location.search).get("ws");
    if (param !== null) {
      if (param === "" || param === "off") { window.localStorage.removeItem("tc.ws"); return null; }
      window.localStorage.setItem("tc.ws", param);
      return param;
    }
    return window.localStorage.getItem("tc.ws") || env || null;
  } catch {
    return null;
  }
}

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
const LANGS: Lang[] = ["en", "es", "pt"];

/** Localised text from a dictionary key with {var} substitutions. */
function fmt(key: string, vars: Record<string, string>): LangText {
  const out = {} as LangText;
  for (const l of LANGS) out[l] = Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), t(key, l));
  return out;
}

function roundView(s: RoundState) {
  return { title: s.meta.title, timeLeft: s.timeLeft, current: s.progress.current, total: s.progress.total, label: s.progress.label, points: s.points };
}

/**
 * Join the bridge world, publish the player's position + score at PUBLISH_MS,
 * mirror presence into 3D bodies, stroll the NPC villagers, and wire the
 * minigame engine, XP and leaderboard into the HUD. Multiplayer transport
 * lands in v2.2 (server/); today the in-memory bridge + localStorage heartbeat
 * make sibling tabs visible.
 */
function Bootstrap(): null {
  useEffect(() => {
    let stopped = false;
    const timers: ReturnType<typeof setInterval>[] = [];
    const unsubs: Array<() => void> = [];
    mountBridge(window); // host-console / e2e seam: window.__tcBridge
    configureWs(resolveWsUrl());
    let id = SELF_ID;
    const seeds = new Map<string, number>();

    (async () => {
      const join = await bridgeJoinWorld({ seed: PLAYER_SEED, nick: nickFor(PLAYER_SEED) });
      if (stopped || !join.ok) return;
      if (getTransport() === "ws") {
        id = join.sessionId;
        playerIdRef.id = id;
        setSelf({ playerId: id, seed: PLAYER_SEED });
        // Progress lives on the server for this player; XP writes go straight there.
        setProgressPersistence({ load: () => join.progress ?? null, save: (s) => sendProgress(s.xp) });
        unsubs.push(bridgeOnLeave((playerId) => removePeer(playerId)));
      }
      startPresence({ selfId: id, role: "scout" });
      unsubs.push(bridgeOnState((s) => {
        if (typeof s.seed === "number") seeds.set(s.playerId, s.seed);
      }));
      unsubs.push(subscribePresence((evt) => {
        const w = getWorld();
        if (!w) return;
        if (evt.kind === "leave") w.removeRemote(evt.playerId);
        else if (evt.state) w.setRemote(evt.playerId, { x: evt.state.x, y: evt.state.y, z: evt.state.z, role: evt.state.role, seed: seeds.get(evt.playerId) });
      }));
      const tick = () => {
        const s = getWorld()?.getPlayerSnapshot();
        const pos = s ? { x: s.x, y: s.y, z: s.z } : { x: 0, y: 0, z: 0 };
        bridgeSendState({ playerId: id, ...pos, role: "scout", ...selfPublish() }).catch(() => undefined);
        startPresence({ selfId: id, role: "scout", position: pos });
      };
      tick();
      timers.push(setInterval(tick, PUBLISH_MS));

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

    // --- game systems (need the 3D world for pickups; wait for it to mount) ---
    registerDefaults();
    setSelf({ playerId: id, seed: PLAYER_SEED, level: getProgress().level });
    startLeaderboard();
    const p0 = getProgress();
    setHudGame({
      level: p0.level, xpInto: p0.into, xpNeed: p0.need,
      games: listGames().filter((m) => !m.passive).map((m) => ({ slug: m.slug, title: m.title })),
    });
    unsubs.push(subscribeProgress((v, grant) => {
      setHudGame({ level: v.level, xpInto: v.into, xpNeed: v.need });
      setSelfLevel(v.level);
      if (grant?.leveledUp) showHudToast(fmt("hud.toast.levelUp", { n: String(grant.to) }));
    }));
    unsubs.push(subscribeLeaderboard((rows) => {
      const me = rows.find((r) => r.self);
      setHudGame({ score: me?.score ?? 0, teamScore: rows.reduce((s, r) => s + r.score, 0) });
    }));
    unsubs.push(subscribeRounds((e) => {
      switch (e.kind) {
        case "start":
        case "tick":
        case "progress":
          setHudGame({ round: roundView(e.state) });
          break;
        case "award":
          if (e.passive) {
            grantXp(e.points);
            if (e.why) showHudToast(e.why);
          } else if (e.state) setHudGame({ round: roundView(e.state) });
          break;
        case "toast":
          showHudToast(e.text);
          break;
        case "end":
          setHudGame({ round: null });
          if (e.envelope) {
            sendRound(e.envelope); // persisted by the server (no-op in solo mode)
            grantXp(e.envelope.points);
            addSelfScore(e.envelope.points);
            showHudToast(fmt(e.reason === "timeout" ? "hud.toast.roundTimeout" : "hud.toast.roundOver", { p: String(e.envelope.points) }));
          }
          break;
      }
    }));
    const waitWorld = setInterval(() => {
      if (!getWorld()) return;
      clearInterval(waitWorld);
      unsubs.push(attachFrameDriver());
      startPassive("foraging", { playerId: id });
    }, 100);
    timers.push(waitWorld);

    return () => {
      stopped = true;
      for (const tm of timers) clearInterval(tm);
      for (const u of unsubs) u();
      endRound("stopped");
      stopNpcMotion();
      void leaveWorld();
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
 * chrome, camera auto-orbiting under shell control.
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
