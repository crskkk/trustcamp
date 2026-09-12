// src/modules/hud/HudRoot.tsx — the visible chrome.
//
// Pure presentation: receives the resolved labels, the game store snapshot
// and the current state from the api, and renders the top bar + collapse
// toggle, the play bar, the active-round panel and the toast. The collapsed
// state shows exactly one button (STANDARDS §6.1). The planet ("children") is
// a full-window layer behind the bar and stays mounted in both states.
import type { ReactNode } from "react";
import type { HudGameState, HudLang } from "./api";

export interface HudLabels {
  title: string;
  collapse: string;
  expand: string;
  score: string;
  role: string;
  level: string;
  items: string;
  notifications: string;
  avatar: string;
  leaderboard: string;
  langLabel: string;
  langEn: string;
  langEs: string;
  langPt: string;
  play: string;
  stop: string;
  time: string;
  points: string;
  xp: string;
  team: string;
  menu: string;
}

interface HudRootProps {
  lang: HudLang;
  collapsed: boolean;
  labels: HudLabels;
  game: HudGameState;
  onToggleCollapsed: () => void;
  onSetLang: (l: HudLang) => void;
  onAction?: (slug: string) => void;
  onStop?: () => void;
  onMenu?: (tab?: "play" | "customize" | "leaderboard" | "settings") => void;
  children?: ReactNode;
}

function clock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function HudRoot(props: HudRootProps): JSX.Element {
  const { collapsed, labels, onToggleCollapsed, onSetLang, lang, children, game, onAction, onStop, onMenu } = props;
  const xpPct = game.xpNeed > 0 ? Math.min(100, Math.round((game.xpInto / game.xpNeed) * 100)) : 0;
  const round = game.round;

  return (
    <>
      {children ? (
        <div className={`tc-hud-stage${collapsed ? " tc-hud-stage--collapsed" : ""}`} data-testid="hud-stage">
          {children}
        </div>
      ) : null}

      <header
        className={`tc-hud${collapsed ? " tc-hud--collapsed" : ""}`}
        data-testid="hud-root"
        data-lang={lang}
        aria-label={labels.title}
      >
        <div className="tc-hud-bar">
          <span className="tc-hud-title" data-testid="hud-title">{labels.title}</span>

          {!collapsed && (
            <nav className="tc-hud-rows" aria-label={labels.title}>
              <span className="tc-hud-row" data-testid="hud-row-score">
                <span className="tc-hud-key">{labels.score}</span>
                <span className="tc-hud-value" data-testid="hud-score-value">{game.score}</span>
              </span>
              <span className="tc-hud-row" data-testid="hud-row-role">
                <span className="tc-hud-key">{labels.role}</span>
              </span>
              <span className="tc-hud-row tc-hud-row--level" data-testid="hud-row-level" title={`${labels.xp} ${game.xpInto}/${game.xpNeed}`}>
                <span className="tc-hud-key">{labels.level}</span>
                <span className="tc-hud-value" data-testid="hud-level-value">{game.level}</span>
                <span className="tc-hud-xp" aria-hidden="true">
                  <span className="tc-hud-xp-fill" style={{ width: `${xpPct}%` }} />
                </span>
              </span>
              <span className="tc-hud-row" data-testid="hud-row-items">
                <span className="tc-hud-key">{labels.items}</span>
              </span>
              <span className="tc-hud-row" data-testid="hud-row-notifications">
                <span className="tc-hud-key">{labels.notifications}</span>
              </span>
              <span className="tc-hud-row tc-hud-row--link" data-testid="hud-row-avatar" role="link" tabIndex={0} onClick={() => onMenu?.("customize")} onKeyDown={(e) => e.key === "Enter" && onMenu?.("customize")}>
                <span className="tc-hud-key">{labels.avatar}</span>
              </span>
              <span className="tc-hud-row tc-hud-row--link" data-testid="hud-row-leaderboard" role="link" tabIndex={0} onClick={() => onMenu?.("leaderboard")} onKeyDown={(e) => e.key === "Enter" && onMenu?.("leaderboard")}>
                <span className="tc-hud-key">{labels.leaderboard}</span>
              </span>
            </nav>
          )}

          <div className="tc-hud-actions">
            {!collapsed && onMenu && (
              <button type="button" className="tc-hud-menu" data-testid="hud-menu" aria-label={labels.menu} onClick={() => onMenu()}>
                {"☰"} {labels.menu}
              </button>
            )}
            {!collapsed && (
              <div className="tc-hud-lang" role="group" aria-label={labels.langLabel} data-testid="hud-lang">
                {(["en", "es", "pt"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    className={`tc-hud-lang-btn${lang === l ? " is-active" : ""}`}
                    aria-pressed={lang === l}
                    aria-label={l === "en" ? labels.langEn : l === "es" ? labels.langEs : labels.langPt}
                    onClick={() => onSetLang(l)}
                    data-testid={`hud-lang-${l}`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              className="tc-hud-toggle"
              aria-label={collapsed ? labels.expand : labels.collapse}
              aria-expanded={!collapsed}
              onClick={onToggleCollapsed}
              data-testid="hud-toggle"
            >
              {collapsed ? "≡" : "✕"}
            </button>
          </div>
        </div>

        {!collapsed && game.games.length > 0 && !round && (
          <div className="tc-hud-play" data-testid="hud-play">
            <span className="tc-hud-play-label">{labels.play}</span>
            {game.games.map((g) => (
              <button
                key={g.slug}
                type="button"
                className="tc-hud-play-btn"
                data-testid={`hud-play-${g.slug}`}
                onClick={() => onAction?.(g.slug)}
              >
                {"▶"} {g.title[lang]}
              </button>
            ))}
          </div>
        )}
      </header>

      {round && (
        <section className="tc-round" data-testid="hud-round" aria-live="polite">
          <div className="tc-round-title">{round.title[lang]}</div>
          <div className="tc-round-grid">
            <span className="tc-round-key">{labels.time}</span>
            <span className={`tc-round-time${round.timeLeft <= 10 ? " is-low" : ""}`} data-testid="hud-round-time">{clock(round.timeLeft)}</span>
            <span className="tc-round-key">{round.label ? round.label[lang] : labels.points}</span>
            <span className="tc-round-progress" data-testid="hud-round-progress">
              {round.total > 0 ? `${round.current} / ${round.total}` : round.points}
            </span>
            <span className="tc-round-key">{labels.points}</span>
            <span className="tc-round-points" data-testid="hud-round-points">{round.points}</span>
            <span className="tc-round-key">{labels.team}</span>
            <span className="tc-round-team" data-testid="hud-round-team">{game.teamScore}</span>
          </div>
          {!collapsed && (
            <button type="button" className="tc-round-stop" data-testid="hud-stop" onClick={() => onStop?.()}>
              {labels.stop}
            </button>
          )}
        </section>
      )}

      {game.toast && (
        <div className="tc-toast" data-testid="hud-toast" key={game.toast.id} role="status">
          {game.toast.text[lang]}
        </div>
      )}
    </>
  );
}
