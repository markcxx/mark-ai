"use client";

import dynamic from "next/dynamic";
import {
  CODE_THEMES,
  MERMAID_PALETTES,
  type MermaidTheme,
} from "@/lib/visualization/theme-catalog";

const CodeThemePreview = dynamic(() => import("./CodeThemePreview"), { ssr: false });
const DiagramThemePreview = dynamic(() => import("./DiagramThemePreview"), { ssr: false });

import { SettingRow, SettingsGroup } from "./SettingsPrimitives";
import { ThemeModeChoices } from "./ThemeModeChoices";

import { Check } from "lucide-react";
import { useTheme } from "next-themes";

import { AppSelect } from "@/components/ui/AppSelect";
import { AppNumberInput } from "@/components/ui/AppNumberInput";
import { AppSliderWithInput } from "@/components/ui/AppSliderWithInput";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { ModelSelect } from "../ModelSelect";
import { isImageGenerationModel } from "@/lib/chat/image-models";
import { SPEECH_VOICES, SYSTEM_SPEECH_VOICE } from "@/lib/chat/speech-voices";
import type { CodeTheme, PrimaryColor } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUIStore } from "@/stores/useUIStore";

const primaryColors: Array<{ color: string; id: PrimaryColor; label: string }> = [
  { id: "black", color: "#111827", label: "黑色" },
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
  { id: "duotone", label: "Duotone" },
  ...CODE_THEMES,
];

export function AppearanceSettings() {
  const general = useSettingsStore((state) => state.general);
  const update = useSettingsStore((state) => state.updateGeneral);
  const { setTheme } = useTheme();

  return (
    <div>
      <SettingsGroup title="界面外观">
        <SettingRow description="可跟随操作系统自动切换" title="主题模式">
          <ThemeModeChoices
            value={general.themeMode}
            onChange={(themeMode) => {
              update({ themeMode });
              setTheme(themeMode);
            }}
          />
        </SettingRow>
        <SettingRow description="用于按钮、链接和交互高亮" title="主题色">
          <div className="flex flex-wrap justify-end gap-2">
            {primaryColors.map((item) => (
              <button
                aria-label={item.label}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 ring-offset-white transition-transform hover:scale-110 dark:ring-offset-gray-900",
                  general.primaryColor === item.id && "ring-2 ring-gray-400 dark:ring-gray-500",
                )}
                key={item.id}
                onClick={() => update({ primaryColor: item.id })}
                style={{ backgroundColor: item.color }}
                data-markai-tooltip={item.label}
                type="button"
              >
                {general.primaryColor === item.id && <Check className="text-white" size={14} />}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow description="影响 AI 回复正文，不影响导航栏" title="对话字号">
          <AppSliderWithInput
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
      </SettingsGroup>
      <SettingsGroup title="代码与图表" description="预览与对话中的显示效果同步更新">
        <SettingRow description="下方预览与对话代码块同步更新" title="代码高亮主题">
          <AppSelect
            aria-label="代码高亮主题"
            onChange={(value) => {
              if (typeof value === "string") update({ codeTheme: value as CodeTheme });
            }}
            options={codeThemes.map((item) => ({ label: item.label, value: item.id }))}
            value={general.codeTheme}
          />
        </SettingRow>
        <div className="py-4">
          <CodeThemePreview />
        </div>
        <SettingRow
          description="适用于 One、VS Code 等自适应主题；其他主题使用各自的明暗配色"
          title="代码块明暗模式"
        >
          <AppSelect
            disabled={
              !["one", "vscode", "material", "gruvbox", "solarized", "github", "duotone"].includes(
                general.codeTheme,
              )
            }
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
          <AppNumberInput
            max={100}
            min={0}
            onChange={(value) => update({ codeCollapseLines: Number(value) })}
            style={{ width: 100 }}
            value={general.codeCollapseLines}
          />
        </SettingRow>
        <SettingRow title="Mermaid 图表主题" description="应用于流程图、时序图、脑图及导出图片">
          <AppSelect
            aria-label="Mermaid 图表主题"
            value={general.mermaidTheme}
            onChange={(value) => update({ mermaidTheme: value as MermaidTheme })}
            options={[
              { label: "跟随界面", value: "auto" },
              ...Object.keys(MERMAID_PALETTES).map((id) => ({
                value: id,
                label: id
                  .split("-")
                  .map((word) => word[0].toUpperCase() + word.slice(1))
                  .join(" "),
              })),
            ]}
          />
        </SettingRow>
        <DiagramThemePreview />
      </SettingsGroup>
    </div>
  );
}

export function ChatSettings() {
  const general = useSettingsStore((state) => state.general);
  const update = useSettingsStore((state) => state.updateGeneral);

  return (
    <SettingsGroup title="对话行为">
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
      <SettingRow description="关闭后，重新生成会保留旧回答并提供版本切换" title="覆盖旧回答">
        <ToggleSwitch
          checked={general.overwriteRegeneratedResponse}
          onChange={(overwriteRegeneratedResponse) => update({ overwriteRegeneratedResponse })}
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
      <SettingRow title="默认宽屏对话">
        <ToggleSwitch
          checked={general.wideChatMode}
          onChange={(wideChatMode) => update({ wideChatMode })}
        />
      </SettingRow>
    </SettingsGroup>
  );
}

export function SpeechSettings() {
  const speech = useSettingsStore((state) => state.speech);
  const update = useSettingsStore((state) => state.updateSpeech);

  return (
    <SettingsGroup title="语音朗读">
      <SettingRow description="用于消息语音朗读，修改后会自动保存" title="默认音色">
        <AppSelect
          classNames={{ item: "min-h-9", list: "max-h-[min(480px,var(--available-height))]" }}
          onChange={(value) => {
            if (typeof value === "string") update({ voice: value as typeof speech.voice });
          }}
          options={[
            { label: "系统默认", value: SYSTEM_SPEECH_VOICE },
            ...SPEECH_VOICES.map((voice) => ({
              label: `${voice.label} · ${voice.value}`,
              value: voice.value,
            })),
          ]}
          size="large"
          value={speech.voice}
        />
      </SettingRow>
    </SettingsGroup>
  );
}

export function ServiceModelSettings() {
  const general = useSettingsStore((state) => state.general);
  const update = useSettingsStore((state) => state.updateGeneral);
  const availableModels = useUIStore((state) => state.availableModels);
  const providerNames = useUIStore((state) => state.providerNames);
  const loading = useUIStore((state) => state.isLoadingModels);
  return (
    <SettingsGroup title="辅助模型" description="用于对话之外的辅助任务，不会替换当前聊天模型。">
      <SettingRow
        description="系统默认由服务端配置；也可以跟随消息或固定到指定模型"
        title="翻译模型"
      >
        <ModelSelect
          label="翻译模型"
          value={general.translationModelKey}
          onChange={(translationModelKey) => update({ translationModelKey })}
          models={availableModels.filter((model) => !isImageGenerationModel(model.id))}
          providerNames={providerNames}
          loading={loading}
          options={[
            { key: "__system__", label: "系统默认", description: "使用服务端配置的翻译模型" },
            { key: "", label: "跟随消息模型", description: "使用生成原消息的模型" },
          ]}
        />
      </SettingRow>
    </SettingsGroup>
  );
}

export function HotkeySettings() {
  const general = useSettingsStore((state) => state.general);
  const update = useSettingsStore((state) => state.updateGeneral);
  return (
    <>
      <SettingsGroup title="自定义快捷键">
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
        <SettingRow description="Windows 和 Linux 使用 Ctrl，macOS 使用 Cmd" title="命令中心快捷键">
          <AppSelect
            onChange={(value) => {
              if (typeof value === "string") {
                update({
                  commandCenterShortcut: value as typeof general.commandCenterShortcut,
                });
              }
            }}
            options={[
              { label: "Ctrl / Cmd + K", value: "mod-k" },
              { label: "Ctrl / Cmd + Shift + K", value: "mod-shift-k" },
              { label: "Ctrl / Cmd + /", value: "mod-slash" },
            ]}
            value={general.commandCenterShortcut}
          />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="基础操作">
        <SettingRow title="输入换行">
          <kbd className="text-xs text-gray-500">Shift + Enter</kbd>
        </SettingRow>
        <SettingRow title="关闭弹窗">
          <kbd className="text-xs text-gray-500">Esc</kbd>
        </SettingRow>
        <SettingRow title="移动焦点">
          <kbd className="text-xs text-gray-500">Tab / Shift + Tab</kbd>
        </SettingRow>
      </SettingsGroup>
    </>
  );
}
