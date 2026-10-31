"use client";

import { useEffect, useState } from "react";
import Image from "@/components/ui/AppImage";

const COLORS: Record<string, string> = {
  openai: "currentColor",
  claude: "#d97757",
  deepseek: "#4d6bfe",
  qwen: "#615ced",
  moonshot: "#007aff",
  grok: "#555",
  zai: "#3859ff",
  minimax: "#ef4565",
  xiaomimimo: "#ff6900",
};

const ICONS = [
  "openai",
  "claude",
  "gemini",
  "deepseek",
  "qwen",
  "moonshot",
  "grok",
  "zai",
  "minimax",
  "doubao",
  "xiaomimimo",
];
// Keep the center clear for copy. Jitter is bounded within these perimeter slots.
const SLOTS = [
  [16, 6],
  [48, 6],
  [80, 6],
  [4, 24],
  [96, 24],
  [4, 46],
  [96, 46],
  [4, 72],
  [96, 72],
  [24, 97],
  [76, 97],
];

export function AuthModelBackdrop() {
  const [placements, setPlacements] = useState<
    { icon: string; x: number; y: number; angle: number; size: number }[]
  >([]);
  useEffect(() => {
    const shuffled = [...ICONS];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
    }
    setPlacements(
      SLOTS.map(([x, y], index) => ({
        icon: shuffled[index],
        x: x + (Math.random() - 0.5) * 2,
        y: y + (Math.random() - 0.5) * 4,
        angle: (Math.random() - 0.5) * 44,
        size: 24 + Math.round(Math.random() * 12),
      })),
    );
  }, []);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 select-none overflow-hidden"
    >
      {placements.map(({ icon, x, y, angle, size }) => (
        <div
          key={icon}
          className="absolute text-gray-950 opacity-60 dark:text-white dark:opacity-70"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            transform: `translate(-50%, -50%) rotate(${angle}deg)`,
          }}
        >
          {icon === "gemini" || icon === "doubao" ? (
            <Image
              alt=""
              src={`/images/model-icons/${icon}-color.svg`}
              width={size}
              height={size}
            />
          ) : (
            <span
              className="block"
              style={{
                width: size,
                height: size,
                backgroundColor: COLORS[icon],
                mask: `url(/images/model-icons/${icon}.svg) center / contain no-repeat`,
                WebkitMask: `url(/images/model-icons/${icon}.svg) center / contain no-repeat`,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
