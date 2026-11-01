"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PencilLine, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { getModelKey } from "@/lib/chat/helpers";
import { isNewModel } from "@/lib/model-presentation";
import { DEFAULT_PLANS, type PlanConfig, type PlanModel } from "@/lib/plans";
import { useModelPresentationTime } from "@/hooks/useModelPresentationTime";
import { AppSelect } from "@/components/ui/AppSelect";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { ModelBrandIcon } from "@/components/chat/ModelBrandIcon";
import { cn } from "@/lib/utils";
import {
  AdminEmpty,
  AdminError,
  AdminFilterTabs,
  AdminLoading,
  AdminPagination,
  AdminSearch,
  AdminSurface,
  AdminToolbar,
  adminRow,
  adminTd,
  adminTh,
} from "./AdminPrimitives";
import {
  baseQuota,
  formatAmount,
  formatPrice,
  ModelPriceDialog,
  modelName,
  priceState,
  PriceStateBadge,
  priceUnit,
  type AdminModel,
  type ModelEstimation,
} from "./ModelPricingRow";

type StatusFilter = "all" | "attention" | "custom" | "free" | "new";

export function ModelsPanel() {
  const [models, setModels] = useState<AdminModel[]>([]);
  const [estimation, setEstimation] = useState<ModelEstimation>(DEFAULT_PLANS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [developer, setDeveloper] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState<string>();
  // Background refreshes pause while a price dialog or a toggle is in flight,
  // and are discarded if anything changed while they were loading.
  const locks = useRef(new Set<string>());
  const changes = useRef(0);
  const lock = useCallback((key: string, active: boolean) => {
    changes.current += 1;
    if (active) locks.current.add(key);
    else locks.current.delete(key);
  }, []);
  useEffect(() => {
    lock("dialog", Boolean(editing));
  }, [editing, lock]);
  const now = useModelPresentationTime(models);

  useEffect(() => {
    let controller: AbortController | undefined;
    let initialPending = true;
    const load = (initial = false) => {
      if (!initial && (document.visibilityState !== "visible" || locks.current.size)) return;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const version = changes.current;
      if (initial) {
        setLoading(true);
        setError("");
      }
      fetch("/api/admin/models", { cache: "no-store", signal: request.signal })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw Error(data.error || "模型列表加载失败");
          if (request.signal.aborted || (!initial && changes.current !== version)) return;
          setModels(data.models);
          setEstimation(data.estimation);
        })
        .catch((e) => {
          if (!request.signal.aborted) {
            if (initial) setError(e.message);
            else toast.error("最新模型价格读取失败，请重新打开页面");
          }
        })
        .finally(() => {
          if (!request.signal.aborted && initial) {
            initialPending = false;
            setLoading(false);
          }
        });
    };
    const refresh = () => {
      if (!initialPending) load();
    };
    load(true);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller?.abort();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [retry]);

  async function toggleNew(model: AdminModel) {
    if (busy) return;
    const key = getModelKey(model);
    setBusy(key);
    lock("presentation", true);
    try {
      const response = await fetch("/api/admin/models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: model.id,
          provider: model.provider,
          presentation: {
            ...model.presentation,
            isNew: !isNewModel(model.presentation, now),
            newUntil: null,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "上新标记保存失败");
      setModels((current) =>
        current.map((m) =>
          getModelKey(m) === key ? { ...m, presentation: data.presentation } : m,
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setBusy("");
      lock("presentation", false);
    }
  }

  async function saveFree(model: AdminModel, freeAccess: boolean) {
    const key = getModelKey(model);
    lock("free", true);
    try {
      const response = await fetch("/api/admin/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelKey: key, freeAccess }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "免费额度保存失败");
      const updated = (data.config as PlanConfig).models.find((m: PlanModel) => m.key === key);
      if (updated)
        setModels((current) =>
          current.map((m) => (getModelKey(m) === key ? { ...m, pricing: updated } : m)),
        );
      toast.success(
        freeAccess ? `${modelName(model)} 已对免费版开放` : `${modelName(model)} 已设为会员专享`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败，请重试");
      throw e;
    } finally {
      lock("free", false);
    }
  }

  async function savePrice(
    model: AdminModel,
    {
      freeAccess,
      input,
      output,
      creditsOverride,
    }: {
      input: number | null;
      output: number | null;
      freeAccess: boolean;
      creditsOverride: number | null;
    },
    priceChanged: boolean,
  ) {
    const { pricing } = model;
    const response = await fetch("/api/admin/plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelKey: getModelKey(model),
        ...(priceChanged
          ? { prices: { input, output, currency: pricing.currency, unit: pricing.unit } }
          : {}),
        freeAccess,
        creditsOverride,
        expectedPrices: { input: pricing.input, output: pricing.output },
      }),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "价格保存失败，请重试");
    const updated = (data.config as PlanConfig).models.find(
      (m: PlanModel) => m.key === getModelKey(model),
    );
    if (!updated) throw Error("模型配置已变更，请重新加载列表");
    changes.current += 1;
    setModels((current) =>
      current.map((m) => (getModelKey(m) === updated.key ? { ...m, pricing: updated } : m)),
    );
    toast.success(`${modelName(model)} 已保存`);
  }

  const counts = useMemo(
    () => ({
      all: models.length,
      attention: models.filter((m) =>
        ["missing", "warning", "estimated"].includes(priceState(m.pricing)),
      ).length,
      custom: models.filter((m) => priceState(m.pricing) === "custom").length,
      free: models.filter((m) => m.pricing.freeAccess).length,
      new: models.filter((m) => isNewModel(m.presentation, now)).length,
    }),
    [models, now],
  );
  const developers = useMemo(
    () => [...new Map(models.map((m) => [m.developer.id, m.developer.name])).entries()],
    [models],
  );

  if (loading) return <AdminLoading rows={8} />;
  if (error) return <AdminError message={error} onRetry={() => setRetry((v) => v + 1)} />;

  const search = keyword.trim().toLowerCase();
  const filtered = models.filter((m) => {
    const state = priceState(m.pricing);
    return (
      (!developer || m.developer.id === developer) &&
      (status === "all" ||
        (status === "attention" && ["missing", "warning", "estimated"].includes(state)) ||
        (status === "custom" && state === "custom") ||
        (status === "free" && m.pricing.freeAccess) ||
        (status === "new" && isNewModel(m.presentation, now))) &&
      [m.id, modelName(m), m.developer.name, m.developer.id].some((s) =>
        s.toLowerCase().includes(search),
      )
    );
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageModels = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const editingModel = models.find((m) => getModelKey(m) === editing);
  const resetPage =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  return (
    <>
      <AdminSurface>
        <AdminToolbar>
          <AdminSearch
            label="搜索模型"
            onChange={resetPage(setKeyword)}
            placeholder="搜索模型名称、ID 或原厂"
            value={keyword}
          />
          <AppSelect
            aria-label="按模型原厂筛选"
            classNames={{ trigger: "min-h-10 md:min-h-9" }}
            onChange={resetPage(setDeveloper)}
            options={[
              { value: "", label: "全部原厂" },
              ...developers.map(([value, label]) => ({ value, label })),
            ]}
            style={{ width: 132 }}
            value={developer}
          />
          <AdminFilterTabs<StatusFilter>
            label="价格状态"
            onChange={resetPage(setStatus)}
            options={[
              { value: "all", label: "全部", count: counts.all },
              { value: "attention", label: "需关注", count: counts.attention },
              { value: "custom", label: "已自定义", count: counts.custom },
              { value: "free", label: "免费版可用", count: counts.free },
              { value: "new", label: "上新中", count: counts.new },
            ]}
            value={status}
          />
        </AdminToolbar>

        {!filtered.length ? (
          <AdminEmpty
            description={
              models.length ? "调整搜索词或筛选条件后再试" : "在环境配置中添加模型后显示"
            }
            title={models.length ? "没有符合条件的模型" : "尚未配置站点模型"}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr>
                    <th className={adminTh}>模型</th>
                    <th className={adminTh}>
                      <span className="grid w-[184px] grid-cols-2 gap-4 text-right">
                        <span>输入</span>
                        <span>输出</span>
                      </span>
                    </th>
                    <th className={cn(adminTh, "text-right")}>基础版 / 月</th>
                    <th className={cn(adminTh, "text-right")}>
                      <span data-markai-tooltip="开启后免费用户可用，共享每月免费次数">
                        免费版开放
                      </span>
                    </th>
                    <th className={adminTh}>价格状态</th>
                    <th className={cn(adminTh, "text-center")}>上新</th>
                    <th className={cn(adminTh, "w-14")}>
                      <span className="sr-only">操作</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageModels.map((model) => {
                    const key = getModelKey(model);
                    const { credits, messages } = baseQuota(estimation, model.pricing);
                    const image = model.pricing.unit === "image";
                    return (
                      <tr
                        className={cn(adminRow, "cursor-pointer")}
                        key={key}
                        onClick={() => setEditing(key)}
                      >
                        <td className={adminTd}>
                          <div className="flex min-w-0 items-center gap-3">
                            <ModelBrandIcon model={model.id} provider={model.provider} size={28} />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{modelName(model)}</p>
                              <p
                                className="mt-0.5 truncate font-jakarta text-[11px] text-gray-400"
                                data-markai-tooltip={model.id}
                              >
                                {model.developer.name} · {model.id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className={adminTd}>
                          <span className="grid w-[184px] grid-cols-2 gap-4 text-right font-jakarta tabular-nums">
                            <span>{formatPrice(model.pricing, model.pricing.input)}</span>
                            <span>{formatPrice(model.pricing, model.pricing.output)}</span>
                          </span>
                          <span className="mt-0.5 block w-[184px] text-right text-[10px] text-gray-400">
                            {priceUnit(model.pricing)}
                          </span>
                        </td>
                        <td className={cn(adminTd, "text-right font-jakarta tabular-nums")}>
                          {credits === 0 ? (
                            <span className="text-gray-400">不消耗</span>
                          ) : (
                            <>
                              {formatAmount(messages)}
                              <span className="ml-1 text-[11px] text-gray-400">
                                {image ? "张" : "条"}
                              </span>
                            </>
                          )}
                        </td>
                        <td className={cn(adminTd, "py-2")}>
                          <div
                            className="flex justify-end"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <ToggleSwitch
                              aria-label={`${modelName(model)} 对免费版开放`}
                              checked={model.pricing.freeAccess}
                              disabled={Boolean(busy)}
                              onChange={(checked) =>
                                void saveFree(model, checked).catch(() => undefined)
                              }
                            />
                          </div>
                        </td>
                        <td className={adminTd}>
                          <PriceStateBadge pricing={model.pricing} />
                        </td>
                        <td
                          className={cn(adminTd, "text-center")}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <ToggleSwitch
                            aria-label={`${modelName(model)} 上新标记`}
                            checked={isNewModel(model.presentation, now)}
                            disabled={Boolean(busy)}
                            onChange={() => void toggleNew(model)}
                          />
                        </td>
                        <td className={cn(adminTd, "pl-0 text-right")}>
                          <button
                            aria-label={`编辑 ${modelName(model)} 价格`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-white/[0.07] dark:hover:text-gray-200"
                            data-markai-tooltip="编辑价格"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditing(key);
                            }}
                            type="button"
                          >
                            <PencilLine size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-gray-100 md:hidden dark:divide-white/[0.06]">
              {pageModels.map((model) => {
                const key = getModelKey(model);
                const { credits, messages } = baseQuota(estimation, model.pricing);
                const isNew = isNewModel(model.presentation, now);
                return (
                  <li className="px-3 py-3" key={key}>
                    <div className="flex items-start gap-3">
                      <ModelBrandIcon model={model.id} provider={model.provider} size={32} />
                      <button
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setEditing(key)}
                        type="button"
                      >
                        <p className="truncate text-sm font-medium">{modelName(model)}</p>
                        <p className="mt-0.5 truncate text-[11px] text-gray-400">
                          {model.developer.name}
                        </p>
                        <p className="mt-2 font-jakarta text-xs tabular-nums text-gray-600 dark:text-gray-300">
                          {formatPrice(model.pricing, model.pricing.input)} /{" "}
                          {formatPrice(model.pricing, model.pricing.output)}
                          <span className="ml-2 text-gray-400">
                            {credits === 0 ? "不消耗" : `${formatAmount(messages)} 条/月`}
                          </span>
                          <span className="ml-2 text-gray-400">
                            {model.pricing.freeAccess ? "免费版可用" : "仅会员"}
                          </span>
                        </p>
                      </button>
                      <PriceStateBadge pricing={model.pricing} />
                    </div>
                    <div className="mt-2 flex items-center justify-between pl-11">
                      <label className="flex min-h-10 items-center gap-1 text-xs text-gray-500">
                        <Sparkles size={13} className={isNew ? "text-amber-500" : undefined} />
                        上新标记
                        <ToggleSwitch
                          aria-label={`${modelName(model)} 上新标记`}
                          checked={isNew}
                          disabled={Boolean(busy)}
                          onChange={() => void toggleNew(model)}
                        />
                      </label>
                      <button
                        className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.07]"
                        onClick={() => setEditing(key)}
                        type="button"
                      >
                        <PencilLine size={14} /> 编辑价格
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <AdminPagination
              onPageChange={setPage}
              onPageSizeChange={resetPage(setPageSize)}
              page={currentPage}
              pageSize={pageSize}
              pageSizes={[20, 50, 100]}
              total={filtered.length}
              unit="个模型"
            />
          </>
        )}
      </AdminSurface>

      <ModelPriceDialog
        estimation={estimation}
        model={editingModel}
        onClose={() => setEditing(undefined)}
        onSave={savePrice}
      />
    </>
  );
}
