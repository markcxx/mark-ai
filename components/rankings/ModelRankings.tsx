"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "@/components/ui/AppImage";
import {
  ArrowLeft,
  BrainCircuit,
  BriefcaseBusiness,
  ExternalLink,
  Gauge,
  LayoutDashboard,
  Moon,
  Search,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { SidebarNavItem } from "@/components/chat/SidebarNavItem";
import { AppInput } from "@/components/ui/AppInput";
import { AppSelect } from "@/components/ui/AppSelect";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import {
  formatRankingValue,
  getRankingVendor,
  rankModels,
  RANKING_METRICS,
  RANKING_VENDORS,
  shortModelName,
  type RankedRow,
  type RankingMetric,
  type RankingModel,
} from "@/lib/model-rankings";
import { cn } from "@/lib/utils";
import { RankingCard, RankingChart } from "./RankingChart";
import { CapabilityMatrix, VendorLeaderboard } from "./RankingInsights";
import { ModelRadarCompare } from "./ModelRadarCompare";
import { IndexGroupedBars, IntelligenceHistogram, VendorShareDonut } from "./RankingDistributions";
import { RankingScatterChart } from "./RankingScatterChart";
import { VendorLogo } from "./VendorLogo";

type View = "overview" | "intelligence" | "capabilities" | "efficiency";

const VIEWS: { id: View; label: string; description: string; icon: LucideIcon }[] = [
  {
    id: "overview",
    label: "概览",
    description: "综合智能排名、厂商对比与性价比分布",
    icon: LayoutDashboard,
  },
  {
    id: "intelligence",
    label: "智能指数",
    description: "综合智能、编码与 Agentic 三项指数",
    icon: BrainCircuit,
  },
  {
    id: "capabilities",
    label: "专业能力",
    description: "工程、战略、财务、经济、法律与医疗领域指数",
    icon: BriefcaseBusiness,
  },
  {
    id: "efficiency",
    label: "速度与价格",
    description: "输出速度、首字延迟与参考价格",
    icon: Gauge,
  },
];

const metric = (key: string) => RANKING_METRICS.find((item) => item.key === key)!;

export function ModelRankings({
  models,
  updatedAt,
  indexVersion,
  stale,
}: {
  models: RankingModel[];
  updatedAt?: string;
  indexVersion: string;
  stale: boolean;
}) {
  const [view, setView] = useState<View>("overview");
  const [query, setQuery] = useState("");
  const [vendor, setVendor] = useState("");
  const [limit, setLimit] = useState(20);
  const [mergeVariants, setMergeVariants] = useState(true);
  const { resolvedTheme, setTheme } = useTheme();
  const current = VIEWS.find((item) => item.id === view)!;
  const date =
    updatedAt && Number.isFinite(Date.parse(updatedAt))
      ? new Date(updatedAt).toISOString().slice(0, 10)
      : "未知";
  const vendorOptions = useMemo(() => {
    const present = new Set(models.map((model) => getRankingVendor(model).key));
    return [
      { value: "", label: "全部厂商" },
      ...RANKING_VENDORS.filter((item) => present.has(item.key)).map((item) => ({
        value: item.key,
        label: item.label,
      })),
    ];
  }, [models]);
  const filters = { query, vendor: vendor || undefined, mergeVariants };
  const filtered = Boolean(query.trim() || vendor);
  const emptyText = filtered
    ? "没有匹配的评测结果，请调整搜索词或厂商。"
    : "当前快照暂无此项评测数据，请稍后查看。";

  const rankFor = (item: RankingMetric) => {
    const rows = rankModels(models, item, filters);
    return {
      rows,
      total: filtered ? rows.length : rankModels(models, item, { mergeVariants }).length,
    };
  };
  const renderChart = (keys: string[], title?: string) => (
    <RankingChart
      key={keys.join()}
      title={title}
      metrics={keys.map((key) => {
        const item = metric(key);
        return key === "intelligence"
          ? { ...item, label: `${item.label} v${indexVersion || "?"}` }
          : item;
      })}
      rankFor={rankFor}
      limit={limit}
      emptyText={emptyText}
    />
  );
  const intelligenceRows = useMemo(() => rankModels(models, metric("intelligence")), [models]);
  const capabilityKeys = RANKING_METRICS.filter((item) => item.group === "capabilities").map(
    (item) => item.key,
  );

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--chat-app-bg)] p-0 text-gray-900 md:p-2 dark:text-gray-100">
      <aside className="hidden w-[248px] shrink-0 flex-col p-3 md:flex">
        <div className="mb-5 flex items-center gap-3 px-2 pt-1">
          <Image alt="MarkAI" className="h-8 w-8" height={32} src="/images/markai.svg" width={32} />
          <div>
            <p className="font-jakarta text-lg font-bold leading-tight">MarkAI</p>
            <p className="text-xs text-gray-400">模型排名</p>
          </div>
        </div>
        <nav aria-label="评测维度" className="space-y-1">
          {VIEWS.map((item) => (
            <SidebarNavItem
              key={item.id}
              active={view === item.id}
              icon={item.icon}
              label={item.label}
              onClick={() => setView(item.id)}
            />
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <div className="space-y-1 px-2 text-[11px] leading-5 text-gray-400">
            <p>数据来源 Artificial Analysis</p>
            <p>
              {models.length} 个评测版本 · 智能指数 v{indexVersion || "未知"}
            </p>
            <p>同步于 {date}（UTC）</p>
          </div>
          <Link
            href="/"
            className="flex h-9 items-center gap-2 rounded-lg px-2 text-sm text-gray-500 hover:bg-[#f0f1f2] dark:hover:bg-gray-800/60"
          >
            <ArrowLeft size={16} />
            返回聊天
          </Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto bg-[var(--chat-app-bg)] md:rounded-xl md:border md:border-[#e5e5e5] md:bg-[#f4f5f7] dark:md:border-white/10 dark:md:bg-[#0e0f11]">
        <header className="sticky top-0 z-20 border-b border-gray-200/70 bg-[var(--chat-header-bg)] px-3 py-3 backdrop-blur-md md:px-6 dark:border-white/[0.07]">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1">
              <Link
                href="/"
                aria-label="返回聊天"
                data-markai-tooltip="返回聊天"
                className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 md:hidden dark:hover:bg-white/[0.07]"
              >
                <ArrowLeft size={18} />
              </Link>
              <div className="min-w-0">
                <h1 className="truncate text-[17px] font-semibold leading-6">
                  <span className="md:hidden">模型排名 · </span>
                  {current.label}
                </h1>
                <p className="mt-0.5 hidden truncate text-xs text-gray-400 md:block">
                  {current.description}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <a
                href="https://artificialanalysis.ai/leaderboards/models"
                target="_blank"
                rel="noreferrer"
                aria-label="Artificial Analysis 官方榜单"
                data-markai-tooltip="Artificial Analysis 官方榜单"
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <ExternalLink size={17} />
              </a>
              <IconButton
                aria-label="切换明暗主题"
                data-markai-tooltip="切换明暗主题"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              >
                <Sun className="hidden dark:block" size={17} />
                <Moon className="dark:hidden" size={17} />
              </IconButton>
            </div>
          </div>
          <div className="mx-auto mt-3 grid max-w-[1440px] grid-cols-4 gap-1 md:hidden">
            {VIEWS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={view === item.id}
                  onClick={() => setView(item.id)}
                  className={cn(
                    "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium transition-colors",
                    view === item.id
                      ? "bg-primary/10 text-primary"
                      : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06]",
                  )}
                >
                  <Icon size={15} />
                  <span className="w-full truncate text-center">{item.label}</span>
                </button>
              );
            })}
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] space-y-4 px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:px-6 md:py-6">
          {stale && (
            <p
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
            >
              当前显示已保存的历史快照，暂未取得最近 24
              小时的数据。可稍后重新打开页面，或访问官方榜单。
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-0 flex-1 basis-56 sm:max-w-72">
              <Search
                aria-hidden="true"
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <AppInput
                aria-label="搜索评测模型"
                placeholder="搜索模型，如 Claude、GPT…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 pl-9 md:h-9"
              />
            </label>
            <AppSelect<string>
              aria-label="按厂商筛选"
              value={vendor}
              onChange={setVendor}
              options={vendorOptions}
              style={{ width: 132 }}
              className="!min-h-10 shrink-0 md:!min-h-9"
            />
            <SegmentedControl<number>
              value={limit}
              onChange={setLimit}
              options={[10, 20, 30].map((value) => ({ value, label: `Top ${value}` }))}
              className="min-h-10 shrink-0 md:min-h-9"
            />
            <label className="flex min-h-10 shrink-0 cursor-pointer items-center gap-1 rounded-lg pl-2 text-xs text-gray-500 md:min-h-9 dark:text-gray-400">
              合并推理档位
              <ToggleSwitch
                aria-label="合并同一模型的不同推理档位"
                checked={mergeVariants}
                onChange={setMergeVariants}
              />
            </label>
          </div>

          {view === "overview" && (
            <Overview
              models={models}
              filters={filters}
              indexVersion={indexVersion}
              renderChart={renderChart}
            />
          )}
          {view === "intelligence" && (
            <>
              {renderChart(["intelligence", "coding", "agentic"], "智能指数排行")}
              <div className="grid gap-4 xl:grid-cols-2">
                <RankingCard
                  title="三项指数对比"
                  description="综合智能前 10 名（三项均有数据）的综合、编码与 Agentic 分数并排比较。"
                >
                  <IndexGroupedBars rows={intelligenceRows} />
                </RankingCard>
                <RankingCard
                  title="多维能力雷达"
                  description="挑选最多 4 个模型，对比九项 AA 指数的整体轮廓。"
                >
                  <ModelRadarCompare models={models} />
                </RankingCard>
              </div>
              <RankingCard
                title="智能分数分布"
                description="全部评测版本按 5 分一档统计，看清头部模型有多稀少。"
              >
                <IntelligenceHistogram models={models} />
              </RankingCard>
            </>
          )}
          {view === "capabilities" && (
            <>
              <RankingCard
                title="专业能力矩阵"
                description="每个模型族取综合智能最高的版本；各领域指数独立评测，平均值仅作参考。"
              >
                <CapabilityMatrix
                  models={models}
                  limit={limit}
                  query={query}
                  vendor={vendor || undefined}
                />
              </RankingCard>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                {renderChart(capabilityKeys, "领域排行")}
                <RankingCard title="多维能力雷达" description="同一模型在不同领域的长板与短板。">
                  <ModelRadarCompare models={models} />
                </RankingCard>
              </div>
            </>
          )}
          {view === "efficiency" && (
            <>
              <RankingCard
                title="智能与效率前沿"
                description="价格、速度和延迟均为跨提供商参考值，不代表 MarkAI 当前服务线路。"
              >
                <RankingScatterChart models={models} height={420} />
              </RankingCard>
              {renderChart(["speed", "latency"], "速度排行")}
              {renderChart(["blendedPrice", "inputPrice", "outputPrice"], "价格排行")}
            </>
          )}

          <footer className="px-1 pt-2 text-[11px] leading-5 text-gray-400">
            图表由 MarkAI 根据 Artificial Analysis 数据绘制，非 AA 官方页面；范围为 AA
            收录的模型，不限于本站可用模型。名次按当前快照原始指标计算，搜索与厂商筛选不改变名次；合并推理档位时每个模型仅保留该指标下最好的档位。
            <a
              className="ml-1 underline underline-offset-4 hover:text-gray-600 dark:hover:text-gray-300"
              href="https://artificialanalysis.ai/methodology/intelligence-benchmarking"
              target="_blank"
              rel="noreferrer"
            >
              查看评测方法
            </a>
          </footer>
        </div>
      </main>
    </div>
  );
}

function Overview({
  models,
  filters,
  indexVersion,
  renderChart,
}: {
  models: RankingModel[];
  filters: { query: string; vendor?: string; mergeVariants: boolean };
  indexVersion: string;
  renderChart: (keys: string[], title?: string) => React.ReactNode;
}) {
  const highlights = useMemo(() => {
    const top = (key: string) => rankModels(models, metric(key))[0] as RankedRow | undefined;
    const intelligence = rankModels(models, metric("intelligence"));
    // Cheapest model that still sits in the top quartile on intelligence.
    const threshold = intelligence[Math.floor(intelligence.length / 4)]?.value ?? 0;
    const value = rankModels(
      models.filter((model) => (model.intelligence ?? -1) >= threshold),
      metric("blendedPrice"),
    ).find((row) => row.value > 0);
    return [
      { label: "综合智能第一", row: top("intelligence"), metric: metric("intelligence") },
      { label: "编码第一", row: top("coding"), metric: metric("coding") },
      { label: "输出最快", row: top("speed"), metric: metric("speed") },
      {
        label: "高智能中最便宜",
        hint: `综合智能前 25%（≥ ${formatRankingValue(threshold, 1)}）`,
        row: value,
        metric: metric("blendedPrice"),
      },
    ];
  }, [models]);
  const vendorRows = useMemo(() => rankModels(models, metric("intelligence")), [models]);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {highlights.map(({ label, hint, row, metric: item }) => (
          <div
            key={label}
            className="min-w-0 rounded-xl border border-gray-200/70 bg-[var(--chat-panel-bg)] p-4 dark:border-white/[0.07]"
          >
            <p className="truncate text-xs text-gray-400">{label}</p>
            {row ? (
              <>
                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className="font-jakarta text-2xl font-semibold tabular-nums tracking-tight">
                    {formatRankingValue(row.value, item.digits)}
                  </span>
                  <span className="text-[11px] text-gray-400">{item.unit}</span>
                </p>
                <p className="mt-2 flex min-w-0 items-center gap-2">
                  <VendorLogo vendor={row.vendor} name={row.model.name} size={16} />
                  <span
                    className="truncate font-jakarta text-xs text-gray-600 dark:text-gray-300"
                    data-markai-tooltip={row.model.name}
                  >
                    {shortModelName(row.model.name)}
                  </span>
                </p>
                {hint && <p className="mt-1 truncate text-[10px] text-gray-400">{hint}</p>}
              </>
            ) : (
              <p className="mt-3 text-sm text-gray-400">暂无数据</p>
            )}
          </div>
        ))}
      </div>
      {renderChart(["intelligence", "coding", "agentic"], "智能排行")}
      <div className="grid gap-4 xl:grid-cols-3">
        <RankingCard
          title="厂商最强模型"
          description={`各厂商在综合智能指数 v${indexVersion || "?"} 上的最佳成绩`}
        >
          <VendorLeaderboard rows={vendorRows} />
        </RankingCard>
        <RankingCard title="头部厂商占比" description="综合智能前 50 个评测版本来自哪些厂商。">
          <VendorShareDonut rows={vendorRows} />
        </RankingCard>
        <RankingCard title="智能分数分布" description="全部评测版本按 5 分一档统计。">
          <IntelligenceHistogram models={models} />
        </RankingCard>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <RankingCard
          title="智能与效率前沿"
          description="每个点是一个评测版本，按厂商着色；实线连接的是效率前沿上的模型。"
        >
          <RankingScatterChart models={models} />
        </RankingCard>
        <RankingCard title="多维能力雷达" description="挑选最多 4 个模型，对比九项 AA 指数。">
          <ModelRadarCompare models={models} />
        </RankingCard>
      </div>
      <RankingCard
        title="专业能力矩阵"
        description="综合智能前列模型在六个专业领域的表现；颜色越深分数越高。"
      >
        <CapabilityMatrix
          models={models}
          limit={10}
          query={filters.query}
          vendor={filters.vendor}
        />
      </RankingCard>
    </>
  );
}
