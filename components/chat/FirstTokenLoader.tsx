"use client";

import { useEffect, useState } from "react";

type LoaderMode = "bounce" | "orbit";

export function FirstTokenLoader() {
  const [mode, setMode] = useState<LoaderMode>("bounce");

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMode((current) => (current === "bounce" ? "orbit" : "bounce"));
    }, 4400);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      aria-label="模型正在生成回复"
      className="flex h-8 w-10 items-center justify-center"
      role="status"
    >
      <span
        aria-hidden="true"
        className={`first-token-loader first-token-loader-${mode}`}
        key={mode}
      >
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
