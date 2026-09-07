"use client";

import { useFileUrl } from "./FileAccessContext";

import { Download, ExternalLink, FileQuestion, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import type PhotoSwipeLightbox from "photoswipe/lightbox";

import { AppDialog } from "@/components/ui/AppDialog";

import { useHtmlPreview } from "./HtmlPreviewContext";

export type PreviewFile = {
  contentType: string;
  id: string;
  name: string;
  size: number;
};

const getPreviewKind = (file: PreviewFile) => {
  if (file.contentType === "application/msword" || file.name.toLowerCase().endsWith(".doc")) {
    return "doc";
  }
  if (
    file.contentType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.name.toLowerCase().endsWith(".xlsx")
  ) {
    return "spreadsheet";
  }
  if (
    file.contentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx")
  ) {
    return "docx";
  }
  if (file.contentType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return "pdf";
  }
  if (file.contentType.startsWith("image/")) return "image";
  if (file.contentType.startsWith("audio/")) return "audio";
  if (file.contentType.startsWith("video/")) return "video";
  if (
    file.contentType.startsWith("text/") ||
    [".txt", ".md", ".csv", ".json", ".xml", ".yaml", ".yml"].some((extension) =>
      file.name.toLowerCase().endsWith(extension),
    )
  ) {
    return "text";
  }
  return "unsupported";
};

export const isFilePreviewable = (file: PreviewFile) => getPreviewKind(file) !== "unsupported";

function PhotoSwipeImagePreview({
  downloadUrl,
  file,
  onClose,
  previewUrl,
}: {
  downloadUrl: string;
  file: PreviewFile;
  onClose: () => void;
  previewUrl: string;
}) {
  const lightboxRef = useRef<PhotoSwipeLightbox | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let active = true;
    const image = new Image();

    const openImage = async () => {
      try {
        await image.decode();
        if (!active) return;

        const { default: Lightbox } = await import("photoswipe/lightbox");
        if (!active) return;

        const lightbox = new Lightbox({
          bgOpacity: 0.92,
          closeOnVerticalDrag: true,
          dataSource: [
            {
              alt: file.name,
              height: image.naturalHeight,
              src: previewUrl,
              width: image.naturalWidth,
            },
          ],
          imageClickAction: "zoom-or-close",
          paddingFn: (viewportSize) => ({
            bottom: viewportSize.x < 768 ? 72 : 64,
            left: viewportSize.x < 768 ? 12 : 32,
            right: viewportSize.x < 768 ? 12 : 32,
            top: viewportSize.x < 768 ? 52 : 64,
          }),
          pswpModule: () => import("photoswipe"),
          returnFocus: true,
          showHideAnimationType: "fade",
          wheelToZoom: true,
        });

        lightbox.on("uiRegister", () => {
          lightbox.pswp?.ui?.registerElement({
            appendTo: "root",
            className: "markai-pswp-caption",
            html: "",
            name: "markai-caption",
            onInit: (element) => {
              element.textContent = file.name;
            },
            order: 8,
          });
          lightbox.pswp?.ui?.registerElement({
            appendTo: "bar",
            ariaLabel: `下载 ${file.name}`,
            className: "markai-pswp-download",
            html: "下载",
            name: "markai-download",
            onInit: (element) => {
              const link = element as HTMLAnchorElement;
              link.download = file.name;
              link.href = downloadUrl;
            },
            order: 8,
            tagName: "a",
            title: "下载",
          });
        });
        lightbox.on("close", () => {
          if (active) onCloseRef.current();
        });
        lightbox.init();
        lightboxRef.current = lightbox;
        lightbox.loadAndOpen(0);
      } catch {
        if (!active) return;
        toast.error("图片加载失败，请下载后查看");
        onCloseRef.current();
      }
    };

    image.src = previewUrl;
    void openImage();

    return () => {
      active = false;
      image.src = "";
      lightboxRef.current?.destroy();
      lightboxRef.current = null;
    };
  }, [downloadUrl, file.id, file.name, previewUrl]);

  return (
    <div
      aria-label={`正在打开 ${file.name}`}
      aria-live="polite"
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/90 text-white"
      role="status"
    >
      <Loader2 className="animate-spin" size={22} />
    </div>
  );
}

export function FilePreviewDialog({
  downloadUrl,
  file,
  onClose,
  previewUrl,
}: {
  downloadUrl?: string;
  file: PreviewFile | null;
  onClose: () => void;
  previewUrl?: string;
}) {
  const fileUrl = useFileUrl();
  const kind = file ? getPreviewKind(file) : "unsupported";
  const htmlPreview = useHtmlPreview();
  const [loading, setLoading] = useState(kind !== "unsupported");
  useEffect(() => setLoading(kind !== "unsupported"), [file?.id, kind]);

  const resolvedPreviewUrl = file
    ? previewUrl || fileUrl(file.id, "preview")
    : previewUrl || "";
  const resolvedDownloadUrl = file
    ? downloadUrl || fileUrl(file.id, "download")
    : downloadUrl || "";

  useEffect(() => {
    if (!file || kind === "image" || kind === "unsupported" || !htmlPreview) return;

    htmlPreview.openPreview({
      contentType: file.contentType,
      dataUrl: `${resolvedPreviewUrl}${resolvedPreviewUrl.includes("?") ? "&" : "?"}raw=1`,
      downloadUrl: resolvedDownloadUrl,
      id: `file-${file.id}`,
      kind: "file",
      sourceUrl: resolvedPreviewUrl,
      title: file.name,
    });
    onClose();
  }, [file, htmlPreview, kind, onClose, resolvedDownloadUrl, resolvedPreviewUrl]);

  if (!file) return null;
  if (kind === "image") {
    return (
      <PhotoSwipeImagePreview
        downloadUrl={resolvedDownloadUrl}
        file={file}
        onClose={onClose}
        previewUrl={resolvedPreviewUrl}
      />
    );
  }
  if (kind !== "unsupported" && htmlPreview) return null;
  const title = (
    <div className="flex min-w-0 items-center gap-2 pr-2">
      <span className="min-w-0 flex-1 truncate text-sm font-medium" title={file.name}>
        {file.name}
      </span>
      {kind !== "unsupported" && (
        <a
          aria-label="在新标签页打开"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.08] dark:hover:text-gray-200"
          href={resolvedPreviewUrl}
          rel="noreferrer"
          target="_blank"
          title="在新标签页打开"
        >
          <ExternalLink size={16} />
        </a>
      )}
      <a
        aria-label="下载文件"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.08] dark:hover:text-gray-200"
        href={resolvedDownloadUrl}
        title="下载"
      >
        <Download size={16} />
      </a>
    </div>
  );

  return (
    <AppDialog
      bodyClassName="flex min-h-0 flex-1 overflow-hidden"
      height="min(88dvh, 860px)"
      onClose={onClose}
      open
      panelClassName="overflow-hidden"
      title={title}
      width="min(96vw, 1180px)"
      zIndex={95}
    >
      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[#f2f3f5] dark:bg-[#101113]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#f2f3f5]/80 text-gray-400 backdrop-blur-[2px] dark:bg-[#101113]/80">
            <Loader2 className="animate-spin" size={20} />
          </div>
        )}
        {kind === "audio" && (
          <audio
            className="w-full max-w-2xl"
            controls
            onError={() => setLoading(false)}
            onLoadedData={() => setLoading(false)}
            src={resolvedPreviewUrl}
          />
        )}
        {kind === "video" && (
          <video
            className="max-h-full max-w-full"
            controls
            onError={() => setLoading(false)}
            onLoadedData={() => setLoading(false)}
            src={resolvedPreviewUrl}
          />
        )}
        {(kind === "doc" ||
          kind === "docx" ||
          kind === "pdf" ||
          kind === "spreadsheet" ||
          kind === "text") && (
          <iframe
            className="h-full w-full border-0 bg-white"
            onLoad={() => setLoading(false)}
            referrerPolicy="no-referrer"
            sandbox={kind === "doc" || kind === "docx" || kind === "spreadsheet" ? "" : undefined}
            src={resolvedPreviewUrl}
            title={`${file.name} 预览`}
          />
        )}
        {kind === "unsupported" && (
          <div className="px-6 text-center text-gray-500 dark:text-gray-400">
            <FileQuestion className="mx-auto text-gray-400" size={30} />
            <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
              暂不支持在线预览此格式
            </p>
            <p className="mt-1 text-xs">可以下载后使用本地应用打开。</p>
          </div>
        )}
      </div>
    </AppDialog>
  );
}
