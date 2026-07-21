"use client";

import {
  Check,
  Copy,
  Download,
  GitBranch,
  ImageDown,
  Loader2,
  Maximize2,
  Scan,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import { AppDialog } from "@/components/ui/AppDialog";
import { downloadSvg, downloadSvgAsPng } from "@/lib/visualization/svg-export";

import { ToolPreviewCard, ToolPreviewError, toolPreviewActionClass } from "./ToolPreviewCard";

const MAX_SOURCE_LENGTH = 50_000;
const BLOCKED_SOURCE =
  /%%\s*\{\s*init|^\s*click\s|<\/?(?:script|iframe|object|embed|img|foreignObject)\b|javascript:/im;

const validateSource = (source: string) => {
  const trimmed = source.trim();
  if (!trimmed) return "图表内容为空";
  if (trimmed.length > MAX_SOURCE_LENGTH) return "图表内容不能超过 50,000 个字符";
  if (BLOCKED_SOURCE.test(trimmed)) return "图表包含不允许的指令或嵌入内容";
  return null;
};

type DiagramViewBox = { height: number; width: number; x: number; y: number };
type DiagramView = { base: DiagramViewBox; current: DiagramViewBox; zoom: number };

const clampZoom = (value: number) => Math.min(8, Math.max(0.25, value));

const parseViewBox = (value: string | null): DiagramViewBox | null => {
  const values = value
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (!values || values.length !== 4 || values.some((item) => !Number.isFinite(item))) return null;
  const [x, y, width, height] = values;
  if (width <= 0 || height <= 0) return null;
  return { height, width, x, y };
};

const formatViewBox = ({ height, width, x, y }: DiagramViewBox) => `${x} ${y} ${width} ${height}`;

const DiagramSurface = ({
  className,
  onError,
  source,
  onReady,
}: {
  className: string;
  onError?: () => void;
  source: string;
  onReady?: (svg: SVGSVGElement | null) => void;
}) => {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const renderId = useRef(`markai-mermaid-${Math.random().toString(36).slice(2)}`);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<DiagramView | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const validationError = useMemo(() => validateSource(source), [source]);

  const resetView = useCallback(() => {
    setView((current) =>
      current ? { base: current.base, current: current.base, zoom: 1 } : current,
    );
  }, []);

  const zoomBy = useCallback((factor: number) => {
    setView((viewState) => {
      if (!viewState) return viewState;
      const nextZoom = clampZoom(viewState.zoom * factor);
      const appliedFactor = nextZoom / viewState.zoom;
      if (appliedFactor === 1) return viewState;
      const width = viewState.current.width / appliedFactor;
      const height = viewState.current.height / appliedFactor;
      return {
        ...viewState,
        current: {
          height,
          width,
          x: viewState.current.x + (viewState.current.width - width) / 2,
          y: viewState.current.y + (viewState.current.height - height) / 2,
        },
        zoom: nextZoom,
      };
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      zoomBy(event.deltaY > 0 ? 1 / 1.12 : 1.12);
    };
    viewport.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel, { capture: true });
  }, [zoomBy]);

  useEffect(() => {
    const svg = containerRef.current?.querySelector("svg");
    if (svg && view) svg.setAttribute("viewBox", formatViewBox(view.current));
  }, [view]);

  useEffect(() => {
    let active = true;
    setError(validationError);
    setLoading(!validationError);
    setView(null);
    onReady?.(null);
    if (validationError) return () => undefined;

    void import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          flowchart: { htmlLabels: false },
          maxTextSize: MAX_SOURCE_LENGTH,
          securityLevel: "strict",
          startOnLoad: false,
          suppressErrorRendering: true,
          theme: resolvedTheme === "dark" ? "dark" : "default",
        });
        const result = await mermaid.render(`${renderId.current}-${Date.now()}`, source.trim());
        if (!active || !containerRef.current) return;
        containerRef.current.innerHTML = result.svg;
        const svg = containerRef.current.querySelector("svg");
        if (svg) {
          const baseViewBox = parseViewBox(svg.getAttribute("viewBox"));
          if (!baseViewBox) throw new Error("流程图缺少有效的矢量视图范围");
          const exportViewBox = formatViewBox(baseViewBox);
          svg.dataset.markaiExportViewBox = exportViewBox;
          svg.setAttribute("height", "100%");
          svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
          svg.setAttribute("width", "100%");
          svg.style.height = "100%";
          svg.style.maxWidth = "none";
          svg.style.width = "100%";
          setView({ base: baseViewBox, current: baseViewBox, zoom: 1 });
          onReady?.(svg);
        }
        setLoading(false);
      })
      .catch((reason) => {
        if (!active) return;
        console.error("Mermaid preview render error:", reason);
        setError(reason instanceof Error ? reason.message : "Mermaid 渲染失败");
        setLoading(false);
        onError?.();
      });

    return () => {
      active = false;
      onReady?.(null);
    };
  }, [onError, onReady, resolvedTheme, source, validationError]);

  return (
    <div
      className={`relative overflow-hidden bg-white touch-none dark:bg-[#171717] ${className}`}
      ref={viewportRef}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const bounds = containerRef.current?.getBoundingClientRect();
        if (!bounds?.width || !bounds.height) return;
        const deltaX = event.clientX - drag.x;
        const deltaY = event.clientY - drag.y;
        setView((viewState) =>
          viewState
            ? {
                ...viewState,
                current: {
                  ...viewState.current,
                  x: viewState.current.x - (deltaX * viewState.current.width) / bounds.width,
                  y: viewState.current.y - (deltaY * viewState.current.height) / bounds.height,
                },
              }
            : viewState,
        );
        dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
      }}
    >
      <div className="absolute inset-5 flex items-center justify-center">
        <div className="h-full w-full" ref={containerRef} />
      </div>
      {!error && !loading && (
        <div
          className="absolute bottom-3 right-3 z-10 flex gap-1 rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#191919]/90"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            aria-label="缩小流程图"
            className={toolPreviewActionClass}
            data-markai-tooltip="缩小"
            onClick={() => zoomBy(1 / 1.2)}
            type="button"
          >
            <ZoomOut size={15} />
          </button>
          <button
            aria-label="适应流程图视口"
            className={toolPreviewActionClass}
            data-markai-tooltip="适应视口"
            onClick={resetView}
            type="button"
          >
            <Scan size={15} />
          </button>
          <button
            aria-label="放大流程图"
            className={toolPreviewActionClass}
            data-markai-tooltip="放大"
            onClick={() => zoomBy(1.2)}
            type="button"
          >
            <ZoomIn size={15} />
          </button>
        </div>
      )}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-gray-400 dark:bg-[#171717]/80">
          <Loader2 className="animate-spin" size={21} />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 bg-white dark:bg-[#171717]">
          <ToolPreviewError label="流程图" />
        </div>
      )}
    </div>
  );
};

export function MermaidPreviewBlock({ children }: { children: string }) {
  const { resolvedTheme } = useTheme();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [runtimeError, setRuntimeError] = useState(false);
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const [expandedSvg, setExpandedSvg] = useState<SVGSVGElement | null>(null);
  const title = "Mermaid 流程图";
  const background = resolvedTheme === "dark" ? "#171717" : "#ffffff";
  const validationError = useMemo(() => validateSource(children), [children]);
  const previewError = Boolean(validationError || runtimeError);
  const handleRenderError = useCallback(() => setRuntimeError(true), []);

  useEffect(() => {
    setRuntimeError(false);
    if (validationError) console.warn("Mermaid preview validation error:", validationError);
  }, [children, resolvedTheme, validationError]);

  const copySource = async () => {
    await navigator.clipboard.writeText(children.trim());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const exportPng = async (target: SVGSVGElement | null) => {
    if (!target) return;
    try {
      await downloadSvgAsPng(target, title, background);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PNG 导出失败");
    }
  };

  return (
    <>
      <ToolPreviewCard
        actions={
          <>
            {!previewError && (
              <>
                <button
                  aria-label="放大查看流程图"
                  className={toolPreviewActionClass}
                  data-markai-tooltip="放大查看"
                  disabled={!svg}
                  onClick={() => setExpanded(true)}
                  type="button"
                >
                  <Maximize2 size={15} />
                </button>
                <button
                  aria-label="下载流程图 SVG"
                  className={toolPreviewActionClass}
                  data-markai-tooltip="下载 SVG"
                  disabled={!svg}
                  onClick={() => svg && downloadSvg(svg, title)}
                  type="button"
                >
                  <Download size={15} />
                </button>
                <button
                  aria-label="下载流程图 PNG"
                  className={toolPreviewActionClass}
                  data-markai-tooltip="下载 PNG"
                  disabled={!svg}
                  onClick={() => void exportPng(svg)}
                  type="button"
                >
                  <ImageDown size={15} />
                </button>
              </>
            )}
            <button
              aria-label={copied ? "源码已复制" : "复制流程图源码"}
              className={toolPreviewActionClass}
              data-markai-tooltip={copied ? "已复制" : "复制源码"}
              onClick={() => void copySource()}
              type="button"
            >
              {copied ? <Check className="text-emerald-500" size={15} /> : <Copy size={15} />}
            </button>
          </>
        }
        badge="Mermaid"
        icon={GitBranch}
        title={title}
      >
        {previewError ? (
          <ToolPreviewError label="流程图" />
        ) : (
          <DiagramSurface
            className="h-[340px] sm:h-[380px]"
            onError={handleRenderError}
            onReady={setSvg}
            source={children}
          />
        )}
      </ToolPreviewCard>

      <AppDialog
        bodyClassName="min-h-0 flex-1 overflow-hidden"
        height="min(92dvh, 920px)"
        onClose={() => setExpanded(false)}
        open={expanded}
        panelClassName="overflow-hidden"
        title={title}
        width="min(96vw, 1440px)"
        zIndex={110}
      >
        <div className="relative h-full min-h-0">
          <div className="absolute right-3 top-3 z-10 flex gap-1 rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#191919]/90">
            <button
              aria-label="下载流程图 SVG"
              className={toolPreviewActionClass}
              data-markai-tooltip="下载 SVG"
              disabled={!expandedSvg}
              onClick={() => expandedSvg && downloadSvg(expandedSvg, title)}
              type="button"
            >
              <Download size={15} />
            </button>
            <button
              aria-label="下载流程图 PNG"
              className={toolPreviewActionClass}
              data-markai-tooltip="下载 PNG"
              disabled={!expandedSvg}
              onClick={() => void exportPng(expandedSvg)}
              type="button"
            >
              <ImageDown size={15} />
            </button>
          </div>
          <DiagramSurface className="h-full min-h-0" onReady={setExpandedSvg} source={children} />
        </div>
      </AppDialog>
    </>
  );
}
