// src/modules/world3d/internal/input.ts — keyboard + touch joystick.
export interface MoveInput { x: number; y: number }

export class InputState {
  private keys = new Set<string>();
  private joy: MoveInput = { x: 0, y: 0 };
  private joyActive = false;
  private jump = false;
  private emote = false;
  private el: HTMLElement | null = null;
  private joyEl: HTMLElement | null = null;
  private knobEl: HTMLElement | null = null;
  private jumpEl: HTMLElement | null = null;
  private onAny: (() => void) | null = null;
  private lastInputAt = 0;
  private readonly cleanup: Array<() => void> = [];

  attach(target: HTMLElement, opts: { joystick?: HTMLElement | null; knob?: HTMLElement | null; jumpButton?: HTMLElement | null; onAny?: () => void } = {}): void {
    this.el = target;
    this.joyEl = opts.joystick ?? null;
    this.knobEl = opts.knob ?? null;
    this.jumpEl = opts.jumpButton ?? null;
    this.onAny = opts.onAny ?? null;
    const touch = () => {
      this.lastInputAt = performance.now();
      this.onAny?.();
    };

    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
      if (k === " " && !this.keys.has(k)) this.jump = true;
      if (k === "e" && !this.keys.has(k)) this.emote = true;
      this.keys.add(k);
      touch();
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    const blur = () => this.keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    this.cleanup.push(() => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    });

    if (this.joyEl) {
      const joy = this.joyEl;
      let pid: number | null = null;
      const R = 42;
      const move = (e: PointerEvent) => {
        if (pid !== e.pointerId) return;
        const rect = joy.getBoundingClientRect();
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        let dx = e.clientX - cx, dy = e.clientY - cy;
        const m = Math.hypot(dx, dy);
        if (m > R) { dx *= R / m; dy *= R / m; }
        this.joy = { x: dx / R, y: -dy / R };
        if (this.knobEl) this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
        touch();
      };
      const start = (e: PointerEvent) => {
        pid = e.pointerId;
        this.joyActive = true;
        joy.setPointerCapture(e.pointerId);
        move(e);
      };
      const end = (e: PointerEvent) => {
        if (pid !== e.pointerId) return;
        pid = null;
        this.joyActive = false;
        this.joy = { x: 0, y: 0 };
        if (this.knobEl) this.knobEl.style.transform = "translate(0px, 0px)";
      };
      joy.addEventListener("pointerdown", start);
      joy.addEventListener("pointermove", move);
      joy.addEventListener("pointerup", end);
      joy.addEventListener("pointercancel", end);
      this.cleanup.push(() => {
        joy.removeEventListener("pointerdown", start);
        joy.removeEventListener("pointermove", move);
        joy.removeEventListener("pointerup", end);
        joy.removeEventListener("pointercancel", end);
      });
    }
    if (this.jumpEl) {
      const j = this.jumpEl;
      const tap = (e: Event) => { e.preventDefault(); this.jump = true; touch(); };
      j.addEventListener("pointerdown", tap);
      this.cleanup.push(() => j.removeEventListener("pointerdown", tap));
    }
  }

  detach(): void {
    for (const c of this.cleanup) c();
    this.cleanup.length = 0;
    this.keys.clear();
  }

  /** x = right, y = forward, each in [-1, 1]; the joystick wins while active. */
  getMove(): MoveInput {
    if (this.joyActive) return this.joy;
    let x = 0, y = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) y += 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y -= 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    const m = Math.hypot(x, y);
    return m > 1 ? { x: x / m, y: y / m } : { x, y };
  }

  consumeJump(): boolean {
    const j = this.jump;
    this.jump = false;
    return j;
  }

  consumeEmote(): boolean {
    const e = this.emote;
    this.emote = false;
    return e;
  }

  get idleMs(): number {
    return this.lastInputAt ? performance.now() - this.lastInputAt : Infinity;
  }

  /** Test seam: inject a move vector for one frame (used by e2e). */
  inject(move: MoveInput | null): void {
    if (move) { this.joy = move; this.joyActive = true; } else { this.joy = { x: 0, y: 0 }; this.joyActive = false; }
  }
}
