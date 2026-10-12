"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";

/** Small tooltip that follows the pointer and names the hovered object. */
export default function HoverLabel() {
  const hovered = useStore((s) => s.hovered);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "";
  }, [hovered]);

  if (!hovered) return null;
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-md bg-slate-950/90 px-2 py-1 text-xs font-medium text-slate-100 ring-1 ring-sky-400/40"
      style={{ left: pos.x + 14, top: pos.y + 14 }}
    >
      {hovered.label}
    </div>
  );
}
