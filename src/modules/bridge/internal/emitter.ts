// Private to the bridge module. The api.ts file is the only public door.
// A tiny in-memory pub/sub. Task 0004 swaps this stub for Supabase Realtime;
// the api surface and all callers stay unchanged (AGENTS §13).

export type Unsubscribe = () => void;

export class Emitter<T> {
  private subs = new Set<(payload: T) => void>();

  subscribe(cb: (payload: T) => void): Unsubscribe {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }

  emit(payload: T): void {
    for (const cb of this.subs) cb(payload);
  }
}
