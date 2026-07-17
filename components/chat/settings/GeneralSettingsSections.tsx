"use client";

import { InputNumber, SliderWithInput } from "@lobehub/ui";
import { Check } from "lucide-react";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";

import { AppSelect } from "@/components/ui/AppSelect";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import type { CodeTheme, PrimaryColor } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/useSettingsStore";

const primaryColors: Array<{ color: string; id: PrimaryColor; label: string }> = [
  { id: "blue", color: "#2563eb", label: "蓝色" },
  { id: "indigo", color: "#4f46e5", label: "靛青" },
  { id: "violet", color: "#7c3aed", label: "紫色" },
  { id: "magenta", color: "#c026d3", label: "洋红" },
  { id: "red", color: "#dc2626", label: "红色" },
  { id: "orange", color: "#ea580c", label: "橙色" },
  { id: "green", color: "#16a34a", label: "绿色" },
  { id: "cyan", color: "#0891b2", label: "青色" },
];

const codeThemes: Array<{ id: CodeTheme; label: string }> = [
  { id: "one", label: "One" },
  { id: "vscode", label: "VS Code" },
  { id: "material", label: "Material" },
  { id: "gruvbox", label: "Gruvbox" },
  { id: "solarized", label: "Solarized" },
  { id: "github", label: "GitHub" },
  { id: "dracula", label: "Dracula" },
  { id: "night-owl", label: "Night Owl" },
  { id: "nord", label: "Nord" },
  { id: "duotone", label: "Duotone" },
];

function SettingRow({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-100 py-4 last:border-0 dark:border-white/[0.07] sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 pr-4">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</div>
        {description && (
          <div className="mt-1 text-xs leading-relaxed text-gray-400">{description}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function AppearanceSettings() {
  const general = useSettingsStore((state) => state.general);
  const update = useSettingsStore((state) => state.updateGeneral);
  const { setTheme } = useTheme();

  return (
    <div>
      <SettingRow description="可跟随操作系统自动切换" title="主题模式">
        <AppSelect
          onChange={(value) => {
            if (typeof value !== "string") return;
            const themeMode = value as typeof general.themeMode;
            update({ themeMode });
            setTheme(themeMode);
          }}
          options={[
            { label: "跟随系统", value: "system" },
            { label: "亮色", value: "light" },
            { label: "暗色", value: "dark" },
          ]}
          value={general.themeMode}
        />
      </SettingRow>
      <SettingRow description="用于按钮、链接和交互高亮" title="主题色">
        <div className="flex flex-wrap justify-end gap-2">
          {primaryColors.map((item) => (
            <button
              aria-label={item.label}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 ring-offset-white transition-transform hover:scale-110 dark:ring-offset-gray-900",
                general.primaryColor === item.id && "ring-2 ring-gray-400 dark:ring-gray-500",
              )}
              key={item.id}
              onClick={() => update({ primaryColor: item.id })}
              style={{ backgroundColor: item.color }}
              title={item.label}
              type="button"
            >
              {general.primaryColor === item.id && <Check className="text-white" size={14} />}
            </button>
          ))}
        </div>
      </SettingRow>
      <SettingRow description="影响 AI 回复正文，不影响导航栏" title="对话字号">
        <SliderWithInput
          max={20}
          min={12}
          onChange={(value) => update({ chatFontSize: Number(value) })}
          style={{ width: 240 }}
          value={general.chatFontSize}
        />
      </SettingRow>
      <SettingRow title="界面密度">
        <AppSelect
          onChange={(value) => {
            if (typeof value === "string") update({ density: value as typeof general.density });
          }}
          options={[
            { label: "紧凑", value: "compact" },
            { label: "默认", value: "comfortable" },
            { label: "宽松", value: "spacious" },
          ]}
          value={general.density}
        />
      </SettingRow>
      <SettingRow description="关闭大部分装饰性动画" title="减少动画">
        <ToggleSwitch
          checked={general.reduceMotion}
          onChange={(reduceMotion) => update({ reduceMotion })}
        />
      </SettingRow>
      <SettingRow description="代码主题会自动匹配亮色和暗色模式" title="代码高亮主题">
        <AppSelect
          onChange={(value) => {
            if (typeof value === "string") update({ codeTheme: value as CodeTheme });
          }}
          options={codeThemes.map((item) => ({ label: item.label, value: item.id }))}
          value={general.codeTheme}
        />
      </SettingRow>
      <SettingRow description="可在亮色界面中固定使用暗色代码块，或反过来" title="代码块明暗模式">
        <AppSelect
          onChange={(value) => {
            if (typeof value === "string") {
              update({ codeColorMode: value as typeof general.codeColorMode });
            }
          }}
          options={[
            { label: "跟随界面", value: "auto" },
            { label: "固定亮色", value: "light" },
            { label: "固定暗色", value: "dark" },
          ]}
          value={general.codeColorMode}
        />
      </SettingRow>
      <SettingRow title="显示代码行号">
        <ToggleSwitch
          checked={general.codeLineNumbers}
          onChange={(codeLineNumbers) => update({ codeLineNumbers })}
        />
      </SettingRow>
      <SettingRow title="代码自动换行">
        <ToggleSwitch checked={general.codeWrap} onChange={(codeWrap) => update({ codeWrap })} />
      </SettingRow>
      <SettingRow description="设为 0 表示永不自动折叠" title="长代码折叠阈值">
        <InputNumber
          max={100}
          min={0}
          onChange={(value) => update({ codeCollapseLines: Number(value) })}
          style={{ width: 100 }}
          value={general.codeCollapseLines}
        />
      </SettingRow>
    </div>
  );
}

export function ChatSettings() {
  const general = useSettingsStore((state) => state.general);
  const update = useSettingsStore((state) => state.updateGeneral);

  return (
    <div>
      <SettingRow title="流式输出自动滚动">
        <ToggleSwitch
          checked={general.autoScroll}
          onChange={(autoScroll) => update({ autoScroll })}
        />
      </SettingRow>
      <SettingRow title="回复动画">
        <AppSelect
          onChange={(value) => {
            if (typeof value === "string") {
              update({ responseAnimation: value as typeof general.responseAnimation });
            }
          }}
          options={[
            { label: "关闭", value: "none" },
            { label: "淡入", value: "fade" },
            { label: "平滑", value: "smooth" },
          ]}
          value={general.responseAnimation}
        />
      </SettingRow>
      <SettingRow description="“自动”会在生成时展开，结束后保留面板" title="思考面板">
        <AppSelect
          onChange={(value) => {
            if (typeof value === "string") {
              update({ thinkingDisplay: value as typeof general.thinkingDisplay });
            }
          }}
          options={[
            { label: "自动", value: "auto" },
            { label: "默认折叠", value: "collapsed" },
            { label: "始终展开", value: "expanded" },
          ]}
          value={general.thinkingDisplay}
        />
      </SettingRow>
      <SettingRow title="显示 Token 与耗时统计">
        <ToggleSwitch
          checked={general.showMessageStats}
          onChange={(showMessageStats) => update({ showMessageStats })}
        />
      </SettingRow>
      <SettingRow title="默认启用联网搜索">
        <ToggleSwitch
          checked={general.defaultWebSearch}
          onChange={(defaultWebSearch) => update({ defaultWebSearch })}
        />
      </SettingRow>
      <SettingRow title="发送快捷键">
        <AppSelect
          onChange={(value) => {
            if (typeof value === "string") {
              update({ sendShortcut: value as typeof general.sendShortcut });
            }
          }}
          options={[
            { label: "Enter 发送", value: "enter" },
            { label: "Ctrl / Cmd + Enter", value: "mod-enter" },
          ]}
          value={general.sendShortcut}
        />
      </SettingRow>
      <SettingRow title="默认宽屏对话">
        <ToggleSwitch
          checked={general.wideChatMode}
          onChange={(wideChatMode) => update({ wideChatMode })}
        />
      </SettingRow>
    </div>
  );
}
