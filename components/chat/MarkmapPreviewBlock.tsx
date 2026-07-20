"use client";

import {
  AlertCircle,
  Check,
  Copy,
  Download,
  ImageDown,
  ListCollapse,
  ListTree,
  Loader2,
  Maximize2,
  Network,
  Scan,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import { AppDialog } from "@/components/ui/AppDialog";
import { downloadSvg, downloadSvgAsPng } from "@/lib/visualization/svg-export";

const MAX_SOURCE_LENGTH = 50_000;
const MAX_NODES = 1_000;
const BLOCKED_SOURCE =
  /<\/?(?:script|iframe|object|embed|img|foreignObject)\b|javascript:|!\[[^\]]*\]\s*\(/im;

type MindMapNode = {
  children?: MindMapNode[];
  payload?: Record<string, unknown>;
};

type MarkmapInstance = import("markmap-view").Markmap;

const validateSource = (source: string) => {
  const trimmed = source.trim();
  if (!trimmed) return "脑图内容为空";
  if (trimmed.length > MAX_SOURCE_LENGTH) return "脑图内容不能超过 50,000 个字符";
  if (BLOCKED_SOURCE.test(trimmed)) return "脑图包含不允许的嵌入内容";
  return null;
};

const countNodes = (root: MindMapNode) => {
  let count = 0;
  const visit = (node: MindMapNode, depth: number) => {
    count += 1;
    if (count > MAX_NODES) throw new Error("脑图节点不能超过 1,000 个");
    if (depth > 16) throw new Error("脑图层级过深");
    node.children?.forEach((child) => visit(child, depth + 1));
  };
  visit(root, 0);
};

const getTitle = (source: string) =>
  source
    .match(/^\s*#\s+(.+)$/m)?.[1]
    ?.replaceAll(/[*_`]/g, "")
    .trim()
    .slice(0, 80) || "Markmap 脑图";

const actionClass =
  "flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 dark:hover:bg-white/[0.07] dark:hover:text-gray-200";

const getMarkmapOptions = (dark: boolean) => ({
  autoFit: false,
  duration: 0,
  embedGlobalCSS: true,
  fitRatio: 0.92,
  initialExpandLevel: -1,
  maxInitialScale: 1.4,
  maxWidth: 260,
  pan: true,
  scrollForPan: false,
  style: () => `
    .markmap-node text, .markmap-node foreignObject { color: ${dark ? "#e5e7eb" : "#374151"}; }
    .markmap-node circle { fill: ${dark ? "#d1d5db" : "#4b5563"}; cursor: pointer; }
  `,
  zoom: true,
});

const syncFoldIndicators = (markmap: MarkmapInstance) => {
  const svg = markmap.svg.node();
  if (!svg) return;
  svg.querySelectorAll<SVGGElement>("g.markmap-node").forEach((group) => {
    const node = (group as SVGGElement & { __data__?: MindMapNode }).__data__;
    const circle = group.querySelector<SVGCircleElement>(":scope > circle");
    let indicator = group.querySelector<SVGGElement>(":scope > g.markmap-fold-indicator");
    const hasChildren = Boolean(node?.children?.length);

    if (!hasChildren || !circle) {
      indicator?.remove();
      return;
    }

    if (!indicator) {
      indicator = document.createElementNS("http://www.w3.org/2000/svg", "g");
      indicator.classList.add("markmap-fold-indicator");
      indicator.setAttribute("aria-hidden", "true");
      indicator.setAttribute("pointer-events", "none");

      const createLine = (
        className: string,
        coordinates: { x1: string; x2: string; y1: string; y2: string },
        foreground: boolean,
      ) => {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.classList.add(
          className,
          foreground ? "markmap-fold-foreground" : "markmap-fold-outline",
        );
        Object.entries(coordinates).forEach(([name, value]) => line.setAttribute(name, value));
        line.setAttribute("stroke", foreground ? "#ffffff" : "rgba(0, 0, 0, 0.78)");
        line.setAttribute("stroke-linecap", "round");
        line.setAttribute("stroke-width", foreground ? "1.15" : "2.5");
        indicator?.appendChild(line);
      };

      const horizontal = { x1: "-3", x2: "3", y1: "0", y2: "0" };
      const vertical = { x1: "0", x2: "0", y1: "-3", y2: "3" };
      createLine("markmap-fold-horizontal", horizontal, false);
      createLine("markmap-fold-vertical", vertical, false);
      createLine("markmap-fold-horizontal", horizontal, true);
      createLine("markmap-fold-vertical", vertical, true);
      group.appendChild(indicator);
    }

    indicator.setAttribute(
      "transform",
      `translate(${circle.getAttribute("cx") || "0"} ${circle.getAttribute("cy") || "0"})`,
    );
    indicator.querySelectorAll<SVGLineElement>(".markmap-fold-vertical").forEach((line) => {
      line.style.display = node?.payload?.fold ? "" : "none";
    });
  });
};

const setAllFolded = async (markmap: MarkmapInstance, folded: boolean) => {
  const visit = (node: MindMapNode, depth: number) => {
    node.payload = { ...node.payload, fold: folded && depth > 0 ? 1 : 0 };
    node.children?.forEach((child) => visit(child, depth + 1));
  };
  if (!markmap.state.data) return;
  visit(markmap.state.data as MindMapNode, 0);
  await markmap.renderData();
  await markmap.fit();
  syncFoldIndicators(markmap);
};

const renderMindMapForExport = async ({
  background,
  dark,
  format,
  source,
  title,
}: {
  background: string;
  dark: boolean;
  format: "png" | "svg";
  source: string;
  title: string;
}) => {
  const [{ Transformer }, { Markmap }] = await Promise.all([
    import("markmap-lib"),
    import("markmap-view"),
  ]);
  const transformer = new Transformer();
  const { root } = transformer.transform(source.trim());
  countNodes(root as MindMapNode);

  const host = document.createElement("div");
  const exportSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  Object.assign(host.style, {
    height: "1000px",
    left: "-10000px",
    position: "fixed",
    top: "0",
    width: "1600px",
  });
  Object.assign(exportSvg.style, { height: "100%", width: "100%" });
  host.appendChild(exportSvg);
  document.body.appendChild(host);

  const markmap = new Markmap(exportSvg, getMarkmapOptions(dark));
  try {
    await markmap.setData(root);
    const { x1, x2, y1, y2 } = markmap.state.rect;
    const width = Math.min(4096, Math.max(1200, Math.ceil((x2 - x1) * 1.15)));
    const height = Math.min(4096, Math.max(800, Math.ceil((y2 - y1) * 1.15)));
    host.style.width = `${width}px`;
    host.style.height = `${height}px`;
    exportSvg.setAttribute("width", String(width));
    exportSvg.setAttribute("height", String(height));
    await markmap.fit(1.5);
    syncFoldIndicators(markmap);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (format === "svg") downloadSvg(exportSvg, title);
    else await downloadSvgAsPng(exportSvg, title, background);
  } finally {
    markmap.destroy();
    host.remove();
  }
};

const MindMapSurface = ({
  className,
  onReady,
  source,
}: {
  className: string;
  onReady?: (ready: boolean) => void;
  source: string;
}) => {
  const { resolvedTheme } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<MarkmapInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const validationError = useMemo(() => validateSource(source), [source]);

  useEffect(() => {
    let active = true;
    let destroy: (() => void) | undefined;
    setError(validationError);
    setLoading(!validationError);
    onReady?.(false);
    if (validationError || !svgRef.current) return () => undefined;

    const svgElement = svgRef.current;
    svgElement.replaceChildren();
    void Promise.all([import("markmap-lib"), import("markmap-view")])
      .then(async ([{ Transformer }, { Markmap }]) => {
        const transformer = new Transformer();
        const { root } = transformer.transform(source.trim());
        countNodes(root as MindMapNode);
        if (!active) return;
        const dark = resolvedTheme === "dark";
        const markmap = new Markmap(svgElement, getMarkmapOptions(dark));
        markmapRef.current = markmap;
        destroy = () => markmap.destroy();
        await markmap.setData(root);
        await markmap.fit();
        if (!active) return;
        syncFoldIndicators(markmap);
        const handleNodeToggle = () => {
          requestAnimationFrame(() => requestAnimationFrame(() => syncFoldIndicators(markmap)));
        };
        svgElement.addEventListener("click", handleNodeToggle);
        const previousDestroy = destroy;
        destroy = () => {
          svgElement.removeEventListener("click", handleNodeToggle);
          previousDestroy?.();
        };
        setLoading(false);
        onReady?.(true);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Markmap 渲染失败");
        setLoading(false);
      });

    return () => {
      active = false;
      destroy?.();
      markmapRef.current = null;
      onReady?.(false);
    };
  }, [onReady, resolvedTheme, source, validationError]);

  return (
    <div className={`relative overflow-hidden bg-white dark:bg-[#171717] ${className}`}>
      <svg className="absolute inset-0 h-full w-full" ref={svgRef} />
      {!error && !loading && (
        <div className="absolute bottom-3 right-3 z-10 flex gap-1 rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#191919]/90">
          <button
            aria-label="折叠脑图节点"
            className={actionClass}
            data-markai-tooltip="折叠全部"
            onClick={() => markmapRef.current && void setAllFolded(markmapRef.current, true)}
            type="button"
          >
            <ListCollapse size={15} />
          </button>
          <button
            aria-label="展开脑图节点"
            className={actionClass}
            data-markai-tooltip="展开全部"
            onClick={() => markmapRef.current && void setAllFolded(markmapRef.current, false)}
            type="button"
          >
            <ListTree size={15} />
          </button>
          <span className="mx-0.5 w-px bg-gray-200 dark:bg-white/10" />
          <button
            aria-label="缩小脑图"
            className={actionClass}
            data-markai-tooltip="缩小"
            onClick={() => markmapRef.current && void markmapRef.current.rescale(0.8)}
            type="button"
          >
            <ZoomOut size={15} />
          </button>
          <button
            aria-label="适应脑图视口"
            className={actionClass}
            data-markai-tooltip="适应视口"
            onClick={() => markmapRef.current && void markmapRef.current.fit()}
            type="button"
          >
            <Scan size={15} />
          </button>
          <button
            aria-label="放大脑图"
            className={actionClass}
            data-markai-tooltip="放大"
            onClick={() => markmapRef.current && void markmapRef.current.rescale(1.2)}
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
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white px-6 text-center dark:bg-[#171717]">
          <AlertCircle className="text-amber-500" size={24} />
          <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
            脑图暂时无法渲染
          </p>
          <p className="mt-1 max-w-lg text-xs text-gray-400">{error}</p>
        </div>
      )}
    </div>
  );
};

export function MarkmapPreviewBlock({ children }: { children: string }) {
  const { resolvedTheme } = useTheme();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);
  const [expandedReady, setExpandedReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const title = useMemo(() => getTitle(children), [children]);
  const background = resolvedTheme === "dark" ? "#171717" : "#ffffff";

  const copySource = async () => {
    await navigator.clipboard.writeText(children.trim());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const exportMindMap = async (format: "png" | "svg") => {
    if (exporting) return;
    setExporting(true);
    try {
      await renderMindMapForExport({
        background,
        dark: resolvedTheme === "dark",
        format,
        source: children,
        title,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "脑图导出失败");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <section className="my-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#171717]">
        <header className="flex min-h-12 items-center justify-between gap-2 border-b border-gray-100 px-3 py-1.5 dark:border-white/[0.08]">
          <div className="flex min-w-0 items-center gap-2">
            <Network className="shrink-0 text-primary" size={17} />
            <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </span>
            <span className="hidden rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 sm:inline dark:bg-white/[0.06]">
              Markmap
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              aria-label="放大查看脑图"
              className={actionClass}
              data-markai-tooltip="放大查看"
              disabled={!ready}
              onClick={() => setExpanded(true)}
              type="button"
            >
              <Maximize2 size={15} />
            </button>
            <button
              aria-label="下载脑图 SVG"
              className={actionClass}
              data-markai-tooltip="下载 SVG"
              disabled={!ready || exporting}
              onClick={() => void exportMindMap("svg")}
              type="button"
            >
              <Download size={15} />
            </button>
            <button
              aria-label="下载脑图 PNG"
              className={actionClass}
              data-markai-tooltip="下载 PNG"
              disabled={!ready || exporting}
              onClick={() => void exportMindMap("png")}
              type="button"
            >
              <ImageDown size={15} />
            </button>
            <button
              aria-label={copied ? "源码已复制" : "复制脑图源码"}
              className={actionClass}
              data-markai-tooltip={copied ? "已复制" : "复制源码"}
              onClick={() => void copySource()}
              type="button"
            >
              {copied ? <Check className="text-emerald-500" size={15} /> : <Copy size={15} />}
            </button>
          </div>
        </header>
        <MindMapSurface className="h-[340px] sm:h-[380px]" onReady={setReady} source={children} />
      </section>

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
              aria-label="下载脑图 SVG"
              className={actionClass}
              data-markai-tooltip="下载 SVG"
              disabled={!expandedReady || exporting}
              onClick={() => void exportMindMap("svg")}
              type="button"
            >
              <Download size={15} />
            </button>
            <button
              aria-label="下载脑图 PNG"
              className={actionClass}
              data-markai-tooltip="下载 PNG"
              disabled={!expandedReady || exporting}
              onClick={() => void exportMindMap("png")}
              type="button"
            >
              <ImageDown size={15} />
            </button>
          </div>
          <MindMapSurface className="h-full min-h-0" onReady={setExpandedReady} source={children} />
        </div>
      </AppDialog>
    </>
  );
}
