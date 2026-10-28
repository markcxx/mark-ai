import { cn } from "@/lib/utils";

export function ImageSkeleton({
  className,
  label = "正在加载图片",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("block animate-pulse bg-gray-100 dark:bg-white/[0.06]", className)}
    />
  );
}
