"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Search } from "lucide-react";
import toast from "react-hot-toast";
import type { ConfiguredModel } from "@/lib/chat/types";
import { getModelDisplayName, getModelKey } from "@/lib/chat/helpers";
import {
  isNewModel,
  type ModelPresentation,
  type ModelPresentationInput,
} from "@/lib/model-presentation";
import { useModelPresentationTime } from "@/hooks/useModelPresentationTime";
import { ModelBrandIcon } from "@/components/chat/ModelBrandIcon";
import { AppDialog } from "@/components/ui/AppDialog";
import { AppInput, AppTextArea } from "@/components/ui/AppInput";
import { AppNumberInput } from "@/components/ui/AppNumberInput";
import { cn } from "@/lib/utils";
import { AppSelect } from "@/components/ui/AppSelect";
import { IconButton } from "@/components/ui/IconButton";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { AdminButton, AdminCheckbox, AdminError, AdminLoading } from "./AdminPrimitives";

type AdminModel = ConfiguredModel & { providerName: string; presentation: ModelPresentation };

function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function ModelsPanel() {
  const [models, setModels] = useState<AdminModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [provider, setProvider] = useState("");
  const [onlyNew, setOnlyNew] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<AdminModel | null>(null);
  const [busy, setBusy] = useState("");
  const now = useModelPresentationTime(models);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/admin/models", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "模型列表加载失败");
        setModels(data.models);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);

  async function save(model: AdminModel, presentation: ModelPresentationInput, close = false) {
    if (busy) return;
    setBusy(getModelKey(model));
    try {
      const response = await fetch("/api/admin/models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: model.id, provider: model.provider, presentation }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "模型配置保存失败");
      setModels((current) =>
        current.map((item) =>
          getModelKey(item) === getModelKey(model)
            ? { ...item, presentation: data.presentation }
            : item,
        ),
      );
      if (close) setEditing(null);
      toast.success("模型配置已保存");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setBusy("");
    }
  }

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={() => setRetry((v) => v + 1)} />;
  const filtered = models.filter(
    (model) =>
      (!provider || provider === model.provider) &&
      (!onlyNew || isNewModel(model.presentation, now)) &&
      [model.id, model.providerName, model.provider, model.presentation.displayName].some((text) =>
        text.toLowerCase().includes(keyword.trim().toLowerCase()),
      ),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageModels = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageStart = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
  const pageItems = Array.from({ length: Math.min(5, pageCount) }, (_, index) => pageStart + index);

  const renderToggle = (model: AdminModel) => {
    const active = isNewModel(model.presentation, now);
    const name = model.presentation.displayName || getModelDisplayName(model.id);
    return (
      <button
        type="button"
        role="switch"
        aria-label={`上新 ${name}（${model.provider}）`}
        aria-checked={active}
        disabled={Boolean(busy)}
        className="flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.06]"
        onClick={() =>
          void save(model, {
            ...model.presentation,
            isNew: !active,
            newUntil:
              !active &&
              model.presentation.newUntil &&
              Date.parse(model.presentation.newUntil) <= now
                ? null
                : model.presentation.newUntil,
          })
        }
      >
        <ToggleSwitch checked={active} disabled={Boolean(busy)} />
      </button>
    );
  };
  const renderEdit = (model: AdminModel) => (
    <IconButton
      aria-label={`编辑 ${model.presentation.displayName || getModelDisplayName(model.id)}（${model.provider}）`}
      data-markai-tooltip="编辑模型"
      disabled={Boolean(busy)}
      onClick={() => setEditing(model)}
      shape="rounded"
      size="sm"
    >
      <Pencil size={15} />
    </IconButton>
  );
  const renderIdentity = (model: AdminModel) => (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center">
        <ModelBrandIcon model={model.id} provider={model.provider} size={24} />
      </span>
      <div className="min-w-0">
        <p
          className="truncate text-sm font-medium text-gray-900 dark:text-gray-100"
          data-markai-tooltip={model.id}
        >
          {model.presentation.displayName || getModelDisplayName(model.id)}
        </p>
        {(model.presentation.description || model.presentation.displayName) && (
          <p
            className="mt-1 truncate text-xs text-gray-400"
            data-markai-tooltip={model.presentation.description || model.id}
          >
            {model.presentation.description || model.id}
          </p>
        )}
      </div>
    </div>
  );
  const endLabel = (model: AdminModel) =>
    model.presentation.newUntil
      ? new Date(model.presentation.newUntil).toLocaleString("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : "手动关闭";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">
            {models.length}
          </span>{" "}
          个模型
          <span className="mx-2 text-gray-300 dark:text-gray-700">/</span>
          <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">
            {models.filter((m) => isNewModel(m.presentation, now)).length}
          </span>{" "}
          个上新中
        </p>
        <span className="text-xs text-gray-400">模型列表随站点配置同步</span>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400"
          />
          <AppInput
            aria-label="搜索站点模型"
            className="!pl-9"
            placeholder="搜索模型名称、ID 或提供商"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-4">
          <AppSelect
            aria-label="筛选提供商"
            value={provider}
            style={{ width: 160, minWidth: 0 }}
            onChange={(value) => {
              setProvider(value);
              setPage(1);
            }}
            options={[
              { value: "", label: "全部提供商" },
              ...[...new Map(models.map((m) => [m.provider, m.providerName])).entries()].map(
                ([value, label]) => ({ value, label }),
              ),
            ]}
          />
          <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <AdminCheckbox
              label="仅看上新"
              checked={onlyNew}
              onChange={(value) => {
                setOnlyNew(value);
                setPage(1);
              }}
            />
            <span>仅看上新</span>
          </label>
        </div>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] table-fixed text-left text-sm">
          <colgroup>
            <col />
            <col className="w-28" />
            <col className="w-24" />
            <col className="w-36" />
            <col className="w-16" />
            <col className="w-14" />
          </colgroup>
          <thead className="border-y border-gray-200 bg-gray-50/70 text-xs text-gray-400 dark:border-white/[0.08] dark:bg-white/[0.025]">
            <tr>
              <th className="px-4 py-3 font-medium">模型</th>
              <th className="px-3 py-3 font-medium">提供商</th>
              <th className="px-3 py-3 font-medium">上新</th>
              <th className="px-3 py-3 font-medium">结束时间</th>
              <th className="px-3 py-3 text-right font-medium">排序</th>
              <th className="px-3 py-3 text-right font-medium">
                <span className="sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {pageModels.map((model) => (
              <tr
                key={getModelKey(model)}
                className="transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.025]"
              >
                <td className="px-4 py-3">{renderIdentity(model)}</td>
                <td
                  className="truncate px-3 py-3 text-xs text-gray-500"
                  data-markai-tooltip={model.providerName}
                >
                  {model.providerName}
                </td>
                <td className="px-3 py-2">{renderToggle(model)}</td>
                <td className="px-3 py-3 text-xs text-gray-400">
                  {model.presentation.isNew ? (
                    <span
                      className={cn(!isNewModel(model.presentation, now) && "text-gray-400")}
                      data-markai-tooltip={
                        model.presentation.newUntil
                          ? new Date(model.presentation.newUntil).toLocaleString("zh-CN")
                          : undefined
                      }
                    >
                      {isNewModel(model.presentation, now) ? endLabel(model) : "已结束"}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-3 text-right text-xs tabular-nums text-gray-500">
                  {model.presentation.sortOrder}
                </td>
                <td className="px-3 py-3 text-right">{renderEdit(model)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-gray-100 border-y border-gray-200 md:hidden dark:divide-white/[0.05] dark:border-white/10">
        {pageModels.map((model) => (
          <div key={getModelKey(model)} className="py-3">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">{renderIdentity(model)}</div>
              {renderEdit(model)}
            </div>
            <div className="mt-1 flex min-w-0 items-center justify-between gap-3 pl-12 text-xs text-gray-400">
              <span className="min-w-0 truncate">
                {model.providerName} · 排序 {model.presentation.sortOrder}
              </span>
              <span className="flex shrink-0 items-center gap-1">上新{renderToggle(model)}</span>
            </div>
          </div>
        ))}
      </div>
      {!filtered.length && (
        <p className="py-12 text-center text-sm text-gray-400">
          {models.length ? "没有符合条件的模型" : "尚未配置站点模型"}
        </p>
      )}
      {filtered.length > 0 && (
        <nav
          aria-label="模型列表分页"
          className="flex flex-col gap-3 border-t border-gray-200 pt-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between dark:border-white/10"
        >
          <p className="tabular-nums">
            共 {filtered.length} 个模型 · 第 {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, filtered.length)} 个
          </p>
          <div className="flex items-center gap-1.5">
            <AppSelect
              aria-label="每页模型数"
              value={pageSize}
              style={{ width: 116 }}
              onChange={(value) => {
                setPageSize(value);
                setPage(1);
              }}
              options={[10, 20, 50].map((value) => ({ value, label: `每页 ${value} 条` }))}
            />
            <IconButton
              aria-label="上一页模型"
              data-markai-tooltip="上一页"
              disabled={currentPage <= 1}
              shape="rounded"
              size="sm"
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={16} />
            </IconButton>
            {pageItems.map((item) => (
              <button
                key={item}
                type="button"
                aria-label={`第 ${item} 页模型`}
                aria-current={item === currentPage ? "page" : undefined}
                onClick={() => setPage(item)}
                className={cn(
                  "hidden h-9 min-w-9 rounded-lg px-2 text-sm transition-colors sm:block",
                  item === currentPage
                    ? "bg-gray-100 font-medium text-gray-900 dark:bg-white/10 dark:text-gray-100"
                    : "hover:bg-gray-100 dark:hover:bg-white/[0.06]",
                )}
              >
                {item}
              </button>
            ))}
            <span className="px-1 tabular-nums sm:hidden">
              {currentPage}/{pageCount}
            </span>
            <IconButton
              aria-label="下一页模型"
              data-markai-tooltip="下一页"
              disabled={currentPage >= pageCount}
              shape="rounded"
              size="sm"
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={16} />
            </IconButton>
          </div>
        </nav>
      )}
      {editing && (
        <ModelEditor
          model={editing}
          saving={Boolean(busy)}
          onClose={() => setEditing(null)}
          onSave={(presentation) => void save(editing, presentation, true)}
        />
      )}
    </section>
  );
}

function ModelEditor({
  model,
  saving,
  onClose,
  onSave,
}: {
  model: AdminModel;
  saving: boolean;
  onClose: () => void;
  onSave: (value: ModelPresentationInput) => void;
}) {
  const [form, setForm] = useState<ModelPresentationInput>({ ...model.presentation });
  const [until, setUntil] = useState(localDate(model.presentation.newUntil));
  const [scheduled, setScheduled] = useState(Boolean(model.presentation.newUntil));
  return (
    <AppDialog
      open
      onClose={onClose}
      title="编辑模型展示"
      width={440}
      height="100dvh"
      closeDisabled={saving}
      wrapperClassName="!justify-end !p-0"
      panelClassName="!max-h-dvh !rounded-none"
      bodyClassName="min-h-0 overflow-y-auto"
    >
      <form
        className="space-y-5 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const date = scheduled ? new Date(until) : null;
          if (
            scheduled &&
            (!date ||
              !Number.isFinite(date.getTime()) ||
              (form.isNew && date.getTime() <= Date.now()))
          ) {
            toast.error("请选择有效的上新结束时间");
            return;
          }
          onSave({ ...form, newUntil: date?.toISOString() ?? null });
        }}
      >
        <div className="break-all text-xs leading-6 text-gray-500">
          {model.providerName} · {model.id}
        </div>
        <label className="block space-y-2 text-sm">
          <span>展示名称</span>
          <AppInput
            maxLength={80}
            disabled={saving}
            value={form.displayName}
            placeholder={getModelDisplayName(model.id)}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
          <span className="block text-xs text-gray-400">留空使用默认名称</span>
        </label>
        <label className="block space-y-2 text-sm">
          <span>一句话介绍</span>
          <AppTextArea
            maxLength={160}
            rows={3}
            disabled={saving}
            value={form.description}
            placeholder="简要介绍适合使用这个模型的场景"
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label className="flex min-h-11 items-center justify-between text-sm">
          <span>设为上新模型</span>
          <button
            type="button"
            role="switch"
            aria-label="设为上新模型"
            aria-checked={form.isNew}
            disabled={saving}
            className="flex h-11 w-11 items-center justify-center"
            onClick={() => setForm({ ...form, isNew: !form.isNew })}
          >
            <ToggleSwitch checked={form.isNew} disabled={saving} />
          </button>
        </label>
        <div className="space-y-3">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <AdminCheckbox
              label="到期自动结束"
              checked={scheduled}
              disabled={saving}
              onChange={setScheduled}
            />
            到期自动结束
          </label>
          {scheduled ? (
            <label className="block space-y-2 text-sm">
              <span>结束时间（本地时间）</span>
              <AppInput
                type="datetime-local"
                required
                value={until}
                disabled={saving}
                onChange={(e) => setUntil(e.target.value)}
              />
            </label>
          ) : (
            <p className="text-xs text-gray-400">上新状态保持到手动关闭</p>
          )}
        </div>
        <label className="block space-y-2 text-sm">
          <span>展示顺序</span>
          <AppNumberInput
            min={0}
            max={9999}
            disabled={saving}
            value={form.sortOrder}
            onChange={(value) => setForm({ ...form, sortOrder: value ?? 0 })}
          />
          <span className="block text-xs text-gray-400">数字越小越靠前，仅影响上新栏顺序</span>
        </label>
        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-white/10">
          <AdminButton disabled={saving} onClick={onClose}>
            取消
          </AdminButton>
          <AdminButton primary loading={saving} type="submit">
            保存设置
          </AdminButton>
        </div>
      </form>
    </AppDialog>
  );
}
