"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const inputClassName =
  "h-8 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm outline-none transition-[border-color,box-shadow,background-color] placeholder:text-gray-400 hover:border-gray-400 focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:border-white/[0.16] dark:bg-white/[0.06] dark:text-gray-100 dark:shadow-none dark:placeholder:text-gray-500 dark:hover:border-white/25 dark:focus:border-white/30 dark:focus:ring-white/[0.08] dark:disabled:bg-white/[0.035]";

export const AppInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function AppInput({ className, ...props }, ref) {
    return <input className={cn(inputClassName, className)} ref={ref} {...props} />;
  },
);

export const AppPasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type">
>(function AppPasswordInput({ className, disabled, ...props }, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <span className={cn("relative block", className)}>
      <input
        className={cn(inputClassName, "pr-9")}
        disabled={disabled}
        ref={ref}
        type={visible ? "text" : "password"}
        {...props}
      />
      <button
        aria-label={visible ? "隐藏密码" : "显示密码"}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-gray-400 transition-colors hover:text-gray-600 disabled:pointer-events-none disabled:opacity-40 dark:hover:text-gray-200"
        disabled={disabled}
        onClick={() => setVisible((current) => !current)}
        type="button"
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </span>
  );
});

export const AppTextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function AppTextArea({ className, ...props }, ref) {
  return (
    <textarea
      className={cn(
        inputClassName,
        "h-auto min-h-20 resize-y py-2 leading-5",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});

