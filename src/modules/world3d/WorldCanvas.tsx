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

/**
 * Pick a quality tier: `?quality=low|high` wins; otherwise software GL
 * (SwiftShader / llvmpipe — CI, VMs, very old machines) or a small core
 * count drops to "low" (no shadows, coarser terrain, 1x pixel ratio).
 */
export function detectQuality(requested: Quality): Quality {
  try {
    const q = new URLSearchParams(window.location.search).get("quality") ?? window.localStorage.getItem("tc.quality");
    if (q === "low" || q === "high" || q === "software") return q;
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return requested;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) return "software";
    if (navigator.webdriver) return "software"; // automation (Playwright/CI) runs without a real GPU
    if ((navigator.hardwareConcurrency ?? 8) <= 2) return "low";
  } catch {
    /* fall through */
  }
  return requested;
}

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
        quality: detectQuality(quality),
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
