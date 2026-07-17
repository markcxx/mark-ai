"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type MessageActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  danger?: boolean;
  icon: LucideIcon;
  size?: number;
};

export const MessageActionButton = forwardRef<HTMLButtonElement, MessageActionButtonProps>(
  function MessageActionButton(
    { className, danger, icon: Icon, size = 15, type = "button", ...props },
    ref,
  ) {
    return (
      <button
        className={cn(
          "flex items-center justify-center rounded-md p-1.5 text-gray-400 transition-colors",
          danger
            ? "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            : "hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-200",
          className,
        )}
        ref={ref}
        type={type}
        {...props}
      >
        <Icon size={size} />
      </button>
    );
  },
);
