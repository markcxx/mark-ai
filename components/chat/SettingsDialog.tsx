'use client';

import DeepSeek from '@lobehub/icons/es/DeepSeek';
import Gemini from '@lobehub/icons/es/Gemini';
import Groq from '@lobehub/icons/es/Groq';
import HuggingFace from '@lobehub/icons/es/HuggingFace';
import Infinigence from '@lobehub/icons/es/Infinigence';
import Minimax from '@lobehub/icons/es/Minimax';
import Mistral from '@lobehub/icons/es/Mistral';
import Moonshot from '@lobehub/icons/es/Moonshot';
import OpenAI from '@lobehub/icons/es/OpenAI';
import OpenRouter from '@lobehub/icons/es/OpenRouter';
import Qwen from '@lobehub/icons/es/Qwen';
import SiliconCloud from '@lobehub/icons/es/SiliconCloud';
import Together from '@lobehub/icons/es/Together';
import Volcengine from '@lobehub/icons/es/Volcengine';
import XAI from '@lobehub/icons/es/XAI';
import Zhipu from '@lobehub/icons/es/Zhipu';
import { Check, ChevronRight, KeyRound, Palette, RotateCcw, Settings2, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { Input, InputNumber, InputPassword, SliderWithInput, TextArea } from '@lobehub/ui';
import { Select } from '@lobehub/ui/base-ui';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';

import type { CodeTheme, PrimaryColor } from '@/lib/settings';
import { MODEL_PROVIDER_TEMPLATES } from '@/lib/model-provider-registry';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUIStore } from '@/stores/useUIStore';

type SettingsSection = 'appearance' | 'chat' | 'providers';
type ProviderTemplate = {
  defaultBaseUrl: string;
  defaultModels: string[];
  description: string;
  id: string;
  name: string;
  runtime: 'gemini' | 'openai-compatible';
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
  runtime: 'gemini' | 'openai-compatible';
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
  runtime: 'gemini' | 'openai-compatible';
};

const sections: Array<{ id: SettingsSection; icon: typeof Palette; label: string }> = [
  { id: 'appearance', icon: Palette, label: '外观' },
  { id: 'chat', icon: SlidersHorizontal, label: '对话' },
  { id: 'providers', icon: KeyRound, label: 'AI 提供商' },
];

const primaryColors: Array<{ id: PrimaryColor; color: string; label: string }> = [
  { id: 'blue', color: '#2563eb', label: '蓝色' },
  { id: 'indigo', color: '#4f46e5', label: '靛青' },
  { id: 'violet', color: '#7c3aed', label: '紫色' },
  { id: 'magenta', color: '#c026d3', label: '洋红' },
  { id: 'red', color: '#dc2626', label: '红色' },
  { id: 'orange', color: '#ea580c', label: '橙色' },
  { id: 'green', color: '#16a34a', label: '绿色' },
  { id: 'cyan', color: '#0891b2', label: '青色' },
];

const codeThemes: Array<{ id: CodeTheme; label: string }> = [
  { id: 'one', label: 'One' },
  { id: 'vscode', label: 'VS Code' },
  { id: 'material', label: 'Material' },
  { id: 'gruvbox', label: 'Gruvbox' },
  { id: 'solarized', label: 'Solarized' },
  { id: 'github', label: 'GitHub' },
  { id: 'dracula', label: 'Dracula' },
  { id: 'night-owl', label: 'Night Owl' },
  { id: 'nord', label: 'Nord' },
  { id: 'duotone', label: 'Duotone' },
];

const providerIcons = {
  bailian: Qwen,
  deepseek: DeepSeek,
  gemini: Gemini,
  groq: Groq,
  huggingface: HuggingFace,
  infiniai: Infinigence,
  minimax: Minimax,
  mistral: Mistral,
  moonshot: Moonshot,
  openai: OpenAI,
  openrouter: OpenRouter,
  siliconflow: SiliconCloud,
  together: Together,
  volcengine: Volcengine,
  xai: XAI,
  zhipu: Zhipu,
};

function ProviderLogo({ disabled = false, name, provider }: { disabled?: boolean; name: string; provider: string }) {
  if (provider === 'markai') {
    return <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/5', disabled && 'opacity-45')}><Image alt="MarkAI" height={28} src="/images/markai.svg" width={28} /></div>;
  }

  const Icon = providerIcons[provider as keyof typeof providerIcons];
  return (
    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-800 dark:bg-white/[0.06] dark:text-gray-100', disabled && 'opacity-45')}>
      {Icon ? <Icon size={23} /> : <span className="text-sm font-bold">{name.slice(0, 1)}</span>}
    </div>
  );
}

function SettingRow({ children, description, title }: {
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-100 py-4 last:border-0 dark:border-white/[0.07] sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 pr-4">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</div>
        {description && <div className="mt-1 text-xs leading-relaxed text-gray-400">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <ToggleSwitch checked={checked} onChange={onChange} />;
}

const selectSurfaceProps = {
  classNames: {
    popup: '!border !border-gray-200 !bg-white dark:!border-white/10 dark:!bg-[#202020]',
    trigger: '!border-gray-200 !bg-white dark:!border-white/10 dark:!bg-[#222222]',
  },
  shadow: true,
  variant: 'outlined' as const,
};

const readResponse = async (response: Response) => {
  const text = await response.text();
  let data: any = {};
  if (text) {
    try { data = JSON.parse(text); } catch { data = { error: text }; }
  }
  if (!response.ok) {
    throw new Error(data.error || data.detail || `请求失败 (${response.status})`);
  }
  return data;
};

function AppearanceSettings() {
  const general = useSettingsStore((state) => state.general);
  const update = useSettingsStore((state) => state.updateGeneral);
  const { setTheme } = useTheme();

  return (
    <div>
      <SettingRow description="可跟随操作系统自动切换" title="主题模式">
        <Select
          {...selectSurfaceProps}
          onChange={(value) => {
            if (typeof value !== 'string') return;
            const themeMode = value as typeof general.themeMode;
            update({ themeMode });
            setTheme(themeMode);
          }}
          options={[
            { label: '跟随系统', value: 'system' },
            { label: '亮色', value: 'light' },
            { label: '暗色', value: 'dark' },
          ]}
          style={{ width: 160 }}
          value={general.themeMode}
        />
      </SettingRow>
      <SettingRow description="用于按钮、链接和交互高亮" title="主题色">
        <div className="flex flex-wrap justify-end gap-2">
          {primaryColors.map((item) => (
            <button
              aria-label={item.label}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 ring-offset-white transition-transform hover:scale-110 dark:ring-offset-gray-900',
                general.primaryColor === item.id && 'ring-2 ring-gray-400 dark:ring-gray-500',
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
        <div className="flex items-center gap-3">
          <SliderWithInput
            max={20}
            min={12}
            onChange={(value) => update({ chatFontSize: Number(value) })}
            style={{ width: 240 }}
            value={general.chatFontSize}
          />
        </div>
      </SettingRow>
      <SettingRow title="界面密度">
        <Select {...selectSurfaceProps} onChange={(value) => { if (typeof value === 'string') update({ density: value as typeof general.density }); }} options={[{ label: '紧凑', value: 'compact' }, { label: '默认', value: 'comfortable' }, { label: '宽松', value: 'spacious' }]} style={{ width: 160 }} value={general.density} />
      </SettingRow>
      <SettingRow description="关闭大部分装饰性动画" title="减少动画">
        <Toggle checked={general.reduceMotion} onChange={(reduceMotion) => update({ reduceMotion })} />
      </SettingRow>
      <SettingRow description="代码主题会自动匹配亮色和暗色模式" title="代码高亮主题">
        <Select {...selectSurfaceProps} onChange={(value) => { if (typeof value === 'string') update({ codeTheme: value as CodeTheme }); }} options={codeThemes.map((item) => ({ label: item.label, value: item.id }))} style={{ width: 160 }} value={general.codeTheme} />
      </SettingRow>
      <SettingRow description="可在亮色界面中固定使用暗色代码块，或反过来" title="代码块明暗模式">
        <Select {...selectSurfaceProps} onChange={(value) => { if (typeof value === 'string') update({ codeColorMode: value as typeof general.codeColorMode }); }} options={[{ label: '跟随界面', value: 'auto' }, { label: '固定亮色', value: 'light' }, { label: '固定暗色', value: 'dark' }]} style={{ width: 160 }} value={general.codeColorMode} />
      </SettingRow>
      <SettingRow title="显示代码行号">
        <Toggle checked={general.codeLineNumbers} onChange={(codeLineNumbers) => update({ codeLineNumbers })} />
      </SettingRow>
      <SettingRow title="代码自动换行">
        <Toggle checked={general.codeWrap} onChange={(codeWrap) => update({ codeWrap })} />
      </SettingRow>
      <SettingRow description="设为 0 表示永不自动折叠" title="长代码折叠阈值">
        <InputNumber max={100} min={0} onChange={(value) => update({ codeCollapseLines: Number(value) })} style={{ width: 100 }} value={general.codeCollapseLines} />
      </SettingRow>
    </div>
  );
}

function ChatSettings() {
  const general = useSettingsStore((state) => state.general);
  const update = useSettingsStore((state) => state.updateGeneral);
  return (
    <div>
      <SettingRow title="流式输出自动滚动"><Toggle checked={general.autoScroll} onChange={(autoScroll) => update({ autoScroll })} /></SettingRow>
      <SettingRow title="回复动画">
        <Select {...selectSurfaceProps} onChange={(value) => { if (typeof value === 'string') update({ responseAnimation: value as typeof general.responseAnimation }); }} options={[{ label: '关闭', value: 'none' }, { label: '淡入', value: 'fade' }, { label: '平滑', value: 'smooth' }]} style={{ width: 160 }} value={general.responseAnimation} />
      </SettingRow>
      <SettingRow description="“自动”会在生成时展开，结束后保留面板" title="思考面板">
        <Select {...selectSurfaceProps} onChange={(value) => { if (typeof value === 'string') update({ thinkingDisplay: value as typeof general.thinkingDisplay }); }} options={[{ label: '自动', value: 'auto' }, { label: '默认折叠', value: 'collapsed' }, { label: '始终展开', value: 'expanded' }]} style={{ width: 160 }} value={general.thinkingDisplay} />
      </SettingRow>
      <SettingRow title="显示 Token 与耗时统计"><Toggle checked={general.showMessageStats} onChange={(showMessageStats) => update({ showMessageStats })} /></SettingRow>
      <SettingRow title="默认启用联网搜索"><Toggle checked={general.defaultWebSearch} onChange={(defaultWebSearch) => update({ defaultWebSearch })} /></SettingRow>
      <SettingRow title="发送快捷键">
        <Select {...selectSurfaceProps} onChange={(value) => { if (typeof value === 'string') update({ sendShortcut: value as typeof general.sendShortcut }); }} options={[{ label: 'Enter 发送', value: 'enter' }, { label: 'Ctrl / Cmd + Enter', value: 'mod-enter' }]} style={{ width: 190 }} value={general.sendShortcut} />
      </SettingRow>
      <SettingRow title="默认宽屏对话"><Toggle checked={general.wideChatMode} onChange={(wideChatMode) => update({ wideChatMode })} /></SettingRow>
    </div>
  );
}

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
    const response = await fetch('/api/model-providers', { cache: 'no-store' });
    const data = await readResponse(response);
    setTemplates(data.templates || []);
    setProviders(data.providers || []);
    setSiteProviders(data.siteProviders || []);
    setCloudPersistence(Boolean(data.cloudPersistence));
  };
  useEffect(() => {
    let cancelled = false;
    void fetch('/api/model-providers', { cache: 'no-store' })
      .then(readResponse)
      .then((data) => {
        if (cancelled) return;
        setTemplates(data.templates || []);
        setProviders(data.providers || []);
        setSiteProviders(data.siteProviders || []);
        setCloudPersistence(Boolean(data.cloudPersistence));
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : '加载提供商失败'));
    return () => { cancelled = true; };
  }, []);

  const configuredIds = useMemo(() => new Set(providers.map((item) => item.provider)), [providers]);
  const providerMap = useMemo(() => new Map(providers.map((item) => [item.provider, item])), [providers]);
  const siteProviderMap = useMemo(() => new Map(siteProviders.map((item) => [item.provider, item])), [siteProviders]);
  const editProvider = (provider: UserProvider) => setForm({
    apiKey: '', baseUrl: provider.baseUrl, enabled: provider.enabled,
    models: provider.models.join('\n'), name: provider.name,
    provider: provider.provider, runtime: provider.runtime,
  });
  const configureTemplate = (template: ProviderTemplate) => setForm({
    apiKey: '', baseUrl: template.defaultBaseUrl, enabled: true,
    models: (siteProviderMap.get(template.id)?.models || template.defaultModels).join('\n'), name: template.name,
    provider: template.id, runtime: template.runtime,
  });

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const response = await fetch('/api/model-providers', {
        body: JSON.stringify({ ...form, models: form.models.split(/[\n,]/) }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PUT',
      });
      const data = await readResponse(response);
      setProviders(data.providers || []);
      setForm(null);
      await useUIStore.getState().loadModels();
      toast.success('模型提供商已保存');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (provider: string) => {
    try {
      const response = await fetch(`/api/model-providers?provider=${encodeURIComponent(provider)}`, { method: 'DELETE' });
      await readResponse(response);
      await load();
      await useUIStore.getState().loadModels();
      toast.success(siteProviderMap.has(provider) ? '已恢复默认配置' : '提供商已删除');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const toggleProvider = async (provider: string, enabled: boolean) => {
    const template = templates.find((item) => item.id === provider);
    const configured = providerMap.get(provider);
    const site = siteProviderMap.get(provider);
    if (enabled && !site && !configured?.hasApiKey) {
      if (template) configureTemplate(template);
      else toast.error('请先配置这个提供商');
      return;
    }

    setTogglingProvider(provider);
    try {
      const response = await fetch('/api/model-providers', {
        body: JSON.stringify({ enabled, provider }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      });
      const data = await readResponse(response);
      setProviders(data.providers || []);
      await useUIStore.getState().loadModels();
      toast.success(enabled ? '提供商已启用' : '提供商已关闭');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新失败');
    } finally {
      setTogglingProvider(null);
    }
  };

  const toggleCustomProvider = async (provider: UserProvider, enabled: boolean) => {
    setTogglingProvider(provider.provider);
    try {
      const response = await fetch('/api/model-providers', {
        body: JSON.stringify({ ...provider, apiKey: '', enabled }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PUT',
      });
      const data = await readResponse(response);
      setProviders(data.providers || []);
      await useUIStore.getState().loadModels();
      toast.success(enabled ? '提供商已启用' : '提供商已关闭');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新失败');
    } finally {
      setTogglingProvider(null);
    }
  };

  if (form) {
    const exists = configuredIds.has(form.provider);
    const currentProvider = providerMap.get(form.provider);
    const canRestoreSite = Boolean(currentProvider && !currentProvider.isCustom && siteProviderMap.has(form.provider));
    return (
      <>
        <div className="space-y-4 py-4">
          <button className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100" onClick={() => setForm(null)} type="button">← 返回 AI 提供商</button>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">显示名称<Input className="mt-2" onChange={(event) => setForm({ ...form, name: event.target.value })} value={form.name} /></label>
            <label className="text-sm">提供商 ID<Input className="mt-2" disabled={exists || Boolean(templates.find((item) => item.id === form.provider))} onChange={(event) => setForm({ ...form, provider: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} value={form.provider} /></label>
          </div>
          <label className="block text-sm">Base URL<Input className="mt-2" onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} value={form.baseUrl} /></label>
          <label className="block text-sm">API Key<InputPassword autoComplete="off" className="mt-2" onChange={(event) => setForm({ ...form, apiKey: event.target.value })} placeholder={currentProvider?.hasApiKey ? '留空表示保留现有 API Key' : '请输入 API Key'} value={form.apiKey} /></label>
          <label className="block text-sm">模型 ID（每行一个，也支持逗号分隔）<TextArea className="mt-2 font-mono" onChange={(event) => setForm({ ...form, models: event.target.value })} rows={7} value={form.models} /></label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><label className="flex items-center gap-3 text-sm"><Toggle checked={form.enabled} onChange={(enabled) => setForm({ ...form, enabled })} />启用此提供商</label><div className="flex items-center justify-end gap-2">{canRestoreSite && <button className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.07]" onClick={() => currentProvider && setRemoveTarget(currentProvider)} type="button">恢复默认配置</button>}<button className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={saving} onClick={save} type="button">{saving ? '保存中…' : '保存配置'}</button></div></div>
        </div>
        <ConfirmDialog confirmText="恢复" description="用户填写的 Base URL、API Key 和模型列表会被删除，此后将重新使用默认配置。" onCancel={() => setRemoveTarget(null)} onConfirm={() => { if (removeTarget) void remove(removeTarget.provider); setRemoveTarget(null); setForm(null); }} open={Boolean(removeTarget)} title="恢复默认配置？" />
      </>
    );
  }

  const markAIProvider = siteProviderMap.get('markai');
  const markAIConfiguration = providerMap.get('markai');
  const markAIEnabled = Boolean(markAIProvider) && markAIConfiguration?.enabled !== false;

  return (
    <div className="py-4">
      {!cloudPersistence && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">当前为本地 SQLite 模式：可以使用管理员预置的模型；登录云端模式后，可保存自己的 API Key 并覆盖同名提供商。</div>}
      <div className="mb-6 rounded-2xl border border-primary/15 bg-primary/[0.035] p-4 dark:bg-primary/[0.06]">
        <div className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-primary">MarkAI</div>
        <div className="flex items-center gap-3">
          <ProviderLogo disabled={!markAIEnabled} name="MarkAI" provider="markai" />
          <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-gray-950 dark:text-white">MarkAI 模型服务</div><div className="mt-1 text-xs text-gray-400">{markAIProvider ? `${markAIProvider.models.length} 个专属模型可用` : '暂未配置可用模型'}</div></div>
          <ToggleSwitch checked={markAIEnabled} disabled={!cloudPersistence || !markAIProvider || togglingProvider === 'markai'} onChange={(next) => void toggleProvider('markai', next)} />
        </div>
      </div>
      <div className="mb-3"><div className="text-sm font-semibold text-gray-900 dark:text-gray-100">内置 AI 提供商</div><div className="mt-1 text-xs text-gray-400">每个提供商都可以独立启用、关闭或填写个人配置。</div></div>
      <div className="grid gap-2 sm:grid-cols-2">{templates.map((template) => {
        const configured = providerMap.get(template.id);
        const site = siteProviderMap.get(template.id);
        const userOverridesSite = Boolean(configured?.enabled && configured.hasApiKey && configured.models.length > 0);
        const disabledByUser = configured?.enabled === false;
        const enabled = !disabledByUser && (userOverridesSite || Boolean(site));
        return <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition-colors hover:border-primary/30 dark:border-white/10 dark:bg-white/[0.025]" key={template.id}><button className="flex min-w-0 flex-1 items-center gap-3 text-left" disabled={!cloudPersistence} onClick={() => configured ? editProvider(configured) : configureTemplate(template)} type="button"><ProviderLogo disabled={!enabled} name={template.name} provider={template.id} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-sm font-medium">{template.name}{disabledByUser ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 dark:bg-white/[0.07]">已关闭</span> : userOverridesSite ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">个人配置</span> : site ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">已启用</span> : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-400 dark:bg-white/[0.07]">未配置</span>}</div><div className="mt-1 line-clamp-1 text-xs text-gray-400">{disabledByUser ? '当前用户不显示此提供商的任何模型' : userOverridesSite ? `${configured?.models.length || 0} 个个人模型` : site ? `${site.models.length} 个模型可用` : template.description}</div></div>{cloudPersistence && <ChevronRight className="shrink-0 text-gray-300" size={16} />}</button><ToggleSwitch checked={enabled} disabled={!cloudPersistence || togglingProvider === template.id} onChange={(next) => void toggleProvider(template.id, next)} /></div>;
      })}</div>
      {siteProviders.some((item) => item.provider !== 'markai' && !templates.some((template) => template.id === item.provider)) && <div className="mt-7 space-y-2"><div className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">其他提供商</div>{siteProviders.filter((item) => item.provider !== 'markai' && !templates.some((template) => template.id === item.provider)).map((provider) => { const configured = providerMap.get(provider.provider); const enabled = configured?.enabled !== false; return <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.025]" key={provider.provider}><ProviderLogo disabled={!enabled} name={provider.name} provider={provider.provider} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-sm font-medium">{provider.name}<span className={cn('rounded-full px-2 py-0.5 text-[10px]', enabled ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-white/[0.07]')}>{enabled ? '已启用' : '已关闭'}</span></div><div className="mt-1 text-xs text-gray-400">{enabled ? `${provider.models.length} 个模型可用` : '当前用户不显示此提供商'}</div></div><ToggleSwitch checked={enabled} disabled={!cloudPersistence || togglingProvider === provider.provider} onChange={(next) => void toggleProvider(provider.provider, next)} /></div>; })}</div>}
      {providers.some((item) => item.isCustom) && <div className="mt-7 space-y-2"><div className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">自定义提供商</div>{providers.filter((item) => item.isCustom).map((provider) => <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.025]" key={provider.provider}><button className="min-w-0 flex-1 text-left" onClick={() => editProvider(provider)} type="button"><div className="text-sm font-medium">{provider.name}</div><div className="truncate text-xs text-gray-400">{provider.models.length} 个模型 · {provider.baseUrl}</div></button><ToggleSwitch checked={provider.enabled} disabled={togglingProvider === provider.provider} onChange={(enabled) => void toggleCustomProvider(provider, enabled)} /><button className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={() => setRemoveTarget(provider)} type="button"><Trash2 size={15} /></button></div>)}</div>}
      {cloudPersistence && <button className="mt-4 w-full rounded-xl border border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:border-primary/50 hover:text-primary dark:border-gray-700" onClick={() => setForm({ apiKey: '', baseUrl: 'https://', enabled: true, models: '', name: '自定义提供商', provider: 'custom-provider', runtime: 'openai-compatible' })} type="button">+ 添加 OpenAI 兼容提供商</button>}
      <ConfirmDialog confirmText="删除" description={`“${removeTarget?.name || '该提供商'}” 的用户配置会被删除。若存在同名默认配置，将自动恢复。`} onCancel={() => setRemoveTarget(null)} onConfirm={() => { if (removeTarget) void remove(removeTarget.provider); setRemoveTarget(null); }} open={Boolean(removeTarget)} title="删除用户提供商配置？" />
    </div>
  );
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<SettingsSection>('appearance');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const saveState = useSettingsStore((state) => state.saveState);
  const resetSettings = useSettingsStore((state) => state.resetSettings);
  const current = sections.find((item) => item.id === section)!;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-0 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="flex h-full w-full overflow-hidden bg-white shadow-2xl dark:bg-[#151515] sm:h-[min(760px,90vh)] sm:max-w-5xl sm:rounded-2xl sm:border sm:border-black/5 sm:dark:border-white/10">
        <aside className="relative hidden w-56 shrink-0 border-r border-gray-100 bg-gray-50/70 p-3 dark:border-white/[0.07] dark:bg-white/[0.02] sm:block">
          <div className="flex h-12 items-center gap-2 px-3 text-sm font-semibold"><Settings2 size={18} />设置</div>
          <nav className="mt-2 space-y-1">{sections.map(({ id, icon: Icon, label }) => <button className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors', section === id ? 'bg-white font-medium text-gray-950 shadow-sm dark:bg-white/[0.08] dark:text-white' : 'text-gray-500 hover:bg-white/70 dark:hover:bg-white/[0.05]')} key={id} onClick={() => setSection(id)} type="button"><Icon size={17} />{label}</button>)}</nav>
          <button className="absolute bottom-5 flex items-center gap-2 px-3 text-xs text-gray-400 hover:text-red-500" onClick={() => setResetConfirmOpen(true)} type="button"><RotateCcw size={14} />恢复默认</button>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-100 px-5 dark:border-white/[0.07]">
            <div><h2 className="font-semibold text-gray-950 dark:text-white">{current.label}</h2><div className="mt-0.5 text-xs text-gray-400">{saveState === 'error' ? '云端同步失败，本地设置已经生效' : saveState === 'saving' ? '正在恢复默认设置…' : saveState === 'saved' ? '已应用 · 自动保存' : '修改会立即应用并自动保存'}</div></div>
            <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.07]" onClick={onClose} type="button"><X size={20} /></button>
          </header>
          <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-3 py-2 dark:border-white/[0.07] sm:hidden">{sections.map((item) => <button className={cn('whitespace-nowrap rounded-lg px-3 py-1.5 text-sm', section === item.id ? 'bg-gray-100 font-medium dark:bg-white/10' : 'text-gray-500')} key={item.id} onClick={() => setSection(item.id)} type="button">{item.label}</button>)}</div>
          <div className="flex-1 overflow-y-auto px-5 sm:px-8">
            {section === 'appearance' && <AppearanceSettings />}
            {section === 'chat' && <ChatSettings />}
            {section === 'providers' && <ProviderSettings />}
          </div>
        </main>
      </div>
      </div>
      <ConfirmDialog confirmText="恢复默认" description="外观和对话设置会恢复为初始值，此操作会立即应用。" onCancel={() => setResetConfirmOpen(false)} onConfirm={() => { setResetConfirmOpen(false); void resetSettings(); }} open={resetConfirmOpen} title="恢复全部默认设置？" />
    </>,
    document.body,
  );
}
