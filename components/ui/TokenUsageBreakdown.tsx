"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

const format = (value: number | null) =>
  value === null ? "—" : new Intl.NumberFormat("zh-CN").format(value);

/** The same token breakdown can be used in usage tables and message details. */
export function TokenUsageBreakdown({
  total,
  input,
  output,
  estimated = false,
}: {
  total: number | null;
  input: number | null;
  output: number | null;
  estimated?: boolean;
}) {
  const exact = total !== null && input !== null && output !== null && total === input + output;
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap text-sm tabular-nums"
      aria-label={`总计 ${format(total)}，输入 ${format(input)}，输出 ${format(output)}${estimated ? "，估算值" : ""}`}
      data-markai-tooltip={estimated ? "Token 用量为估算值" : undefined}
    >
      <span className="rounded-sm bg-[#eff7eb] px-1 py-0.5 text-[#26ad44] dark:bg-emerald-400/10 dark:text-emerald-400">
        {format(total)}
      </span>
      <span className="text-gray-400">{exact ? "=" : "·"}</span>
      <span className="inline-flex items-center gap-1 rounded-sm bg-black/[0.025] px-1 py-0.5 text-gray-500 dark:bg-white/5 dark:text-gray-400">
        <ArrowDown size={12} />
        {format(input)}
      </span>
      <span className="text-gray-400">+</span>
      <span className="inline-flex items-center gap-1 rounded-sm bg-black/[0.025] px-1 py-0.5 text-gray-500 dark:bg-white/5 dark:text-gray-400">
        <ArrowUp size={12} />
        {format(output)}
      </span>
    </span>
  );
}
