"use client";

import {
  ChevronRight,
  KeyRound,
  Palette,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { AppDialog } from "@/components/ui/AppDialog";
import { AppInput, AppPasswordInput, AppTextArea } from "@/components/ui/AppInput";
import { MODEL_PROVIDER_TEMPLATES } from "@/lib/model-provider-registry";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUIStore } from "@/stores/useUIStore";

import { ProviderBrandIcon } from "./ModelBrandIcon";
import { SidebarNavItem } from "./SidebarNavItem";
import { AppearanceSettings, ChatSettings } from "./settings/GeneralSettingsSections";

type SettingsSection = "appearance" | "chat" | "providers";
type ProviderTemplate = {
  defaultBaseUrl: string;
  defaultModels: string[];
  description: string;
  id: string;
  name: string;
  runtime: "gemini" | "openai-compatible";
};
type UserProvider = {
  baseUrl: string;
  enabled: boolean;
  hasApiKey: boolean;
  id: string;
  isCustom: boolean;
  models: string[];
  name: string;
  provider: string;
  runtime: "gemini" | "openai-compatible";
};
type SiteProvider = {
  models: string[];
  name: string;
  provider: string;
};
type ProviderForm = {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  models: string;
  name: string;
  provider: string;
  runtime: "gemini" | "openai-compatible";
};

const sections: Array<{ id: SettingsSection; icon: typeof Palette; label: string }> = [
  { id: "appearance", icon: Palette, label: "外观" },
  { id: "chat", icon: SlidersHorizontal, label: "对话" },
  { id: "providers", icon: KeyRound, label: "AI 提供商" },
];

function ProviderLogo({
  disabled = false,
  name,
  provider,
}: {
  disabled?: boolean;
  name: string;
  provider: string;
}) {
  if (provider === "markai") {
    return (
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/5",
          disabled && "opacity-45",
        )}
      >
        <Image alt="MarkAI" height={28} src="/images/markai.svg" width={28} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-800 dark:bg-white/[0.06] dark:text-gray-100",
        disabled && "opacity-45",
      )}
    >
      <ProviderBrandIcon className="text-sm" name={name} provider={provider} size={23} />
    </div>
  );
}

const readResponse = async (response: Response) => {
  const text = await response.text();
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!response.ok) {
    throw new Error(data.error || data.detail || `请求失败 (${response.status})`);
  }
  return data;
};

function ProviderSettings() {
  const [templates, setTemplates] = useState<ProviderTemplate[]>(MODEL_PROVIDER_TEMPLATES);
  const [providers, setProviders] = useState<UserProvider[]>([]);
  const [siteProviders, setSiteProviders] = useState<SiteProvider[]>([]);
  const [cloudPersistence, setCloudPersistence] = useState(true);
  const [form, setForm] = useState<ProviderForm | null>(null);
  const [removeTarget, setRemoveTarget] = useState<UserProvider | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingProvider, setTogglingProvider] = useState<string | null>(null);

  const load = async () => {
    const response = await fetch("/api/model-providers", { cache: "no-store" });
    const data = await readResponse(response);
    setTemplates(data.templates || []);
    setProviders(data.providers || []);
    setSiteProviders(data.siteProviders || []);
    setCloudPersistence(Boolean(data.cloudPersistence));
  };
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/model-providers", { cache: "no-store" })
      .then(readResponse)
      .then((data) => {
        if (cancelled) return;
        setTemplates(data.templates || []);
        setProviders(data.providers || []);
        setSiteProviders(data.siteProviders || []);
        setCloudPersistence(Boolean(data.cloudPersistence));
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "加载提供商失败"));
    return () => {
      cancelled = true;
    };
  }, []);

  const configuredIds = useMemo(() => new Set(providers.map((item) => item.provider)), [providers]);
  const providerMap = useMemo(
    () => new Map(providers.map((item) => [item.provider, item])),
    [providers],
  );
  const siteProviderMap = useMemo(
    () => new Map(siteProviders.map((item) => [item.provider, item])),
    [siteProviders],
  );
  const editProvider = (provider: UserProvider) =>
    setForm({
      apiKey: "",
      baseUrl: provider.baseUrl,
      enabled: provider.enabled,
      models: provider.models.join("\n"),
      name: provider.name,
      provider: provider.provider,
      runtime: provider.runtime,
    });
  const configureTemplate = (template: ProviderTemplate) =>
    setForm({
      apiKey: "",
      baseUrl: template.defaultBaseUrl,
      enabled: true,
      models: (siteProviderMap.get(template.id)?.models || template.defaultModels).join("\n"),
      name: template.name,
      provider: template.id,
      runtime: template.runtime,
    });

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const response = await fetch("/api/model-providers", {
        body: JSON.stringify({ ...form, models: form.models.split(/[\n,]/) }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const data = await readResponse(response);
      setProviders(data.providers || []);
      setForm(null);
      await useUIStore.getState().loadModels();
      toast.success("模型提供商已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (provider: string) => {
    try {
      const response = await fetch(
        `/api/model-providers?provider=${encodeURIComponent(provider)}`,
        { method: "DELETE" },
      );
      await readResponse(response);
      await load();
      await useUIStore.getState().loadModels();
      toast.success(siteProviderMap.has(provider) ? "已恢复默认配置" : "提供商已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const toggleProvider = async (provider: string, enabled: boolean) => {
    const template = templates.find((item) => item.id === provider);
    const configured = providerMap.get(provider);
    const site = siteProviderMap.get(provider);
    if (enabled && !site && !configured?.hasApiKey) {
      if (template) configureTemplate(template);
      else toast.error("请先配置这个提供商");
      return;
    }

    setTogglingProvider(provider);
    try {
      const response = await fetch("/api/model-providers", {
        body: JSON.stringify({ enabled, provider }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const data = await readResponse(response);
      setProviders(data.providers || []);
      await useUIStore.getState().loadModels();
      toast.success(enabled ? "提供商已启用" : "提供商已关闭");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新失败");
    } finally {
      setTogglingProvider(null);
    }
  };

  const toggleCustomProvider = async (provider: UserProvider, enabled: boolean) => {
    setTogglingProvider(provider.provider);
    try {
      const response = await fetch("/api/model-providers", {
        body: JSON.stringify({ ...provider, apiKey: "", enabled }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const data = await readResponse(response);
      setProviders(data.providers || []);
      await useUIStore.getState().loadModels();
      toast.success(enabled ? "提供商已启用" : "提供商已关闭");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新失败");
    } finally {
      setTogglingProvider(null);
    }
  };

  if (form) {
    const exists = configuredIds.has(form.provider);
    const currentProvider = providerMap.get(form.provider);
    const canRestoreSite = Boolean(
      currentProvider && !currentProvider.isCustom && siteProviderMap.has(form.provider),
    );
    return (
      <>
        <div className="space-y-4 py-4">
          <button
            className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
            onClick={() => setForm(null)}
            type="button"
          >
            ← 返回 AI 提供商
          </button>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              显示名称
              <AppInput
                className="mt-2"
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                value={form.name}
              />
            </label>
            <label className="text-sm">
              提供商 ID
              <AppInput
                className="mt-2"
                disabled={exists || Boolean(templates.find((item) => item.id === form.provider))}
                onChange={(event) =>
                  setForm({
                    ...form,
                    provider: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                  })
                }
                value={form.provider}
              />
            </label>
          </div>
          <label className="block text-sm">
            Base URL
            <AppInput
              className="mt-2"
              onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
              value={form.baseUrl}
            />
          </label>
          <label className="block text-sm">
            API Key
            <AppPasswordInput
              autoComplete="off"
              className="mt-2"
              onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
              placeholder={
                currentProvider?.hasApiKey ? "留空表示保留现有 API Key" : "请输入 API Key"
              }
              value={form.apiKey}
            />
          </label>
          <label className="block text-sm">
            模型 ID（每行一个，也支持逗号分隔）
            <AppTextArea
              className="mt-2 font-mono"
              onChange={(event) => setForm({ ...form, models: event.target.value })}
              rows={7}
              value={form.models}
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-3 text-sm">
              <ToggleSwitch
                checked={form.enabled}
                onChange={(enabled) => setForm({ ...form, enabled })}
              />
              启用此提供商
            </label>
            <div className="flex items-center justify-end gap-2">
              {canRestoreSite && (
                <button
                  className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.07]"
                  onClick={() => currentProvider && setRemoveTarget(currentProvider)}
                  type="button"
                >
                  恢复默认配置
                </button>
              )}
              <button
                className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={saving}
                onClick={save}
                type="button"
              >
                {saving ? "保存中…" : "保存配置"}
              </button>
            </div>
          </div>
        </div>
        <ConfirmDialog
          confirmText="恢复"
          description="用户填写的 Base URL、API Key 和模型列表会被删除，此后将重新使用默认配置。"
          onCancel={() => setRemoveTarget(null)}
          onConfirm={() => {
            if (removeTarget) void remove(removeTarget.provider);
            setRemoveTarget(null);
            setForm(null);
          }}
          open={Boolean(removeTarget)}
          title="恢复默认配置？"
        />
      </>
    );
  }

  const markAIProvider = siteProviderMap.get("markai");
  const markAIConfiguration = providerMap.get("markai");
  const markAIEnabled = Boolean(markAIProvider) && markAIConfiguration?.enabled !== false;

  return (
    <div className="py-4">
      {!cloudPersistence && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          当前为本地 SQLite 模式：可以使用管理员预置的模型；登录云端模式后，可保存自己的 API Key
          并覆盖同名提供商。
        </div>
      )}
      <div className="mb-6 rounded-2xl border border-primary/15 bg-primary/[0.035] p-4 dark:bg-primary/[0.06]">
        <div className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-primary">
          MarkAI
        </div>
        <div className="flex items-center gap-3">
          <ProviderLogo disabled={!markAIEnabled} name="MarkAI" provider="markai" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-gray-950 dark:text-white">
              MarkAI 模型服务
            </div>
            <div className="mt-1 text-xs text-gray-400">
              {markAIProvider
                ? `${markAIProvider.models.length} 个专属模型可用`
                : "暂未配置可用模型"}
            </div>
          </div>
          <ToggleSwitch
            checked={markAIEnabled}
            disabled={!cloudPersistence || !markAIProvider || togglingProvider === "markai"}
            onChange={(next) => void toggleProvider("markai", next)}
          />
        </div>
      </div>
      <div className="mb-3">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">内置 AI 提供商</div>
        <div className="mt-1 text-xs text-gray-400">
          每个提供商都可以独立启用、关闭或填写个人配置。
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {templates.map((template) => {
          const configured = providerMap.get(template.id);
          const site = siteProviderMap.get(template.id);
          const userOverridesSite = Boolean(
            configured?.enabled && configured.hasApiKey && configured.models.length > 0,
          );
          const disabledByUser = configured?.enabled === false;
          const enabled = !disabledByUser && (userOverridesSite || Boolean(site));
          return (
            <div
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition-colors hover:border-primary/30 dark:border-white/10 dark:bg-white/[0.025]"
              key={template.id}
            >
              <button
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                disabled={!cloudPersistence}
                onClick={() =>
                  configured ? editProvider(configured) : configureTemplate(template)
                }
                type="button"
              >
                <ProviderLogo disabled={!enabled} name={template.name} provider={template.id} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {template.name}
                    {disabledByUser ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 dark:bg-white/[0.07]">
                        已关闭
                      </span>
                    ) : userOverridesSite ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                        个人配置
                      </span>
                    ) : site ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                        已启用
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-400 dark:bg-white/[0.07]">
                        未配置
                      </span>
                    )}
                  </div>
                  <div className="mt-1 line-clamp-1 text-xs text-gray-400">
                    {disabledByUser
                      ? "当前用户不显示此提供商的任何模型"
                      : userOverridesSite
                        ? `${configured?.models.length || 0} 个个人模型`
                        : site
                          ? `${site.models.length} 个模型可用`
                          : template.description}
                  </div>
                </div>
                {cloudPersistence && <ChevronRight className="shrink-0 text-gray-300" size={16} />}
              </button>
              <ToggleSwitch
                checked={enabled}
                disabled={!cloudPersistence || togglingProvider === template.id}
                onChange={(next) => void toggleProvider(template.id, next)}
              />
            </div>
          );
        })}
      </div>
      {siteProviders.some(
        (item) =>
          item.provider !== "markai" &&
          !templates.some((template) => template.id === item.provider),
      ) && (
        <div className="mt-7 space-y-2">
          <div className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            其他提供商
          </div>
          {siteProviders
            .filter(
              (item) =>
                item.provider !== "markai" &&
                !templates.some((template) => template.id === item.provider),
            )
            .map((provider) => {
              const configured = providerMap.get(provider.provider);
              const enabled = configured?.enabled !== false;
              return (
                <div
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.025]"
                  key={provider.provider}
                >
                  <ProviderLogo
                    disabled={!enabled}
                    name={provider.name}
                    provider={provider.provider}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {provider.name}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px]",
                          enabled
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : "bg-gray-100 text-gray-500 dark:bg-white/[0.07]",
                        )}
                      >
                        {enabled ? "已启用" : "已关闭"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      {enabled ? `${provider.models.length} 个模型可用` : "当前用户不显示此提供商"}
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={enabled}
                    disabled={!cloudPersistence || togglingProvider === provider.provider}
                    onChange={(next) => void toggleProvider(provider.provider, next)}
                  />
                </div>
              );
            })}
        </div>
      )}
      {providers.some((item) => item.isCustom) && (
        <div className="mt-7 space-y-2">
          <div className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            自定义提供商
          </div>
          {providers
            .filter((item) => item.isCustom)
            .map((provider) => (
              <div
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.025]"
                key={provider.provider}
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => editProvider(provider)}
                  type="button"
                >
                  <div className="text-sm font-medium">{provider.name}</div>
                  <div className="truncate text-xs text-gray-400">
                    {provider.models.length} 个模型 · {provider.baseUrl}
                  </div>
                </button>
                <ToggleSwitch
                  checked={provider.enabled}
                  disabled={togglingProvider === provider.provider}
                  onChange={(enabled) => void toggleCustomProvider(provider, enabled)}
                />
                <button
                  className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                  onClick={() => setRemoveTarget(provider)}
                  type="button"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
        </div>
      )}
      {cloudPersistence && (
        <button
          className="mt-4 w-full rounded-xl border border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:border-primary/50 hover:text-primary dark:border-gray-700"
          onClick={() =>
            setForm({
              apiKey: "",
              baseUrl: "https://",
              enabled: true,
              models: "",
              name: "自定义提供商",
              provider: "custom-provider",
              runtime: "openai-compatible",
            })
          }
          type="button"
        >
          + 添加 OpenAI 兼容提供商
        </button>
      )}
      <ConfirmDialog
        confirmText="删除"
        description={`“${removeTarget?.name || "该提供商"}” 的用户配置会被删除。若存在同名默认配置，将自动恢复。`}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) void remove(removeTarget.provider);
          setRemoveTarget(null);
        }}
        open={Boolean(removeTarget)}
        title="删除用户提供商配置？"
      />
    </div>
  );
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<SettingsSection>("appearance");
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const saveState = useSettingsStore((state) => state.saveState);
  const resetSettings = useSettingsStore((state) => state.resetSettings);
  const current = sections.find((item) => item.id === section)!;

  return (
    <>
      <AppDialog
        bodyClassName="h-full"
        closable={false}
        height="min(760px, 90dvh)"
        onClose={onClose}
        open
        panelClassName="max-sm:!h-dvh max-sm:!max-h-dvh max-sm:!w-full max-sm:!max-w-none max-sm:!rounded-none"
        title={false}
        width={1024}
        zIndex={100}
      >
        <div className="flex h-full w-full overflow-hidden bg-white dark:bg-[#151515]">
          <aside className="relative hidden w-56 shrink-0 border-r border-gray-100 bg-gray-50/70 p-3 dark:border-white/[0.07] dark:bg-white/[0.02] sm:block">
            <div className="flex h-12 items-center gap-2 px-3 text-sm font-semibold">
              <Settings2 size={18} />
              设置
            </div>
            <nav className="mt-2 flex flex-col gap-1">
              {sections.map(({ id, icon, label }) => (
                <SidebarNavItem
                  active={section === id}
                  icon={icon}
                  key={id}
                  label={label}
                  onClick={() => setSection(id)}
                />
              ))}
            </nav>
            <button
              className="absolute bottom-5 flex items-center gap-2 px-3 text-xs text-gray-400 hover:text-red-500"
              onClick={() => setResetConfirmOpen(true)}
              type="button"
            >
              <RotateCcw size={14} />
              恢复默认
            </button>
          </aside>
          <main className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-100 px-5 dark:border-white/[0.07]">
              <div>
                <h2 className="font-semibold text-gray-950 dark:text-white">{current.label}</h2>
                <div className="mt-0.5 text-xs text-gray-400">
                  {saveState === "error"
                    ? "云端同步失败，本地设置已经生效"
                    : saveState === "saving"
                      ? "正在恢复默认设置…"
                      : saveState === "saved"
                        ? "已应用 · 自动保存"
                        : "修改会立即应用并自动保存"}
                </div>
              </div>
              <button
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.07]"
                onClick={onClose}
                type="button"
              >
                <X size={20} />
              </button>
            </header>
            <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-3 py-2 dark:border-white/[0.07] sm:hidden">
              {sections.map((item) => (
                <button
                  className={cn(
                    "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm",
                    section === item.id
                      ? "bg-gray-100 font-medium dark:bg-white/10"
                      : "text-gray-500",
                  )}
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto px-5 sm:px-8">
              {section === "appearance" && <AppearanceSettings />}
              {section === "chat" && <ChatSettings />}
              {section === "providers" && <ProviderSettings />}
            </div>
          </main>
        </div>
      </AppDialog>
      <ConfirmDialog
        confirmText="恢复默认"
        description="外观和对话设置会恢复为初始值，此操作会立即应用。"
        onCancel={() => setResetConfirmOpen(false)}
        onConfirm={() => {
          setResetConfirmOpen(false);
          void resetSettings();
        }}
        open={resetConfirmOpen}
        title="恢复全部默认设置？"
      />
    </>
  );
}
