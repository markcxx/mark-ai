"use client";

import { AlertCircle, Code2, Download, Eye, Loader2, Maximize2, Minimize2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Pre } from "@/components/CodeBlock";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUIStore } from "@/stores/useUIStore";

import { FileTypeIcon } from "./files/FileTypeIcon";
import {
  downloadHtmlFile,
  getHtmlPreviewDocument,
  type HtmlPreviewPayload,
} from "./htmlPreviewUtils";
import { WordDocumentLivePreview } from "./WordDocumentLivePreview";

type PreviewMode = "preview" | "code";
type FilePreviewPayload = Extract<HtmlPreviewPayload, { kind: "file" }>;
type OfficePreviewRenderer = {
  destroy: () => void;
  preview: (source: ArrayBuffer) => Promise<unknown>;
  xs?: { reRender?: () => void };
};

const getOfficeRendererKind = (preview: FilePreviewPayload) => {
  const lowerName = preview.title.toLocaleLowerCase();
  if (
    preview.contentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    return "docx" as const;
  }
  if (
    preview.contentType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    lowerName.endsWith(".xlsx")
  ) {
    return "excel" as const;
  }
  return undefined;
};

function OfficeFilePreview({ preview }: { preview: FilePreviewPayload }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const rendererKind = getOfficeRendererKind(preview);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !rendererKind) return;

    let active = true;
    let renderer: OfficePreviewRenderer | undefined;
    let resizeFrame = 0;
    const controller = new AbortController();
    const resizeObserver = new ResizeObserver(() => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => renderer?.xs?.reRender?.());
    });
    resizeObserver.observe(container);
    setError("");
    setLoading(true);
    container.replaceChildren();

    const render = async () => {
      try {
        const modulePromise =
          rendererKind === "docx" ? import("@js-preview/docx") : import("@js-preview/excel");
        const [response, module] = await Promise.all([
          fetch(preview.dataUrl, { cache: "no-store", signal: controller.signal }),
          modulePromise,
        ]);
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error || "无法读取文件内容");
        }
        const source = await response.arrayBuffer();
        if (!active) return;

        renderer = (
          rendererKind === "docx"
            ? module.default.init(container, {
                breakPages: true,
                ignoreFonts: false,
                ignoreHeight: false,
                ignoreWidth: false,
                renderEndnotes: true,
                renderFooters: true,
                renderFootnotes: true,
                renderHeaders: true,
                useBase64URL: true,
              })
            : module.default.init(container, {
                minColLength: 20,
                minRowLength: 50,
                showContextmenu: false,
              })
        ) as OfficePreviewRenderer;
        await renderer.preview(source);
        if (active) setLoading(false);
      } catch (previewError) {
        if (!active || controller.signal.aborted) return;
        const message = previewError instanceof Error ? previewError.message : "";
        setError(
          /[\u4e00-\u9fff]/.test(message)
            ? message
            : "文件格式可能不受支持或文件已经损坏，请下载原文件查看。",
        );
        setLoading(false);
      }
    };

    void render();
    return () => {
      active = false;
      controller.abort();
      resizeObserver.disconnect();
      window.cancelAnimationFrame(resizeFrame);
      try {
        renderer?.destroy();
      } catch {
        container.replaceChildren();
      }
    };
  }, [preview.dataUrl, preview.id, rendererKind]);

  return (
    <div className="relative h-full min-h-0 bg-[#e8e9ec] dark:bg-[#101113]">
      <div
        className={cn(
          "markai-office-preview h-full min-h-0",
          rendererKind === "excel" ? "overflow-hidden bg-white" : "overflow-auto",
        )}
        ref={containerRef}
      />
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50 text-gray-400 dark:bg-[#111214] dark:text-gray-500">
          <Loader2 className="animate-spin" size={20} />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-50 px-6 text-center dark:bg-[#111214]">
          <AlertCircle className="text-red-500" size={24} />
          <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
            无法还原此文件
          </p>
          <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">{error}</p>
          <a
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white dark:text-gray-900"
            href={preview.downloadUrl}
          >
            <Download size={14} /> 下载原文件
          </a>
        </div>
      )}
    </div>
  );
}

function PreviewFrame({ preview }: { preview: HtmlPreviewPayload }) {
  const [loading, setLoading] = useState(preview.kind === "file");

  useEffect(() => {
    setLoading(preview.kind === "file");
  }, [preview.id, preview.kind]);

  if (preview.kind === "word-document") {
    return (
      <WordDocumentLivePreview
        document={preview.document}
        progress={preview.progress}
        status={preview.status}
      />
    );
  }

  if (preview.kind === "file") {
    if (getOfficeRendererKind(preview)) return <OfficeFilePreview preview={preview} />;

    const lowerName = preview.title.toLocaleLowerCase();
    const renderedOfficeDocument =
      preview.contentType === "application/msword" ||
      preview.contentType.includes("officedocument") ||
      [".doc", ".docx", ".xlsx"].some((extension) => lowerName.endsWith(extension));

    return (
      <div className="relative h-full w-full bg-white">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50 text-gray-400 dark:bg-[#111214] dark:text-gray-500">
            <Loader2 className="animate-spin" size={20} />
          </div>
        )}
        <iframe
          className="h-full w-full border-0 bg-white"
          onLoad={() => setLoading(false)}
          referrerPolicy="no-referrer"
          sandbox={renderedOfficeDocument ? "" : undefined}
          src={preview.sourceUrl}
          title={`${preview.title} 预览`}
        />
      </div>
    );
  }

  return (
    <iframe
      className="h-full w-full bg-white"
      referrerPolicy="no-referrer"
      sandbox="allow-forms allow-modals allow-scripts"
      srcDoc={getHtmlPreviewDocument(preview.content)}
      title={preview.title}
    />
  );
}

function PreviewTabs({
  mode,
  onModeChange,
}: {
  mode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
}) {
  return (
    <div className="relative grid h-8 w-[70px] grid-cols-2 rounded-lg bg-gray-100 p-0.5 dark:bg-white/[0.06]">
      <span
        className={cn(
          "absolute bottom-0.5 top-0.5 w-[33px] rounded-md bg-white shadow-sm transition-transform duration-200 dark:bg-[#262626]",
          mode === "code" && "translate-x-[33px]",
        )}
      />
      {[
        { icon: Eye, key: "preview" as const, title: "预览" },
        { icon: Code2, key: "code" as const, title: "源码" },
      ].map((item) => {
        const Icon = item.icon;
        const active = mode === item.key;

        return (
          <button
            className={cn(
              "relative z-10 flex h-7 items-center justify-center rounded-md transition-colors",
              active
                ? "text-gray-900 dark:text-gray-100"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100",
            )}
            key={item.key}
            onClick={() => onModeChange(item.key)}
            title={item.title}
            type="button"
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}

export function HtmlPreviewPanel({
  fullscreen,
  onClose,
  onFullscreenChange,
  onResizePointerDown,
  preview,
  resizing,
}: {
  fullscreen: boolean;
  onClose: () => void;
  onFullscreenChange: (fullscreen: boolean) => void;
  onResizePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  preview: HtmlPreviewPayload;
  resizing: boolean;
}) {
  const [mode, setMode] = useState<PreviewMode>("preview");
  const htmlContent = preview.kind === "html" || preview.kind === undefined ? preview.content : "";
  const previewDocument = useMemo(() => getHtmlPreviewDocument(htmlContent), [htmlContent]);
  const isFilePreview = preview.kind === "file";
  const isWordPreview = preview.kind === "word-document";

  return (
    <aside className="relative flex min-w-0 flex-col overflow-hidden border-0 bg-[var(--chat-panel-bg)] opacity-100 shadow-none transition-opacity duration-300 ease-out dark:border-gray-700 md:rounded-xl md:border md:border-[#e5e5e5]">
      {!fullscreen && (
        <div
          aria-label="调整预览宽度"
          className="group absolute inset-y-0 left-0 z-30 hidden w-3 -translate-x-1/2 touch-none cursor-col-resize md:block"
          onDoubleClick={() => {
            useUIStore.getState().setPreviewWidth(48);
            useSettingsStore.getState().updateGeneral({ previewWidth: 48 });
          }}
          onPointerDown={onResizePointerDown}
          role="separator"
        >
          <div
            className={cn(
              "absolute inset-y-0 left-1/2 w-0.5 bg-transparent transition-colors duration-150 group-hover:bg-primary/70",
              resizing && "bg-primary",
            )}
          />
        </div>
      )}
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-gray-200 bg-[var(--chat-header-bg)] px-3 backdrop-blur-md dark:border-white/10">
        <div className="flex min-w-0 items-center gap-2">
          {isFilePreview || isWordPreview ? (
            <FileTypeIcon
              contentType={
                isFilePreview
                  ? preview.contentType
                  : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              }
              name={preview.title}
              tile
              tileClassName="h-8 w-8 rounded-md"
            />
          ) : (
            <PreviewTabs mode={mode} onModeChange={setMode} />
          )}
          <div className="min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {preview.title}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isFilePreview ? (
            <a
              aria-label={`下载 ${preview.title}`}
              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100"
              data-markai-tooltip="下载"
              href={preview.downloadUrl}
            >
              <Download size={15} />
            </a>
          ) : !isWordPreview ? (
            <button
              aria-label="下载 HTML"
              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100"
              data-markai-tooltip="下载 HTML"
              onClick={() => downloadHtmlFile(preview.content, preview.title)}
              type="button"
            >
              <Download size={15} />
            </button>
          ) : null}
          <button
            className="hidden h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100 md:flex"
            onClick={() => onFullscreenChange(!fullscreen)}
            title={fullscreen ? "恢复分栏" : "全屏预览"}
            type="button"
          >
            {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100"
            onClick={onClose}
            title="关闭预览"
            type="button"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {isFilePreview || isWordPreview || mode === "preview" ? (
          <PreviewFrame
            preview={
              isFilePreview || isWordPreview
                ? preview
                : { content: previewDocument, id: preview.id, title: preview.title }
            }
          />
        ) : (
          <div className="h-full overflow-auto p-4">
            <Pre language="html">{htmlContent}</Pre>
          </div>
        )}
      </div>
    </aside>
  );
}
