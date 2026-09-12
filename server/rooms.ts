// server/rooms.ts — in-memory world rooms and the 15 Hz state fan-out.
// A member's state is keyed by the server-assigned player id (clients cannot
// speak for anyone else), rate-limited inbound, and batched outbound so N
// players cost N messages per tick, not N².
import { encode, type PlayerState, type ServerMsg } from "./protocol";

export interface SocketLike {
  send(data: string): void;
  readyState?: number;
  close?(code?: number, reason?: string): void;
}

export interface Member {
  id: string;
  room: string;
  socket: SocketLike;
  seed: number;
  nick?: string;
  state: PlayerState | null;
  dirty: boolean;
  inbound: { windowStart: number; count: number };
  /** Messages pushed to this member (debug endpoint / tests). */
  sent: number;
}

export const TICK_MS = 1000 / 15;
const INBOUND_PER_SEC = 40;
const OPEN = 1;

export class Rooms {
  readonly members = new Map<string, Member>();

  join(id: string, socket: SocketLike, room: string, seed: number, nick?: string): Member {
    const existing = this.members.get(id);
    if (existing) {
      // A resumed player replaces their old socket: close it so exactly one
      // live socket per player exists and states never go to a dead one.
      this.members.delete(id);
      if (existing.socket !== socket) {
        try { existing.socket.close?.(4001, "replaced"); } catch { /* ignore */ }
      }
    }
    const m: Member = { id, room, socket, seed, nick, state: existing?.state ?? null, dirty: !!existing?.state, inbound: { windowStart: 0, count: 0 }, sent: 0 };
    this.members.set(id, m);
    return m;
  }

  leave(id: string): void {
    const m = this.members.get(id);
    if (!m) return;
    this.members.delete(id);
    this.broadcast(m.room, { t: "leave", playerId: id }, id);
  }

  /** Accept a state update (rate-limited). Returns false when dropped. */
  updateState(id: string, s: Omit<PlayerState, "playerId">, now = Date.now()): boolean {
    const m = this.members.get(id);
    if (!m) return false;
    if (now - m.inbound.windowStart >= 1000) {
      m.inbound.windowStart = now;
      m.inbound.count = 0;
    }
    if (++m.inbound.count > INBOUND_PER_SEC) return false;
    m.state = { ...s, playerId: id, seed: m.seed, nick: s.nick ?? m.nick, ts: now };
    m.dirty = true;
    return true;
  }

  peersOf(id: string): PlayerState[] {
    const me = this.members.get(id);
    if (!me) return [];
    const out: PlayerState[] = [];
    for (const m of this.members.values()) if (m.id !== id && m.room === me.room && m.state) out.push(m.state);
    return out;
  }

  roomSize(room: string): number {
    let n = 0;
    for (const m of this.members.values()) if (m.room === room) n++;
    return n;
  }

  broadcast(room: string, msg: ServerMsg, exceptId?: string): void {
    const raw = encode(msg);
    for (const m of this.members.values()) {
      if (m.room !== room || m.id === exceptId) continue;
      this.safeSend(m, raw);
    }
  }

  /** One tick: fan out every dirty state to the other members of its room. */
  flush(): number {
    const byRoom = new Map<string, PlayerState[]>();
    for (const m of this.members.values()) {
      if (!m.dirty || !m.state) continue;
      m.dirty = false;
      let arr = byRoom.get(m.room);
      if (!arr) byRoom.set(m.room, (arr = []));
      arr.push(m.state);
    }
    let sent = 0;
    for (const [room, states] of byRoom) {
      for (const m of this.members.values()) {
        if (m.room !== room) continue;
        const ps = states.filter((s) => s.playerId !== m.id);
        if (ps.length === 0) continue;
        this.safeSend(m, encode({ t: "states", ps }));
        sent++;
      }
    }
    return sent;
  }

  private safeSend(m: Member, raw: string): void {
    try {
      if (m.socket.readyState === undefined || m.socket.readyState === OPEN) {
        m.socket.send(raw);
        m.sent++;
      }
    } catch {
      /* socket gone; the close handler cleans up */
    }
  }

  /** Debug snapshot (dev endpoint). */
  snapshot(): Array<{ id: string; room: string; readyState: number | undefined; hasState: boolean; dirty: boolean; sent: number }> {
    return [...this.members.values()].map((m) => ({ id: m.id, room: m.room, readyState: m.socket.readyState, hasState: !!m.state, dirty: m.dirty, sent: m.sent }));
  }
}
