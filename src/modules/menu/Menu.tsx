// src/modules/menu/Menu.tsx — the drawer (presentation + store glue).
import { useEffect, useMemo, useState } from "react";
import { t } from "../i18n/api";
import { useHudLang, useHudGame, showHudToast, type LangText } from "../hud/api";
import { generate } from "../avatar/api";
import { getWorld, landmark, avatarColors, type Area } from "../world3d/api";
import { startRound, endRound } from "../minigames/api";
import { getRows, subscribeLeaderboard, setSelf, type LeaderRow } from "../leaderboard/api";
import { getProgress, subscribeProgress } from "../progress/api";
import { getTransport } from "../bridge/api";
import { wrapSession } from "../lti/api";
import type { MenuTab } from "./api";

interface Props {
  tab: MenuTab;
  onTab: (t: MenuTab) => void;
  onClose: () => void;
  playerId: string;
  sessionId: string;
  onSeed?: (seed: number) => void;
  host?: boolean;
}

const TABS: MenuTab[] = ["play", "customize", "leaderboard", "settings"];
const AREAS: Area[] = ["camp", "lake", "forest", "hills"];
const SEED_KEY = "tc.avatar.seed";
const QUALITY_KEY = "tc.quality";
const WS_KEY = "tc.ws";

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}
function fmt(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), text);
}
function langText(key: string, vars: Record<string, string>): LangText {
  return { en: fmt(t(key, "en"), vars), es: fmt(t(key, "es"), vars), pt: fmt(t(key, "pt"), vars) };
}
function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function Menu({ tab, onTab, onClose, playerId, sessionId, onSeed, host }: Props): JSX.Element {
  const { lang, setLang } = useHudLang();
  const game = useHudGame();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside className="tc-menu" data-testid="menu" role="dialog" aria-label={t("menu.open", lang)}>
      <header className="tc-menu-head">
        <nav className="tc-menu-tabs" aria-label={t("menu.open", lang)}>
          {TABS.map((k) => (
            <button
              key={k}
              type="button"
              className={`tc-menu-tab${tab === k ? " is-active" : ""}`}
              aria-pressed={tab === k}
              data-testid={`menu-tab-${k}`}
              onClick={() => onTab(k)}
            >
              {t(`menu.tab.${k}`, lang)}
            </button>
          ))}
        </nav>
        <button type="button" className="tc-menu-close" aria-label={t("menu.close", lang)} data-testid="menu-close" onClick={onClose}>
          {"✕"}
        </button>
      </header>
      <div className="tc-menu-body">
        {tab === "play" && <PlayTab lang={lang} playerId={playerId} sessionId={sessionId} games={game.games} roundActive={!!game.round} onClose={onClose} />}
        {tab === "customize" && <CustomizeTab lang={lang} onSeed={onSeed} />}
        {tab === "leaderboard" && <LeaderboardTab lang={lang} />}
        {tab === "settings" && <SettingsTab lang={lang} setLang={setLang} playerId={playerId} sessionId={sessionId} host={host} />}
      </div>
    </aside>
  );
}

function PlayTab(p: { lang: "en" | "es" | "pt"; playerId: string; sessionId: string; games: Array<{ slug: string; title: LangText }>; roundActive: boolean; onClose: () => void }): JSX.Element {
  const { lang } = p;
  return (
    <>
      <h3 className="tc-menu-h">{t("menu.rounds", lang)}</h3>
      <div className="tc-menu-grid">
        {p.games.map((g) => (
          <button
            key={g.slug}
            type="button"
            className="tc-menu-btn tc-menu-btn--accent"
            data-testid={`menu-play-${g.slug}`}
            onClick={() => {
              startRound(g.slug, { playerId: p.playerId, sessionId: p.sessionId, role: "scout" });
              p.onClose();
            }}
          >
            {"▶"} {g.title[lang]}
          </button>
        ))}
        {p.roundActive && (
          <button type="button" className="tc-menu-btn" data-testid="menu-stop" onClick={() => endRound("stopped")}>
            {t("hud.stop", lang)}
          </button>
        )}
      </div>
      <h3 className="tc-menu-h">{t("hud.play", lang)}</h3>
      <div className="tc-menu-grid">
        <button type="button" className="tc-menu-btn" data-testid="menu-jump" onClick={() => { getWorld()?.jump(); p.onClose(); }}>
          {t("menu.jump", lang)}
        </button>
        <button type="button" className="tc-menu-btn" data-testid="menu-wave" onClick={() => { getWorld()?.wave(); p.onClose(); }}>
          {t("menu.wave", lang)}
        </button>
      </div>
      <h3 className="tc-menu-h">{t("menu.teleport", lang)}</h3>
      <div className="tc-menu-grid">
        {AREAS.map((a) => (
          <button key={a} type="button" className="tc-menu-btn" data-testid={`menu-go-${a}`} onClick={() => { getWorld()?.teleport(landmark(a)); p.onClose(); }}>
            {t(`menu.area.${a}`, lang)}
          </button>
        ))}
      </div>
    </>
  );
}

function Swatches({ seed, lang }: { seed: number; lang: "en" | "es" | "pt" }): JSX.Element {
  const c = avatarColors(generate(seed));
  const items: Array<[string, number]> = [["menu.skin", c.skin], ["menu.hair", c.hair], ["menu.eyes", c.eyes], ["menu.outfit", c.outfit]];
  return (
    <span className="tc-menu-swatches">
      {items.map(([k, v]) => (
        <span key={k} className="tc-menu-swatch" title={t(k, lang)} style={{ background: hex(v) }} />
      ))}
    </span>
  );
}

function CustomizeTab({ lang, onSeed }: { lang: "en" | "es" | "pt"; onSeed?: (seed: number) => void }): JSX.Element {
  const [seed, setSeedState] = useState<number>(() => Number(storage()?.getItem(SEED_KEY) ?? 4242) || 4242);
  const [salt, setSalt] = useState(1);
  const picks = useMemo(() => Array.from({ length: 5 }, (_, i) => ((seed * 31 + i * 7919 + salt * 104729) % 1_000_000) || 1), [seed, salt]);
  const apply = (s: number) => {
    setSeedState(s);
    try { storage()?.setItem(SEED_KEY, String(s)); } catch { /* ignore */ }
    getWorld()?.setSeed(s);
    const me = getRows().find((r) => r.self);
    if (me) setSelf({ playerId: me.playerId, seed: s, level: me.level });
    onSeed?.(s);
  };
  return (
    <>
      <h3 className="tc-menu-h">{t("menu.look", lang)}</h3>
      <div className="tc-menu-row">
        <Swatches seed={seed} lang={lang} />
        <span className="tc-menu-muted">#{seed}</span>
      </div>
      <div className="tc-menu-grid">
        <button type="button" className="tc-menu-btn tc-menu-btn--accent" data-testid="menu-reroll" onClick={() => { apply(Math.floor(Math.random() * 1_000_000)); setSalt((s) => s + 1); }}>
          {t("menu.reroll", lang)}
        </button>
      </div>
      <h3 className="tc-menu-h">{t("menu.picks", lang)}</h3>
      <ul className="tc-menu-list">
        {picks.map((s) => (
          <li key={s} className="tc-menu-row">
            <Swatches seed={s} lang={lang} />
            <button type="button" className="tc-menu-btn tc-menu-btn--small" onClick={() => apply(s)}>{t("menu.wear", lang)}</button>
          </li>
        ))}
      </ul>
    </>
  );
}

function LeaderboardTab({ lang }: { lang: "en" | "es" | "pt" }): JSX.Element {
  const [rows, setRows] = useState<LeaderRow[]>(() => getRows());
  useEffect(() => {
    const unsub = subscribeLeaderboard(setRows);
    const iv = setInterval(() => setRows(getRows()), 2000);
    return () => { unsub(); clearInterval(iv); };
  }, []);
  const team = rows.reduce((s, r) => s + r.score, 0);
  return (
    <>
      <div className="tc-menu-row tc-menu-row--team">
        <span>{t("menu.team", lang)}</span>
        <strong data-testid="menu-team">{team}</strong>
      </div>
      <ol className="tc-menu-board" data-testid="menu-board">
        {rows.map((r, i) => (
          <li key={r.playerId} className={`tc-menu-board-row${r.self ? " is-self" : ""}`}>
            <span className="tc-menu-rank">{i + 1}</span>
            <span className="tc-menu-nick">{r.nick}{r.self ? ` (${t("menu.you", lang)})` : ""}</span>
            <span className="tc-menu-lvl">{t("hud.level", lang)} {r.level}</span>
            <span className="tc-menu-score">{r.score}</span>
          </li>
        ))}
      </ol>
      {rows.length <= 1 && <p className="tc-menu-muted">{t("menu.empty", lang)}</p>}
    </>
  );
}

function SettingsTab(p: { lang: "en" | "es" | "pt"; setLang: (l: "en" | "es" | "pt") => void; playerId: string; sessionId: string; host?: boolean }): JSX.Element {
  const { lang } = p;
  const [quality, setQuality] = useState<string>(() => storage()?.getItem(QUALITY_KEY) ?? "auto");
  const [server, setServer] = useState<string>(() => storage()?.getItem(WS_KEY) ?? "");
  const [progress, setProgress] = useState(() => getProgress());
  const [busy, setBusy] = useState(false);
  useEffect(() => subscribeProgress((v) => setProgress(v)), []);
  const transport = getTransport();
  const reload = () => window.location.reload();
  const pickQuality = (q: string) => {
    setQuality(q);
    try { q === "auto" ? storage()?.removeItem(QUALITY_KEY) : storage()?.setItem(QUALITY_KEY, q); } catch { /* ignore */ }
    reload();
  };
  const connect = (url: string) => {
    try { url ? storage()?.setItem(WS_KEY, url) : storage()?.removeItem(WS_KEY); } catch { /* ignore */ }
    const u = new URL(window.location.href);
    u.searchParams.delete("ws");
    window.history.replaceState(null, "", u.toString());
    reload();
  };
  const wrap = async () => {
    setBusy(true);
    try {
      const res = await wrapSession(server, p.sessionId);
      showHudToast(langText("menu.wrap.done", { n: String(res.pushed) }));
    } catch (e) {
      showHudToast(langText("menu.wrap.fail", { m: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <h3 className="tc-menu-h">{t("menu.language", lang)}</h3>
      <div className="tc-menu-grid">
        {(["en", "es", "pt"] as const).map((l) => (
          <button key={l} type="button" className={`tc-menu-btn${lang === l ? " is-active" : ""}`} aria-pressed={lang === l} onClick={() => p.setLang(l)}>
            {t(`hud.lang.${l}`, lang)}
          </button>
        ))}
      </div>
      <h3 className="tc-menu-h">{t("menu.quality", lang)}</h3>
      <div className="tc-menu-grid">
        {["auto", "high", "low"].map((q) => (
          <button key={q} type="button" className={`tc-menu-btn${quality === q ? " is-active" : ""}`} aria-pressed={quality === q} onClick={() => pickQuality(q)}>
            {t(`menu.quality.${q}`, lang)}
          </button>
        ))}
      </div>
      <p className="tc-menu-muted">{t("menu.reload", lang)}</p>
      <h3 className="tc-menu-h">{t("menu.server", lang)}</h3>
      <div className="tc-menu-row">
        <input
          className="tc-menu-input"
          data-testid="menu-server-url"
          value={server}
          placeholder={t("menu.server.hint", lang)}
          onChange={(e) => setServer(e.target.value)}
          spellCheck={false}
        />
      </div>
      <div className="tc-menu-grid">
        <button type="button" className="tc-menu-btn tc-menu-btn--accent" onClick={() => connect(server.trim())}>{t("menu.server.connect", lang)}</button>
        <button type="button" className="tc-menu-btn" onClick={() => connect("")}>{t("menu.server.solo", lang)}</button>
      </div>
      <dl className="tc-menu-dl">
        <dt>{t("menu.transport", lang)}</dt>
        <dd data-testid="menu-transport">{t(`menu.transport.${transport}`, lang)}</dd>
        <dt>{t("menu.player", lang)}</dt>
        <dd className="tc-menu-mono">{p.playerId}</dd>
        <dt>{t("menu.session", lang)}</dt>
        <dd className="tc-menu-mono">{p.sessionId}</dd>
        <dt>{t("hud.level", lang)}</dt>
        <dd>{progress.level} &middot; {t("hud.xp", lang)} {progress.into}/{progress.need}</dd>
      </dl>
      {p.host && (
        <button type="button" className="tc-menu-btn tc-menu-btn--accent" data-testid="menu-wrap" disabled={busy} onClick={wrap}>
          {t("menu.wrap", lang)}
        </button>
      )}
    </>
  );
}
