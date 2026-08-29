// src/modules/hud/HudRoot.tsx — the visible chrome.
//
// Pure presentation: receives the resolved labels and the current state
// from the api, and renders the top bar + collapse toggle. The collapsed
// state shows exactly one button (STANDARDS §6.1).
import type { ReactNode } from "react";
import type { HudLang } from "./api";

export interface HudLabels {
  title: string;
  collapse: string;
  expand: string;
  score: string;
  role: string;
  level: string;
  level_num?: string;
  items: string;
  notifications: string;
  avatar: string;
  leaderboard: string;
  langLabel: string;
  langEn: string;
  langEs: string;
  langPt: string;
}

interface HudRootProps {
  lang: HudLang;
  collapsed: boolean;
  labels: HudLabels;
  onToggleCollapsed: () => void;
  onSetLang: (l: HudLang) => void;
  children?: ReactNode;
}

export function HudRoot(props: HudRootProps): JSX.Element {
  const { collapsed, labels, onToggleCollapsed, onSetLang, lang, children } = props;

  return (
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
            </span>
            <span className="tc-hud-row" data-testid="hud-row-role">
              <span className="tc-hud-key">{labels.role}</span>
            </span>
            <span className="tc-hud-row" data-testid="hud-row-level">
              <span className="tc-hud-key">{labels.level}</span>
            </span>
            <span className="tc-hud-row" data-testid="hud-row-items">
              <span className="tc-hud-key">{labels.items}</span>
            </span>
            <span className="tc-hud-row" data-testid="hud-row-notifications">
              <span className="tc-hud-key">{labels.notifications}</span>
            </span>
            <span className="tc-hud-row" data-testid="hud-row-avatar">
              <span className="tc-hud-key">{labels.avatar}</span>
            </span>
            <span className="tc-hud-row" data-testid="hud-row-leaderboard">
              <span className="tc-hud-key">{labels.leaderboard}</span>
            </span>
          </nav>
        )}

        <div className="tc-hud-actions">
          {!collapsed && (
            <div
              className="tc-hud-lang"
              role="group"
              aria-label={labels.langLabel}
              data-testid="hud-lang"
            >
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

      {!collapsed && children ? <div className="tc-hud-children">{children}</div> : null}
    </header>
  );
}
