// src/modules/menu/api.tsx — the ONLY public door to the menu module.
//
//   <Menu />                       render once inside <Hud> (shares its language)
//   openMenu(tab?) / closeMenu() / toggleMenu(tab?) / useMenu()
//   setMenuIdentity({ playerId, sessionId, host })   after joinWorld resolves
//
// The drawer reads the game stores directly (HUD game state, leaderboard,
// progress, world, bridge) so the app shell only mounts it.
import { useSyncExternalStore } from "react";
import { Menu as MenuView } from "./Menu";
import "./menu.css";

export type MenuTab = "play" | "customize" | "leaderboard" | "settings";

export interface MenuIdentity {
  /** Current player id (server-assigned online, local otherwise). */
  playerId: string;
  /** Session id for round envelopes / LTI wrap. */
  sessionId: string;
  /** The launch marked this player as a host (LTI instructor). */
  host: boolean;
}

interface MenuState {
  open: boolean;
  tab: MenuTab;
  identity: MenuIdentity;
}

let state: MenuState = { open: false, tab: "play", identity: { playerId: "local", sessionId: "solo", host: false } };
const listeners = new Set<() => void>();

function set(next: Partial<MenuState>): void {
  state = { ...state, ...next };
  for (const l of listeners) l();
}
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function openMenu(tab?: MenuTab): void {
  set({ open: true, tab: tab ?? state.tab });
}
export function closeMenu(): void {
  set({ open: false });
}
export function toggleMenu(tab?: MenuTab): void {
  if (state.open && (!tab || tab === state.tab)) set({ open: false });
  else set({ open: true, tab: tab ?? state.tab });
}
export function setMenuTab(tab: MenuTab): void {
  set({ tab });
}
export function setMenuIdentity(patch: Partial<MenuIdentity>): void {
  set({ identity: { ...state.identity, ...patch } });
}
export function getMenuState(): MenuState {
  return state;
}
export function useMenu(): MenuState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export interface MenuProps {
  /** Called when the player picks a new look (the shell persists the seed). */
  onSeed?: (seed: number) => void;
}

export function Menu(props: MenuProps): JSX.Element | null {
  const s = useMenu();
  if (!s.open) return null;
  return <MenuView tab={s.tab} onTab={setMenuTab} onClose={closeMenu} playerId={s.identity.playerId} sessionId={s.identity.sessionId} host={s.identity.host} onSeed={props.onSeed} />;
}
