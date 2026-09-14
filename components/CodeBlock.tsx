import { resolveCodeTheme } from "@/lib/code/themes";
import React, { useEffect, useState } from "react";
import { ShikiCode } from "./ShikiCode";
import { Check, ChevronDown, ChevronUp, Copy, Download, WrapText } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/useSettingsStore";

const countLines = (value: string) => (value.match(/\n/g)?.length || 0) + 1;

const normalizeLanguage = (language?: string) => {
  if (!language?.trim()) return "txt";
  return language.trim().toLowerCase();
};

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  bash: "sh",
  csharp: "cs",
  css: "css",
  html: "html",
  javascript: "js",
  js: "js",
  json: "json",
  jsx: "jsx",
  markdown: "md",
  md: "md",
  python: "py",
  shell: "sh",
  sql: "sql",
  ts: "ts",
  tsx: "tsx",
  typescript: "ts",
  xml: "xml",
  yaml: "yaml",
  yml: "yml",
};

export const Pre = ({ children, language }: { children: string; language: string }) => {
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useTheme();
  const normalizedLanguage = normalizeLanguage(language);
  const lineCount = countLines(children.replace(/\n$/, ""));
  const settings = useSettingsStore((state) => state.general);
  const [wrapLongLines, setWrapLongLines] = useState(settings.codeWrap);
  useEffect(() => setWrapLongLines(settings.codeWrap), [settings.codeWrap]);
  const collapsible = settings.codeCollapseLines > 0 && lineCount > settings.codeCollapseLines;
  const [collapsed, setCollapsed] = useState(false);
  const isDark =
    settings.codeColorMode === "dark" ||
    (settings.codeColorMode === "auto" && resolvedTheme === "dark");
  const syntaxTheme = resolveCodeTheme(settings.codeTheme, isDark);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const extension = LANGUAGE_EXTENSIONS[normalizedLanguage] || normalizedLanguage || "txt";
    const blob = new Blob([children], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `code.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={cn(
        "group relative my-5 overflow-hidden rounded-xl border shadow-sm",
        isDark ? "border-white/10 bg-[#0d1117] shadow-none" : "border-gray-200 bg-[#f8f9fa]",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-full items-center justify-between px-3 text-left transition-colors",
          isDark ? "bg-[#161b22]" : "bg-white/80",
          !collapsed && (isDark ? "border-b border-white/10" : "border-b border-gray-200/80"),
          collapsible &&
            (isDark ? "cursor-pointer hover:bg-white/[0.06]" : "cursor-pointer hover:bg-gray-50"),
        )}
        onClick={() => {
          if (collapsible) setCollapsed((value) => !value);
        }}
        onKeyDown={(event) => {
          if (!collapsible) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setCollapsed((value) => !value);
          }
        }}
        role={collapsible ? "button" : undefined}
        tabIndex={collapsible ? 0 : undefined}
      >
        <span
          className={cn(
            "rounded-md px-2 py-1 font-jakarta text-xs font-medium uppercase",
            isDark ? "bg-white/[0.06] text-gray-300" : "bg-gray-100 text-gray-500",
          )}
        >
          {normalizedLanguage}
        </span>
        <div className="flex items-center gap-1">
          {collapsible && (
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                isDark
                  ? "text-gray-400 hover:bg-white/[0.08] hover:text-gray-100"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
              )}
              aria-label={collapsed ? "展开代码" : "折叠代码"}
              data-markai-tooltip={collapsed ? "展开代码" : "折叠代码"}
            >
              {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </span>
          )}
          <button
            aria-label={wrapLongLines ? "关闭自动换行" : "开启自动换行"}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              wrapLongLines
                ? "bg-primary/10 text-primary"
                : isDark
                  ? "text-gray-400 hover:bg-white/[0.08] hover:text-gray-100"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
            )}
            data-markai-tooltip={wrapLongLines ? "关闭自动换行" : "开启自动换行"}
            onClick={(event) => {
              event.stopPropagation();
              setWrapLongLines((value) => !value);
            }}
            type="button"
          >
            <WrapText size={14} />
          </button>
          <button
            aria-label="下载代码"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              isDark
                ? "text-gray-400 hover:bg-white/[0.08] hover:text-gray-100"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
            )}
            data-markai-tooltip="下载代码"
            onClick={(event) => {
              event.stopPropagation();
              handleDownload();
            }}
            type="button"
          >
            <Download size={14} />
          </button>
          <button
            aria-label="复制代码"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              isDark
                ? "text-gray-400 hover:bg-white/[0.08] hover:text-gray-100"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
            )}
            onClick={(event) => {
              event.stopPropagation();
              handleCopy();
            }}
            data-markai-tooltip="复制代码"
            type="button"
          >
            {copied ? <Check className="text-green-600" size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>
      <div
        className={cn(
          "relative overflow-x-auto font-mono text-[13px] leading-relaxed transition-[max-height] duration-200 ease-out",
          collapsed && "max-h-0 overflow-hidden",
        )}
      >
        <ShikiCode
          code={children.replace(/\n$/, "")}
          language={normalizedLanguage}
          theme={syntaxTheme}
          lineNumbers={settings.codeLineNumbers}
          wrap={wrapLongLines}
        />
      </div>
    </div>
  );
};

export const PreSingleLine = ({ children }: { children: React.ReactNode }) => {
  return (
    <code className="px-1.5 py-0.5 mx-0.5 rounded-md bg-[#f3f4f5] text-gray-800 text-[13px] font-mono border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
      {children}
    </code>
  );
};
