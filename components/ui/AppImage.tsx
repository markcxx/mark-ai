"use client";

import NextImage, { type ImageProps } from "next/image";
import { ImageOff } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useImageLoading } from "@/hooks/useImageLoading";
import { cn } from "@/lib/utils";
import { ImageSkeleton } from "./ImageSkeleton";

type AppImageProps = ImageProps & {
  native?: boolean;
  responsive?: boolean;
  containerClassName?: string;
  containerStyle?: CSSProperties;
  fallback?: ReactNode;
  loadingLabel?: string;
  placeholderAspectRatio?: CSSProperties["aspectRatio"];
  onPreview?: () => void;
  previewLabel?: string;
  mask?: boolean;
};

const getImageSource = (src: ImageProps["src"]) =>
  typeof src === "string" ? src : "default" in src ? src.default.src : src.src;

/** One loading lifecycle for content, avatars and icons. Source changes reset the inner instance. */
export default function AppImage(props: AppImageProps) {
  const source = getImageSource(props.src);
  const [attempt, setAttempt] = useState(0);
  return (
    <ImageContent
      {...props}
      key={`${source}:${attempt}`}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}

function ImageContent({
  native = false,
  responsive = false,
  containerClassName,
  containerStyle,
  fallback,
  loadingLabel,
  placeholderAspectRatio = "3 / 2",
  onPreview,
  previewLabel,
  mask = false,
  onRetry,
  className,
  style,
  fill,
  ...props
}: AppImageProps & { onRetry: () => void }) {
  const { ref, status } = useImageLoading();
  const pending = status === "loading";
  const failed = status === "error";
  const source = getImageSource(props.src);
  const lacksSize = !props.width || !props.height;
  const frameStyle: CSSProperties = {
    ...(!fill && !lacksSize
      ? responsive
        ? { width: "100%" }
        : { width: Number(props.width), height: Number(props.height), flexShrink: 0 }
      : {}),
    ...(fill ? { position: "absolute", inset: 0, width: "100%", height: "100%" } : {}),
    ...(!fill && lacksSize && status !== "ready"
      ? { width: "100%", aspectRatio: placeholderAspectRatio }
      : {}),
    ...(mask && status === "ready"
      ? {
          backgroundColor: "currentColor",
          maskImage: `url("${source}")`,
          WebkitMaskImage: `url("${source}")`,
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskPosition: "center",
          WebkitMaskPosition: "center",
        }
      : {}),
    ...containerStyle,
  };
  const imgClass = cn(
    "block max-w-full",
    !fill && !lacksSize && !responsive && "h-full w-full object-contain",
    className,
    (status !== "ready" || mask) && "opacity-0",
  );
  const common = { ...props, className: imgClass, style, ref };
  const image = native ? (
    (() => {
      const {
        src,
        priority,
        unoptimized: _unoptimized,
        quality: _quality,
        loader: _loader,
        placeholder: _placeholder,
        blurDataURL: _blurDataURL,
        onLoadingComplete: _onLoadingComplete,
        overrideSrc: _overrideSrc,
        ...nativeProps
      } = common;
      void src;
      // Arbitrary external hosts and scoped file URLs retain their original request semantics.
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          {...nativeProps}
          src={source}
          alt={props.alt}
          loading={priority ? "eager" : props.loading}
          fetchPriority={priority ? "high" : props.fetchPriority}
          decoding={props.decoding || "async"}
        />
      );
    })()
  ) : (
    <NextImage {...common} fill={fill} />
  );
  const contents = (
    <>
      {image}
      {pending && (
        <ImageSkeleton
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          label={loadingLabel}
        />
      )}
      {failed && (
        <span
          className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500"
          role={onPreview ? undefined : "img"}
          aria-label={onPreview ? undefined : "图片加载失败"}
        >
          {fallback ?? <ImageOff aria-hidden="true" className="max-h-full max-w-full" size={18} />}
        </span>
      )}
    </>
  );
  const frameClass = cn(
    "relative inline-grid max-w-full align-middle [grid-template-columns:minmax(0,1fr)]",
    containerClassName,
  );
  if (onPreview)
    return (
      <button
        type="button"
        className={frameClass}
        style={frameStyle}
        aria-busy={pending}
        aria-label={failed ? "图片加载失败，点击重试" : previewLabel || `查看 ${props.alt}`}
        disabled={pending}
        onClick={failed ? onRetry : onPreview}
        data-image-state={status}
      >
        {contents}
      </button>
    );
  return (
    <span className={frameClass} style={frameStyle} aria-busy={pending} data-image-state={status}>
      {contents}
    </span>
  );
}
