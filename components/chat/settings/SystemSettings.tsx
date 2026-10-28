"use client";
import { useState } from "react";
import { Download, ExternalLink, Github, Globe, RotateCcw } from "lucide-react";
import AppImage from "@/components/ui/AppImage";
import { AppNumberInput } from "@/components/ui/AppNumberInput";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { version } from "@/package.json";
import { SettingsButton, SettingsEmpty, SettingsGroup, SettingRow } from "./SettingsPrimitives";

export function AdvancedSettings() {
  const general = useSettingsStore((s) => s.general);
  const update = useSettingsStore((s) => s.updateGeneral);
  const saveState = useSettingsStore((s) => s.saveState);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <SettingsGroup title="工作区布局">
        <SettingRow title="侧栏默认宽度" description="单位：像素">
          <AppNumberInput
            aria-label="侧栏默认宽度"
            min={220}
            max={380}
            value={general.sidebarWidth}
            onChange={(value) => update({ sidebarWidth: Number(value) })}
            style={{ width: 110 }}
          />
        </SettingRow>
        <SettingRow title="预览面板默认宽度" description="占工作区的百分比">
          <AppNumberInput
            aria-label="预览面板默认宽度"
            min={30}
            max={70}
            value={general.previewWidth}
            onChange={(value) => update({ previewWidth: Number(value) })}
            style={{ width: 110 }}
          />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="恢复默认">
        <SettingRow
          title="重置个人偏好"
          description="恢复外观、对话、语音和个性化设置，不删除会话、文件或模型服务配置"
        >
          <SettingsButton
            className="text-red-600 dark:text-red-400"
            disabled={saveState === "saving"}
            onClick={() => setConfirm(true)}
          >
            <RotateCcw size={14} />
            恢复默认
          </SettingsButton>
        </SettingRow>
      </SettingsGroup>
      <ConfirmDialog
        open={confirm}
        title="恢复默认设置？"
        description="个人偏好将恢复为初始值。会话、文件与模型服务配置会保留。"
        confirmText="恢复默认"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          void useSettingsStore.getState().resetSettings();
        }}
      />
    </>
  );
}

export function AboutSettings() {
  return (
    <SettingsGroup title="关于 MarkAI">
      <div className="py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <AppImage src="/images/markai.svg" alt="MarkAI" width={48} height={48} />
            <div>
              <h3 className="font-jakarta text-2xl font-bold">MarkAI</h3>
              <span className="mt-2 inline-flex rounded-md bg-gray-100 px-2 py-0.5 font-jakarta text-xs text-gray-500 dark:bg-white/5">
                v{version}
              </span>
            </div>
          </div>
          <a
            href="/download"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm dark:border-white/10"
          >
            <Download size={15} />
            下载客户端
          </a>
        </div>
        <p className="my-5 text-sm leading-7 text-gray-500">
          MarkAI 是一个面向个人的 AI
          效能工作空间。将多模型对话、联网检索、文件处理与任务工具集中在同一个界面，让网页与 Android
          客户端共享会话和个人设置。
        </p>
        <div className="my-5 border-t border-gray-200 dark:border-white/10" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            { label: "项目源码", href: "https://github.com/markcxx/mark-ai", icon: Github },
            { label: "使用文档", href: "https://github.com/markcxx/mark-ai#readme", icon: Globe },
            { label: "客户端", href: "/download", icon: Download },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
            >
              <item.icon size={20} />
              {item.label}
            </a>
          ))}
        </div>
        <div className="my-5 border-t border-gray-200 dark:border-white/10" />
        <h4 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">反馈与帮助</h4>
        <div className="flex flex-wrap gap-6 text-sm text-gray-500">
          <a
            href="https://github.com/markcxx/mark-ai/issues"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1"
          >
            问题反馈
            <ExternalLink size={12} />
          </a>
          <a
            href="https://github.com/markcxx/mark-ai"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1"
          >
            项目主页
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </SettingsGroup>
  );
}

export function UnavailableSettings({
  section,
}: {
  section: "trash" | "apikey" | "oauth-apps" | "labs";
}) {
  const copy = {
    trash: {
      group: "已删除内容",
      title: "回收站尚未开放",
      description:
        "目前删除会话或文件是永久删除，已有删除记录无法从这里恢复。回收站开放后会显示可恢复的内容。",
      action: "恢复内容",
    },
    apikey: {
      group: "平台 API Key",
      title: "平台 API 尚未开放",
      description:
        "这里用于管理访问 MarkAI 的开发者密钥。模型服务商的 API 密钥请在「模型服务」中配置。",
      action: "创建 API Key",
    },
    "oauth-apps": {
      group: "OAuth 应用",
      title: "应用授权服务尚未开放",
      description: "开放后可在这里创建 OAuth 应用、配置回调地址并管理应用授权。",
      action: "创建应用",
    },
    labs: {
      group: "实验功能",
      title: "暂无开放中的实验",
      description: "可体验的新功能会在这里说明用途和影响，由你选择是否启用。",
      action: undefined,
    },
  }[section];
  return (
    <SettingsGroup title={copy.group}>
      <SettingsEmpty title={copy.title} description={copy.description}>
        {copy.action && <SettingsButton disabled>{copy.action}</SettingsButton>}
      </SettingsEmpty>
    </SettingsGroup>
  );
}
