// src/modules/world3d/WorldCanvas.tsx — mounts the Three.js world.
// Full-window canvas + touch joystick + jump button + a control hint that
// fades after 5 s of input (STANDARDS §6.2). Falls back to a localized note
// when WebGL is unavailable (jsdom, very old browsers).
import { useEffect, useRef, useState } from "react";
import { t } from "../i18n/api";
import { World, type Quality } from "./internal/world";
import { setCurrentWorld } from "./internal/registry";

export interface WorldCanvasProps {
  /** Avatar seed for the local player. */
  seed?: number;
  quality?: Quality;
}

const HINT_MS = 5000;

export function WorldCanvas({ seed = 4242, quality = "high" }: WorldCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const joyRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const jumpRef = useRef<HTMLButtonElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let world: World | null = null;
    let hintTimer: ReturnType<typeof setTimeout> | null = null;
    const bumpHint = () => {
      if (hintTimer) clearTimeout(hintTimer);
      hintTimer = setTimeout(() => setHintVisible(false), HINT_MS);
    };
    try {
      world = new World(canvas, {
        seed,
        quality,
        joystick: joyRef.current,
        knob: knobRef.current,
        jumpButton: jumpRef.current,
        onInput: bumpHint,
      });
      setCurrentWorld(world);
      if (import.meta.env.DEV) (window as unknown as { __tcWorld?: World }).__tcWorld = world; // dev/e2e seam
      world.start();
      setReady(true);
      bumpHint();
    } catch (err) {
      console.warn("[world3d] WebGL unavailable:", err);
      setFailed(true);
      return;
    }
    const onResize = () => world?.resize();
    window.addEventListener("resize", onResize);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    ro?.observe(canvas);
    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      if (hintTimer) clearTimeout(hintTimer);
      world?.stop();
      setCurrentWorld(null);
    };
    // The world is built once; seed changes go through getWorld().setSeed().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="tc-world" data-testid="world-canvas" data-ready={ready ? "1" : "0"}>
      <canvas ref={canvasRef} className="tc-world-canvas" aria-label={t("world.title")} />
      {failed && (
        <div className="tc-world-loading" data-testid="world-nogl">
          {t("world.nogl")}
        </div>
      )}
      <div className={`tc-world-hint${hintVisible ? "" : " is-hidden"}`} data-testid="world-hint">
        {t("world.hint")}
      </div>
      <div ref={joyRef} className="tc-joystick" data-testid="world-joystick" aria-label={t("world.move")}>
        <div ref={knobRef} className="tc-joystick-knob" />
      </div>
      <button ref={jumpRef} type="button" className="tc-jump" data-testid="world-jump" aria-label={t("world.jump")}>
        {"↑"}
      </button>
    </div>
  );
}
