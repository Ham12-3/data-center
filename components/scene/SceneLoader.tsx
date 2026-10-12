"use client";

import dynamic from "next/dynamic";

/**
 * Three.js needs the browser (WebGL, canvas), so the scene is never
 * server-rendered. `ssr: false` is only allowed inside a Client Component.
 */
const Scene = dynamic(() => import("./Scene"), {
  ssr: false,
  // The full-screen LoadingScreen covers this stage.
  loading: () => null,
});

export default function SceneLoader() {
  return (
    <div className="absolute inset-0">
      <Scene />
    </div>
  );
}
