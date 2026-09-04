// src/modules/presence/PresenceOverlay.tsx — dev-only HUD strip.
//
// Renders one chip per remote player. Self is filtered. Collapses to a
// title-only header when no remotes are present. Uses i18n for the
// title and role labels (STANDARDS §7). Dev-only by design; mounted
// behind `import.meta.env.DEV` in App.tsx.
import { useEffect, useState } from "react";
import { t } from "../i18n/api";
import { getPresenceMap, startPresence, subscribePresence, type PresenceEvent, type RemoteState } from "./api";
import "./presence.css";

export interface PresenceOverlayProps {
  /** The local player's id; updates for this id are not rendered. */
  selfId?: string;
}

interface RemoteView {
  state: RemoteState;
}

export function PresenceOverlay({ selfId = "self" }: PresenceOverlayProps): JSX.Element {
  // Always call startPresence — it's idempotent. The dev seam is installed
  // the first time this runs in dev; the bridge subscription is shared.
  useEffect(() => {
    startPresence({ selfId });
  }, [selfId]);

  const [remotes, setRemotes] = useState<RemoteView[]>([]);
  const [lang] = useLang();

  useEffect(() => {
    const map = getPresenceMap();
    const sync = () => {
      const list: RemoteView[] = [];
      for (const id of map.ids()) {
        if (id === selfId) continue;
        const state = map.get(id);
        if (state) list.push({ state });
      }
      setRemotes(list);
    };
    sync();
    const offChange = map.onShapeChange(sync);
    const offEvt = subscribePresence((evt: PresenceEvent) => {
      if (evt.playerId === selfId) return;
      sync();
    });
    return () => {
      offChange();
      offEvt();
    };
  }, [selfId]);

  const title = t("presence.title", lang);

  return (
    <div className="tc-presence" data-testid="presence-overlay" data-count={remotes.length}>
      <div className="tc-presence-title" data-testid="presence-title">{title}</div>
      {remotes.length > 0 && (
        <ul className="tc-presence-chips" aria-label={title}>
          {remotes.map(({ state }) => (
            <li
              key={state.playerId}
              className="tc-presence-chip"
              data-testid="presence-chip"
              data-player={state.playerId}
            >
              <span className="tc-presence-chip-id">{state.playerId}</span>
              <span className="tc-presence-chip-role">
                {t(`presence.role.${state.role}`, lang)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Local hook so the overlay doesn't pull in the full Hud context. The
// detection is cheap and avoids coupling this dev overlay to the HUD tree.
import { detectLang, type Lang } from "../i18n/api";
function useLang(): [Lang] {
  const [lang, setLang] = useState<Lang>(() => detectLang(
    typeof navigator !== "undefined" ? navigator.language : undefined
  ));
  useEffect(() => {
    if (typeof document !== "undefined") {
      // Re-read if the user toggles in another tab.
      const cur = document.documentElement.lang;
      if (cur === "en" || cur === "es" || cur === "pt") setLang(cur);
    }
  });
  return [lang];
}
