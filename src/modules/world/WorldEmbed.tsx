import { useEffect, useRef, useState } from "react";
import { t } from "../i18n/api";
import { joinWorld, mountBridge } from "../bridge/api";

const UNITY_BUILD_PATH = "/unity/Build/index.html";

export function WorldEmbed() {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Install the Unity-facing bridge on the parent window once.
    mountBridge(window);
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
        src={UNITY_BUILD_PATH}
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
