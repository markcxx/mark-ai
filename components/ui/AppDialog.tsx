"use client";

import { Modal } from "@lobehub/ui/base-ui";
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
  zIndex,
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
  return (
    <Modal
      className={cn(
        "!border-gray-200 !bg-white !shadow-[0_24px_80px_rgba(15,23,42,0.22)] dark:!border-white/15 dark:!bg-[#191919] dark:!shadow-[0_28px_90px_rgba(0,0,0,0.58)]",
        panelClassName,
      )}
      classNames={{
        body: cn("!p-0", bodyClassName),
        header: cn("border-b border-gray-100 dark:border-white/[0.08]", headerClassName),
        mask: cn("!bg-black/35 !backdrop-blur-sm", maskClassName),
        wrapper: wrapperClassName,
      }}
      closable={closable}
      draggable={false}
      footer={null}
      height={height}
      keyboard={!closeDisabled}
      maskClosable={!closeDisabled && maskClosable}
      onCancel={() => {
        if (!closeDisabled) onClose();
      }}
      open={open}
      title={title}
      width={width}
      zIndex={zIndex}
    >
      {children}
    </Modal>
  );
}
