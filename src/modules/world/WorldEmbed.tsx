import { useEffect, useRef, useState } from "react";
import { t } from "../i18n/api";
import { joinWorld, mountBridge } from "../bridge/api";

const UNITY_BUILD_PATH = "/unity/Build/index.html";
const PLACEHOLDER_PATH = "/unity/placeholder.html";

/**
 * Resolve which embed to load: the real Unity WebGL build if present (HEAD ok),
 * else the static placeholder fallback. The placeholder is committed and works
 * with no Unity installed (e.g. CI); the real build is produced by `pnpm dev:unity`
 * (task 0003+) and is gitignored.
 */
async function resolveEmbedSrc(): Promise<string> {
  try {
    const res = await fetch(UNITY_BUILD_PATH, { method: "HEAD" });
    return res.ok ? UNITY_BUILD_PATH : PLACEHOLDER_PATH;
  } catch {
    return PLACEHOLDER_PATH;
  }
}

export function WorldEmbed() {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [src, setSrc] = useState<string>(PLACEHOLDER_PATH);

  useEffect(() => {
    // Install the Unity-facing bridge on the parent window once.
    mountBridge(window);
    resolveEmbedSrc().then(setSrc);
  }, []);

  async function handleLoad() {
    setLoaded(true);
    // Prove the pipe: join the world on embed load.
    await joinWorld();
  }

  return (
    <div className="tc-world" data-testid="world-embed">
      <iframe
        ref={frameRef}
        src={src}
        title={t("world.title")}
        className="tc-world-iframe"
        allow="autoplay; fullscreen; gamepad"
        onLoad={handleLoad}
      />
      {!loaded && (
        <div className="tc-world-loading" data-testid="world-loading">
          {t("world.loading")}
        </div>
      )}
    </div>
  );
}
