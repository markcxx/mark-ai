"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowRight, X } from "lucide-react";
import type { AnnouncementConfig } from "@/lib/announcement-config";
import { isAnnouncementUrl } from "@/lib/announcement-config";
import styles from "./AnnouncementSurface.module.css";

export function AnnouncementSurface({
  announcement,
  onClose,
  preview = false,
}: {
  announcement: AnnouncementConfig;
  onClose?: () => void;
  preview?: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [duration, setDuration] = useState(24);
  useEffect(() => {
    const measure = () => {
      if (!viewport.current || !text.current) return;
      // Measure the unpadded content, independently of the marquee state.
      // clientWidth rounds to integers and can misclassify fitting text.
      const width = text.current.getBoundingClientRect().width;
      setOverflow(width > viewport.current.getBoundingClientRect().width + 1);
      setDuration(Math.max(12, width / 35));
    };
    const observer = new ResizeObserver(measure);
    if (viewport.current) observer.observe(viewport.current);
    if (text.current) observer.observe(text.current);
    measure();
    return () => observer.disconnect();
  }, [announcement.content, announcement.actionEnabled, announcement.closable]);
  const action =
    announcement.actionEnabled &&
    isAnnouncementUrl(announcement.actionUrl) &&
    announcement.actionLabel;
  return (
    <aside aria-label={preview ? "公告显示预览" : "站点公告"} className={`${styles.bar} ${announcement.closable ? styles.closable : ""}`}>
      <div className={styles.glow} aria-hidden />
      <div className={`${styles.viewport} ${overflow ? styles.moving : ""}`} ref={viewport}>
        <div
          className={styles.track}
          style={{ "--announcement-duration": `${duration}s` } as CSSProperties}
        >
          <span className={styles.text}>
            <span className={styles.content} ref={text}>
              {announcement.content.replace(/\s*\n\s*/g, "　")}
            </span>
          </span>
          {overflow && (
            <span aria-hidden className={`${styles.text} ${styles.duplicate}`}>
              {announcement.content.replace(/\s*\n\s*/g, "　")}
            </span>
          )}
        </div>
      </div>
      {action && (
        <a
          className={styles.action}
          href={announcement.actionUrl}
          target={preview ? "_blank" : undefined}
          rel={preview ? "noopener noreferrer" : undefined}
        >
          <span>{announcement.actionLabel}</span>
          <ArrowRight size={14} />
        </a>
      )}
      {announcement.closable && (
        <button
          type="button"
          className={styles.close}
          aria-label="关闭公告"
          data-markai-tooltip="关闭公告"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      )}
    </aside>
  );
}
