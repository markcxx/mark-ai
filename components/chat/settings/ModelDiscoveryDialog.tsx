"use client";
import { useState } from "react";
import { AppDialog } from "@/components/ui/AppDialog";
import { AppInput } from "@/components/ui/AppInput";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { AppSelect } from "@/components/ui/AppSelect";

export function ModelDiscoveryDialog({
  models,
  existing,
  onClose,
  onApply,
  readOnly = false,
}: {
  models: string[];
  existing: string[];
  onClose: () => void;
  onApply: (models: string[]) => void;
  readOnly?: boolean;
}) {
  const [chosen, setChosen] = useState(() => new Set(existing));
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const filtered = models.filter((id) => id.toLowerCase().includes(query.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  return (
    <AppDialog open onClose={onClose} title="服务商模型列表" width={640}>
      <div className="space-y-4 p-5">
        <p className="text-xs leading-5 text-gray-500">
          {readOnly
            ? "这是服务商当前返回的目录。站点可用模型由管理员配置。"
            : "选择需要使用的模型，最多 100 个。确认后请保存提供商配置。已有模型不会被自动删除。"}
        </p>
        <AppInput
          aria-label="搜索服务商模型"
          placeholder="搜索模型 ID…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
        <div className="divide-y divide-gray-100 dark:divide-white/10">
          {filtered.slice((page - 1) * 10, page * 10).map((id) => (
            <label key={id} className="flex min-h-11 items-center justify-between gap-3 py-2">
              <span className="min-w-0 break-all text-xs">{id}</span>
              {!readOnly && (
                <ToggleSwitch
                  aria-label={`选择 ${id}`}
                  checked={chosen.has(id)}
                  disabled={!chosen.has(id) && chosen.size >= 100}
                  onChange={(enabled) =>
                    setChosen((current) => {
                      const next = new Set(current);
                      if (enabled) next.add(id);
                      else next.delete(id);
                      return next;
                    })
                  }
                />
              )}
            </label>
          ))}
        </div>
        {!filtered.length && (
          <p className="py-6 text-center text-sm text-gray-400">没有匹配的模型</p>
        )}
        <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
          <span>
            共 {models.length} 个{!readOnly && ` · 已选择 ${chosen.size}`}
          </span>
          <AppSelect
            aria-label="模型目录页码"
            size="small"
            value={page}
            options={Array.from({ length: pages }, (_, index) => ({
              value: index + 1,
              label: `${index + 1} / ${pages}`,
            }))}
            onChange={setPage}
          />
        </div>
        {!readOnly && (
          <button
            type="button"
            disabled={!chosen.size || chosen.size > 100}
            onClick={() => onApply([...chosen])}
            className="w-full rounded-lg bg-primary py-2 text-sm text-white disabled:opacity-40"
          >
            确认选择
          </button>
        )}
      </div>
    </AppDialog>
  );
}
