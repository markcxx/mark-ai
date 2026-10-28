"use client";
import { Download, FolderOpen, Upload } from "lucide-react";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useSettingsResource } from "@/hooks/useSettingsResource";
import { createSettingsBackup, parseSettingsBackup } from "@/lib/settings/backup";
import type { MarkAISettings } from "@/lib/settings";
import { useSettingsStore } from "@/stores/useSettingsStore";
import {
  SettingsButton,
  SettingsError,
  SettingsGroup,
  SettingsSkeleton,
  SettingRow,
} from "./SettingsPrimitives";

type FileUsage = {
  usage: { count: number; size: number };
  limits: { maxStorageBytes: number | null; maxFileBytes: number };
};
const size = (bytes: number) =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(2)} GB`
    : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
export function StorageSettings({ onOpenFiles }: { onOpenFiles: () => void }) {
  const { data, error, loading, retry } = useSettingsResource<FileUsage>("/api/files");
  const input = useRef<HTMLInputElement>(null);
  const [imported, setImported] = useState<MarkAISettings | null>(null);
  const exportSettings = () => {
    const state = useSettingsStore.getState();
    const backup = createSettingsBackup({
      general: state.general,
      languageModel: state.languageModel,
      speech: state.speech,
    });
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `markai-settings-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <SettingsGroup title="文件存储">
        {error ? (
          <div className="py-4">
            <SettingsError message={error} onRetry={retry} />
          </div>
        ) : loading || !data ? (
          <div className="py-4">
            <SettingsSkeleton />
          </div>
        ) : (
          <>
            <SettingRow
              title="已使用空间"
              description={`${data.usage.count} 个文件 · 单个文件上限 ${size(data.limits.maxFileBytes)}`}
            >
              <span className="text-sm tabular-nums">
                {size(data.usage.size)} /{" "}
                {data.limits.maxStorageBytes === null
                  ? "不限总量"
                  : size(data.limits.maxStorageBytes)}
              </span>
            </SettingRow>
            {data.limits.maxStorageBytes !== null && (
              <div
                className="my-4 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10"
                role="progressbar"
                aria-label="存储空间使用比例"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(
                  100,
                  Math.round((data.usage.size / Math.max(1, data.limits.maxStorageBytes)) * 100),
                )}
              >
                <div
                  className="h-full bg-gray-700 dark:bg-gray-300"
                  style={{
                    width: `${Math.min(100, (data.usage.size / Math.max(1, data.limits.maxStorageBytes)) * 100)}%`,
                  }}
                />
              </div>
            )}
          </>
        )}
        <SettingRow title="管理文件" description="查看、预览、下载或删除已上传的文件">
          <SettingsButton onClick={onOpenFiles}>
            <FolderOpen size={15} />
            打开文件管理
          </SettingsButton>
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup
        title="设置备份"
        description="包含外观、对话、语音和自定义指令，不包含 API 密钥、聊天记录与上传文件。"
      >
        <SettingRow title="导出设置">
          <SettingsButton onClick={exportSettings}>
            <Download size={15} />
            导出 JSON
          </SettingsButton>
        </SettingRow>
        <SettingRow title="导入设置" description="导入前会请求确认，替换当前个人偏好">
          <SettingsButton onClick={() => input.current?.click()}>
            <Upload size={15} />
            选择文件
          </SettingsButton>
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              try {
                if (file.size > 256 * 1024) throw new Error("设置文件不能超过 256 KB");
                setImported(parseSettingsBackup(await file.text()));
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "导入失败");
              }
            }}
          />
        </SettingRow>
      </SettingsGroup>
      <ConfirmDialog
        open={Boolean(imported)}
        title="导入这份设置？"
        description="当前外观、对话、语音和个性化偏好将被替换，聊天记录不会改变。"
        confirmText="导入设置"
        onCancel={() => setImported(null)}
        onConfirm={() => {
          if (!imported) return;
          const store = useSettingsStore.getState();
          store.updateGeneral(imported.general);
          store.updateLanguageModel(imported.languageModel);
          store.updateSpeech(imported.speech);
          setImported(null);
          toast.success("设置已导入");
        }}
      />
    </>
  );
}
