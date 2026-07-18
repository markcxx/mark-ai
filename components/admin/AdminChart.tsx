"use client";

import type { EChartsOption } from "echarts";
import type { EChartsType } from "echarts/core";
import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

export function AdminChart({
  height = 260,
  mobileHeight,
  option,
}: {
  height?: number;
  mobileHeight?: number;
  option: EChartsOption;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  useEffect(() => {
    if (!containerRef.current) return;
    let active = true;
    let observer: ResizeObserver | undefined;
    setLoading(true);
    setFailed(false);

    void import("@/lib/visualization/echarts-client")
      .then(({ echarts }) => {
        if (!active || !containerRef.current) return;
        const chart = echarts.init(containerRef.current, dark ? "dark" : undefined, {
          renderer: "canvas",
        });
        chartRef.current = chart;
        chart.setOption(
          {
            ...option,
            animationDuration: 500,
            aria: { enabled: true },
            backgroundColor: "transparent",
            textStyle: { fontFamily: "inherit" },
          },
          { notMerge: true },
        );
        observer = new ResizeObserver(() => chart.resize());
        observer.observe(containerRef.current);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
        setLoading(false);
      });

    return () => {
      active = false;
      observer?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, [dark, option]);

  return (
    <div
      className="relative h-[var(--admin-chart-mobile-height)] w-full sm:h-[var(--admin-chart-height)]"
      style={
        {
          "--admin-chart-height": `${height}px`,
          "--admin-chart-mobile-height": `${mobileHeight || Math.min(height, 280)}px`,
        } as CSSProperties
      }
    >
      <div className="h-full w-full" ref={containerRef} />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-gray-400 dark:bg-[var(--chat-input-bg)]/70">
          <Loader2 className="animate-spin" size={18} />
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
          图表加载失败
        </div>
      )}
    </div>
  );
}
