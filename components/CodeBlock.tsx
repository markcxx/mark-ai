import React, { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  atomDark,
  coldarkCold,
  dracula,
  duotoneDark,
  duotoneLight,
  ghcolors,
  gruvboxDark,
  gruvboxLight,
  materialDark,
  materialLight,
  nightOwl,
  nord,
  oneDark,
  oneLight,
  solarizedDarkAtom,
  solarizedlight,
  vs,
  vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/useSettingsStore";

const countLines = (value: string) => (value.match(/\n/g)?.length || 0) + 1;

const normalizeLanguage = (language?: string) => {
  if (!language?.trim()) return "txt";
  return language.trim().toLowerCase();
};

type SyntaxTheme = Record<string, Record<string, string | number>>;

const normalizeThemeBackgrounds = (theme: SyntaxTheme): SyntaxTheme =>
  Object.fromEntries(
    Object.entries(theme).map(([selector, styles]) => {
      const { background, backgroundColor, ...rest } = styles;
      const resolvedBackground = backgroundColor || background;
      return [
        selector,
        resolvedBackground === undefined
          ? rest
          : {
              ...rest,
              backgroundColor: resolvedBackground === "none" ? "transparent" : resolvedBackground,
            },
      ];
    }),
  );

export const Pre = ({ children, language }: { children: string; language: string }) => {
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useTheme();
  const normalizedLanguage = normalizeLanguage(language);
  const lineCount = countLines(children.replace(/\n$/, ""));
  const settings = useSettingsStore((state) => state.general);
  const collapsible = settings.codeCollapseLines > 0 && lineCount > settings.codeCollapseLines;
  const [collapsed, setCollapsed] = useState(false);
  const isDark =
    settings.codeColorMode === "dark" ||
    (settings.codeColorMode === "auto" && resolvedTheme === "dark");
  const themePairs = {
    dracula: [duotoneLight, dracula],
    duotone: [duotoneLight, duotoneDark],
    github: [ghcolors, atomDark],
    gruvbox: [gruvboxLight, gruvboxDark],
    material: [materialLight, materialDark],
    "night-owl": [coldarkCold, nightOwl],
    nord: [coldarkCold, nord],
    one: [oneLight, oneDark],
    solarized: [solarizedlight, solarizedDarkAtom],
    vscode: [vs, vscDarkPlus],
  } as const;
  const syntaxTheme = normalizeThemeBackgrounds(
    themePairs[settings.codeTheme][isDark ? 1 : 0] as SyntaxTheme,
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              title={collapsed ? "展开代码" : "折叠代码"}
            >
              {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </span>
          )}
          <button
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
            title="复制代码"
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
        <SyntaxHighlighter
          language={normalizedLanguage}
          style={syntaxTheme as any}
          showLineNumbers={settings.codeLineNumbers}
          wrapLongLines={settings.codeWrap}
          customStyle={{ borderRadius: 0, margin: 0, padding: "1rem" }}
          lineNumberStyle={{
            color: isDark ? "#6e7681" : "#94a3b8",
            minWidth: "2.5em",
            paddingRight: "1em",
            textAlign: "right",
            userSelect: "none",
          }}
          PreTag="div"
        >
          {children.replace(/\n$/, "")}
        </SyntaxHighlighter>
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
