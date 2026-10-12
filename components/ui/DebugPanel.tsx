"use client";

import { Leva } from "leva";

/** Leva debug controls, shown in development only. */
export default function DebugPanel() {
  return (
    <div className="absolute right-[23.5rem] top-16 z-30 w-64">
      <Leva fill collapsed hidden={process.env.NODE_ENV === "production"} titleBar={{ title: "Debug" }} />
    </div>
  );
}
