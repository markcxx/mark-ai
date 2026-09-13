"use client";

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  LayoutGrid,
  Pencil,
  Eye,
  Wrench,
  Brain,
  Video,
} from "lucide-react";
import Image from "next/image";
import { ModelDiscoveryDialog } from "./ModelDiscoveryDialog";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AppInput, AppPasswordInput, AppTextArea } from "@/components/ui/AppInput";
import { AppSelect } from "@/components/ui/AppSelect";
import { IconButton } from "@/components/ui/IconButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { MODEL_PROVIDER_TEMPLATES } from "@/lib/model-provider-registry";
import { getModelMetadata, formatTokenCount } from "@/lib/model-metadata";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/useUIStore";
import { ProviderBrandIcon } from "../ModelBrandIcon";

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
      <ProviderBrandIcon colorful className="text-sm" name={name} provider={provider} size={23} />
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

export function ProviderSettings() {
  const [templates, setTemplates] = useState<ProviderTemplate[]>(MODEL_PROVIDER_TEMPLATES);
  const [providers, setProviders] = useState<UserProvider[]>([]);
  const [siteProviders, setSiteProviders] = useState<SiteProvider[]>([]);
  const [cloudPersistence, setCloudPersistence] = useState(true);
  const [form, setForm] = useState<ProviderForm | null>(null);
  const [removeTarget, setRemoveTarget] = useState<UserProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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
      .catch((error) => {
        if (cancelled) return;
        setLoadError(true);
        toast.error(error instanceof Error ? error.message : "加载提供商失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      models: (siteProviderMap.get(template.id)?.models || []).join("\n"),
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
      setForm({ ...form, apiKey: "" });
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
      if (template) {
        setSelected(provider);
        configureTemplate(template);
      } else toast.error("请先配置这个提供商");
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

  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editingModels, setEditingModels] = useState(false);
  const entries = [
    ...templates.map((item) => ({ id: item.id, name: item.name, description: item.description })),
    ...siteProviders
      .filter((item) => !templates.some((template) => template.id === item.provider))
      .map((item) => ({
        id: item.provider,
        name: item.name,
        description: "由管理员配置的模型服务，可直接使用已提供的模型。",
      })),
    ...providers
      .filter(
        (item) =>
          item.isCustom &&
          !siteProviderMap.has(item.provider) &&
          !templates.some((template) => template.id === item.provider),
      )
      .map((item) => ({
        id: item.provider,
        name: item.name,
        description: "个人添加的 OpenAI 兼容模型服务。",
      })),
  ].map((item) => {
    const configured = providerMap.get(item.id);
    const site = siteProviderMap.get(item.id);
    const personal = Boolean(configured?.hasApiKey && configured.models.length);
    return {
      ...item,
      name: configured?.name || item.name,
      enabled: configured?.enabled !== false && (personal || Boolean(site)),
      models: personal ? configured!.models : site?.models || [],
      personal,
    };
  });
  const filteredEntries = entries.filter((item) =>
    `${item.name} ${item.id}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const active = entries.find((item) => item.id === selected);
  const modelIds = [
    ...new Set(
      (form ? form.models.split(/[\n,]/) : active?.models || [])
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
  const filteredModels = modelIds.filter((id) =>
    `${id} ${getModelMetadata(id)?.displayName || ""}`
      .toLowerCase()
      .includes(modelQuery.trim().toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filteredModels.length / 10));
  const currentPage = Math.min(page, pages);
  const currentProvider = form ? providerMap.get(form.provider) : undefined;
  const openProvider = (id: string) => {
    setSelected(id);
    setPage(1);
    setModelQuery("");
    setEditingModels(false);
    const configured = providerMap.get(id);
    const template = templates.find((item) => item.id === id);
    if (id === "markai" || !cloudPersistence) setForm(null);
    else if (configured && (configured.hasApiKey || configured.isCustom)) editProvider(configured);
    else if (template) configureTemplate(template);
    else setForm(null);
  };
  const overview = () => {
    setSelected(null);
    setForm(null);
  };
  const addProvider = () => {
    setSelected("new");
    setModelQuery("");
    setPage(1);
    setEditingModels(true);
    setForm({
      apiKey: "",
      baseUrl: "https://",
      enabled: true,
      models: "",
      name: "自定义提供商",
      provider: "",
      runtime: "openai-compatible",
    });
  };
  const changeEnabled = (id: string, enabled: boolean) => {
    const provider = providerMap.get(id);
    if (provider?.isCustom) void toggleCustomProvider(provider, enabled);
    else void toggleProvider(id, enabled);
  };
  const discoverModels = async () => {
    setDiscovering(true);
    try {
      const response = await fetch("/api/model-providers/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          form
            ? { provider: form.provider, apiKey: form.apiKey, baseUrl: form.baseUrl }
            : { provider: selected, site: true },
        ),
      });
      const data = await readResponse(response);
      setDiscovered(data.models);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "获取模型失败");
    } finally {
      setDiscovering(false);
    }
  };
  const detail = selected !== null || form !== null;
  const controlClass = "w-full lg:max-w-[360px]";
  const rowClass =
    "grid gap-3 py-5 lg:grid-cols-[minmax(140px,1fr)_minmax(220px,1fr)] lg:items-center lg:gap-8";
  const buttonClass =
    "rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/5";
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col md:flex-row text-gray-900 dark:text-gray-100">
      <aside
        className={cn(
          "max-h-52 w-full shrink-0 overflow-y-auto border-r md:max-h-none border-gray-100 bg-gray-50/40 dark:border-white/[0.07] dark:bg-white/[0.015] md:w-52",
          detail && "hidden md:block",
        )}
      >
        <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-gray-100 bg-[var(--chat-panel-bg)] p-3 dark:border-white/[0.07]">
          <AppInput
            aria-label="搜索提供商"
            placeholder="搜索提供商…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 text-xs"
          />
          <IconButton
            aria-label="添加提供商"
            data-markai-tooltip="添加提供商"
            size="sm"
            disabled={!cloudPersistence || saving || loading || loadError}
            onClick={addProvider}
          >
            <Plus size={17} />
          </IconButton>
        </div>
        <nav aria-label="提供商目录" className="space-y-1 p-2">
          <button
            type="button"
            onClick={overview}
            disabled={saving || discovering}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm",
              !detail && "bg-gray-100 font-medium dark:bg-white/[0.07]",
            )}
          >
            <LayoutGrid size={17} />
            全部<span className="ml-auto text-xs text-gray-400">{entries.length}</span>
          </button>
          {[true, false].map((enabled) => (
            <div key={String(enabled)}>
              <div className="px-3 pb-2 pt-5 text-xs text-gray-400">
                {enabled ? "已启用" : "未启用"} ·{" "}
                {filteredEntries.filter((item) => item.enabled === enabled).length}
              </div>
              {filteredEntries
                .filter((item) => item.enabled === enabled)
                .map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    disabled={saving || discovering}
                    aria-current={selected === item.id ? "page" : undefined}
                    onClick={() => openProvider(item.id)}
                    className={cn(
                      "flex w-full min-w-0 items-center gap-2.5 rounded-lg px-3 py-3 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-white/5",
                      selected === item.id && "bg-gray-100 dark:bg-white/[0.07]",
                    )}
                  >
                    <ProviderBrandIcon colorful name={item.name} provider={item.id} size={20} />
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <span
                      aria-label={item.enabled ? "已启用" : "未启用"}
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        item.enabled ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600",
                      )}
                    />
                  </button>
                ))}
            </div>
          ))}
          {!filteredEntries.length && (
            <p className="px-3 py-8 text-center text-xs text-gray-400">没有匹配的提供商</p>
          )}
        </nav>
      </aside>
      <section className="min-w-0 flex-1 overflow-y-auto px-5 py-5 lg:px-8">
        {!cloudPersistence && (
          <p className="mb-5 rounded-lg bg-gray-50 p-3 text-xs leading-6 text-gray-500 dark:bg-white/5">
            当前可使用管理员预置模型。登录云端模式后，可保存个人提供商配置。
          </p>
        )}
        {loading ? (
          <div aria-label="正在加载提供商" className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="h-44 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"
              />
            ))}
          </div>
        ) : loadError ? (
          <div className="py-16 text-center text-sm text-gray-500">
            加载提供商失败
            <button
              type="button"
              className={cn(buttonClass, "ml-3")}
              onClick={() => {
                setLoading(true);
                void load()
                  .then(() => setLoadError(false))
                  .catch(() => toast.error("加载失败，请稍后重试"))
                  .finally(() => setLoading(false));
              }}
            >
              重试
            </button>
          </div>
        ) : !detail ? (
          <>
            {[true, false].map((enabled) => {
              const group = filteredEntries.filter((item) => item.enabled === enabled);
              if (!group.length) return null;
              return (
                <div className="mb-8" key={String(enabled)}>
                  <h3 className="mb-5 flex items-center gap-2 text-base font-semibold">
                    {enabled ? "已启用提供商" : "未启用提供商"}
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500 dark:bg-white/5">
                      {group.length}
                    </span>
                  </h3>
                  <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {group.map((item) => (
                      <article
                        key={item.id}
                        className="flex min-w-0 flex-col rounded-xl border border-gray-200 dark:border-white/10"
                      >
                        <button
                          type="button"
                          onClick={() => openProvider(item.id)}
                          className="flex flex-1 flex-col p-5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.025]"
                        >
                          <div className="mb-4 flex w-full min-w-0 items-center gap-3">
                            <ProviderLogo name={item.name} provider={item.id} />
                            <span className="truncate text-base font-semibold">{item.name}</span>
                          </div>
                          <p className="line-clamp-2 min-h-10 text-xs leading-5 text-gray-500 dark:text-gray-400">
                            {item.description}
                          </p>
                        </button>
                        <div className="mx-5 flex items-center justify-between gap-2 border-t border-gray-100 py-3 dark:border-white/[0.07]">
                          <span className="text-xs text-gray-400">
                            {item.models.length} 个模型 ·{" "}
                            {item.personal
                              ? "个人配置"
                              : siteProviderMap.has(item.id)
                                ? "站点配置"
                                : "待配置"}
                          </span>
                          <ToggleSwitch
                            aria-label={`启用 ${item.name}`}
                            checked={item.enabled}
                            disabled={
                              !cloudPersistence || togglingProvider !== null || loading || loadError
                            }
                            onChange={(value) => changeEnabled(item.id, value)}
                          />
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}
            {!filteredEntries.length && (
              <p className="py-16 text-center text-sm text-gray-400">没有匹配的提供商</p>
            )}
          </>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-gray-100 pb-5 dark:border-white/10">
              <IconButton
                aria-label="返回提供商列表"
                data-markai-tooltip="返回提供商列表"
                onClick={overview}
                disabled={saving || discovering}
              >
                <ArrowLeft size={18} />
              </IconButton>
              <ProviderLogo
                name={form?.name || active?.name || "提供商"}
                provider={form?.provider || selected || ""}
              />
              <h3 className="min-w-0 flex-1 truncate text-lg font-semibold">
                {form?.name || active?.name || "添加提供商"}
              </h3>
              <ToggleSwitch
                aria-label="启用此提供商"
                checked={form ? form.enabled : Boolean(active?.enabled)}
                disabled={!cloudPersistence || saving || togglingProvider !== null}
                onChange={(enabled) =>
                  form
                    ? setForm({ ...form, enabled })
                    : selected && changeEnabled(selected, enabled)
                }
              />
            </header>
            {form ? (
              <fieldset disabled={saving || discovering}>
                <div className={rowClass}>
                  <label htmlFor="provider-name" className="text-sm font-medium">
                    显示名称
                  </label>
                  <AppInput
                    id="provider-name"
                    className={controlClass}
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                  />
                </div>
                <div className={rowClass}>
                  <div>
                    <label htmlFor="provider-id" className="text-sm font-medium">
                      提供商 ID
                    </label>
                    <p className="mt-1 text-xs text-gray-400">用于区分不同模型服务</p>
                  </div>
                  <AppInput
                    id="provider-id"
                    className={controlClass}
                    disabled={
                      Boolean(currentProvider) ||
                      templates.some((item) => item.id === form.provider)
                    }
                    value={form.provider}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        provider: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                      })
                    }
                  />
                </div>
                <div className={rowClass}>
                  <div>
                    <label htmlFor="provider-key" className="text-sm font-medium">
                      API Key
                    </label>
                    <p className="mt-1 text-xs text-gray-400">填写个人密钥以使用自己的模型服务</p>
                  </div>
                  <AppPasswordInput
                    id="provider-key"
                    autoComplete="off"
                    className={controlClass}
                    value={form.apiKey}
                    placeholder={currentProvider?.hasApiKey ? "留空保留现有密钥" : "请输入 API Key"}
                    onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
                  />
                </div>
                <div className={rowClass}>
                  <div>
                    <label htmlFor="provider-url" className="text-sm font-medium">
                      API 地址
                    </label>
                    <p className="mt-1 text-xs text-gray-400">服务商提供的完整接口地址</p>
                  </div>
                  <AppInput
                    id="provider-url"
                    className={controlClass}
                    value={form.baseUrl}
                    placeholder="https://api.example.com/v1"
                    onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
                  />
                </div>
              </fieldset>
            ) : (
              <p className="py-6 text-sm leading-6 text-gray-500">
                此服务由管理员统一配置。你可以查看可用模型，并控制是否在自己的模型选择器中显示。
              </p>
            )}
            <div className="mt-6 border-t border-gray-100 pt-6 dark:border-white/10">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h4 className="mr-auto text-sm font-semibold">
                  模型列表{" "}
                  <span className="ml-1 text-xs font-normal text-gray-400">{modelIds.length}</span>
                </h4>
                <div className="relative w-full sm:w-48">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400"
                  />
                  <AppInput
                    aria-label="搜索模型"
                    placeholder="搜索模型…"
                    className="pl-8 text-xs"
                    value={modelQuery}
                    onChange={(event) => {
                      setModelQuery(event.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <button
                  type="button"
                  className={buttonClass}
                  disabled={discovering || saving || (form ? !form.provider : !selected)}
                  onClick={() => void discoverModels()}
                >
                  {discovering ? "正在获取…" : "获取模型列表"}
                </button>
                {form && (
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => setEditingModels(!editingModels)}
                  >
                    <Pencil size={13} className="mr-1.5 inline" />
                    {editingModels ? "完成编辑" : "编辑模型"}
                  </button>
                )}
              </div>
              {editingModels && form && (
                <label className="mb-4 block text-xs text-gray-500">
                  模型 ID，每行一个或以逗号分隔
                  <AppTextArea
                    className="mt-2 font-mono text-xs"
                    rows={5}
                    value={form.models}
                    disabled={saving || discovering}
                    onChange={(event) => {
                      setForm({ ...form, models: event.target.value });
                      setPage(1);
                    }}
                  />
                </label>
              )}
              <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                {filteredModels.slice((currentPage - 1) * 10, currentPage * 10).map((id) => {
                  const metadata = getModelMetadata(id);
                  return (
                    <div key={id} className="flex min-w-0 items-center gap-3 py-4">
                      <ProviderBrandIcon
                        colorful
                        provider={form?.provider || selected || ""}
                        name={active?.name || form?.name || ""}
                        size={26}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {metadata?.displayName || id}
                        </div>
                        <div className="mt-1 truncate font-mono text-[11px] text-gray-400">
                          {id}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-gray-400">
                        {metadata?.supportsVision && (
                          <span aria-label="图像理解" data-markai-tooltip="图像理解">
                            <Eye size={14} />
                          </span>
                        )}
                        {metadata?.supportsVideo && (
                          <span aria-label="视频理解" data-markai-tooltip="视频理解">
                            <Video size={14} />
                          </span>
                        )}
                        {metadata?.supportsReasoning && (
                          <span aria-label="深度思考" data-markai-tooltip="深度思考">
                            <Brain size={14} />
                          </span>
                        )}
                        {metadata?.supportsToolCalling && (
                          <span aria-label="工具调用" data-markai-tooltip="工具调用">
                            <Wrench size={14} />
                          </span>
                        )}
                        {metadata?.contextWindowTokens && (
                          <span
                            className="rounded-md bg-gray-100 px-1.5 py-1 text-[10px] dark:bg-white/5"
                            data-markai-tooltip="上下文窗口"
                          >
                            {formatTokenCount(metadata.contextWindowTokens)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {!filteredModels.length && (
                <p className="py-10 text-center text-xs text-gray-400">
                  {modelQuery ? "没有匹配的模型" : "暂无模型，请先添加模型 ID"}
                </p>
              )}
              {filteredModels.length > 10 && (
                <div className="flex items-center justify-between border-t border-gray-100 py-3 text-xs text-gray-400 dark:border-white/10">
                  <span>共 {filteredModels.length} 个模型</span>
                  <div className="flex items-center gap-2">
                    <IconButton
                      aria-label="上一页"
                      data-markai-tooltip="上一页"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      <ChevronLeft size={16} />
                    </IconButton>
                    <AppSelect
                      aria-label="模型列表页码"
                      size="small"
                      value={currentPage}
                      options={Array.from({ length: pages }, (_, index) => ({
                        value: index + 1,
                        label: `${index + 1} / ${pages}`,
                      }))}
                      onChange={setPage}
                    />
                    <IconButton
                      aria-label="下一页"
                      data-markai-tooltip="下一页"
                      size="sm"
                      disabled={currentPage >= pages}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      <ChevronRight size={16} />
                    </IconButton>
                  </div>
                </div>
              )}
            </div>
            {form && (
              <footer className="sticky -bottom-5 mt-5 flex items-center justify-end gap-2 border-t border-gray-100 bg-[var(--chat-panel-bg)] py-4 dark:border-white/10">
                {currentProvider && (
                  <button
                    type="button"
                    className={cn(buttonClass, currentProvider.isCustom && "text-red-500")}
                    disabled={saving || discovering}
                    onClick={() => setRemoveTarget(currentProvider)}
                  >
                    {currentProvider.isCustom ? "删除提供商" : "恢复默认配置"}
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
                  disabled={
                    saving || !form.provider.trim() || !form.name.trim() || !modelIds.length
                  }
                  onClick={save}
                >
                  {saving ? "保存中…" : "保存配置"}
                </button>
              </footer>
            )}
          </>
        )}
      </section>
      {discovered && (
        <ModelDiscoveryDialog
          models={discovered}
          existing={modelIds}
          readOnly={!form}
          onClose={() => setDiscovered(null)}
          onApply={(models) => {
            if (form) setForm({ ...form, models: models.join("\n") });
            setDiscovered(null);
            setPage(1);
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(removeTarget)}
        title={removeTarget?.isCustom ? "删除提供商？" : "恢复默认配置？"}
        description="将删除该提供商的个人配置；如有站点配置，将重新使用站点配置。"
        confirmText="确认"
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) void remove(removeTarget.provider);
          setRemoveTarget(null);
          overview();
        }}
      />
    </div>
  );
}
