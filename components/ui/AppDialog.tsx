"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AppDialog({
  bodyClassName,
  children,
  closable = true,
  closeDisabled = false,
  headerClassName,
  height,
  maskClassName,
  maskClosable = true,
  onClose,
  open,
  panelClassName,
  title,
  width,
  wrapperClassName,
  zIndex = 1200,
}: {
  bodyClassName?: string;
  children: ReactNode;
  closable?: boolean;
  closeDisabled?: boolean;
  headerClassName?: string;
  height?: number | string;
  maskClassName?: string;
  maskClosable?: boolean;
  onClose: () => void;
  open: boolean;
  panelClassName?: string;
  title?: ReactNode | false;
  width?: number | string;
  wrapperClassName?: string;
  zIndex?: number;
}) {
  const [denying, setDenying] = useState(false);
  const denyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showTitle = title !== undefined && title !== null && title !== false;
  const showHeader = showTitle || closable;

  useEffect(
    () => () => {
      if (denyTimer.current) clearTimeout(denyTimer.current);
    },
    [],
  );

  const triggerDeny = () => {
    if (denyTimer.current) clearTimeout(denyTimer.current);
    setDenying(true);
    denyTimer.current = setTimeout(() => setDenying(false), 300);
  };

  return (
    <Dialog.Root
      disablePointerDismissal={!maskClosable || closeDisabled}
      onOpenChange={(nextOpen, details) => {
        if (nextOpen || !open) return;
        if (details.reason === "escape-key" && closeDisabled) return;
        if (details.reason === "outside-press" && (!maskClosable || closeDisabled)) {
          triggerDeny();
          return;
        }
        onClose();
      }}
      open={open}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn("markai-dialog-backdrop", maskClassName)}
          style={{ zIndex }}
        />
        <Dialog.Viewport
          className={cn("markai-dialog-viewport", wrapperClassName)}
          style={{ zIndex: zIndex + 1 }}
        >
          <Dialog.Popup
            aria-label={!showTitle ? "对话框" : undefined}
            className={cn(
              "markai-dialog-panel border-gray-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] dark:border-white/15 dark:bg-[#191919] dark:shadow-[0_28px_90px_rgba(0,0,0,0.58)]",
              denying && "markai-dialog-deny",
              panelClassName,
            )}
            style={{ height, maxWidth: width }}
          >
            {showHeader && (
              <header
                className={cn(
                  "flex min-h-14 shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-white/[0.08]",
                  headerClassName,
                )}
              >
                {showTitle ? (
                  <Dialog.Title className="m-0 min-w-0 flex-1 text-[17px] font-semibold leading-[1.4] text-gray-900 dark:text-gray-100">
                    {title}
                  </Dialog.Title>
                ) : (
                  <span />
                )}
                {closable && (
                  <Dialog.Close
                    aria-label="关闭"
                    className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-all duration-150 hover:scale-[1.04] hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-white/[0.08] dark:hover:text-gray-100"
                    disabled={closeDisabled}
                  >
                    <X size={16} />
                  </Dialog.Close>
                )}
              </header>
            )}
            <div
              className={cn(
                "min-h-0 overflow-y-auto",
                height !== undefined && "flex-1",
                bodyClassName,
              )}
            >
              {children}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
