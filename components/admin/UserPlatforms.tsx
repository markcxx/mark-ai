import { Monitor, Smartphone, CircleHelp } from "lucide-react";

import { CLIENT_PLATFORM_LABELS, type UserPlatformUsage } from "@/lib/client-platform";
import { formatDateTime } from "./AdminPrimitives";

export function UserPlatformBadges({ platforms = [] }: { platforms?: UserPlatformUsage[] }) {
  if (!platforms.length) return <span className="text-xs text-gray-400">暂无记录</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {platforms.map(({ platform }) => {
        const Icon =
          platform === "android" ? Smartphone : platform === "web" ? Monitor : CircleHelp;
        return (
          <span
            key={platform}
            className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-white/[0.06] dark:text-gray-400"
          >
            <Icon size={12} aria-hidden="true" />
            {CLIENT_PLATFORM_LABELS[platform]}
          </span>
        );
      })}
    </div>
  );
}

export function UserPlatformHistory({ platforms = [] }: { platforms?: UserPlatformUsage[] }) {
  return (
    <div>
      <h3 className="font-semibold">使用平台</h3>
      <p className="mt-1 text-xs text-gray-400">
        退出登录后保留记录，最近使用时间约每 5 分钟更新。历史信息不足时显示未知。
      </p>
      <div className="mt-3 divide-y divide-gray-100 dark:divide-white/[0.06]">
        {platforms.map((usage) => (
          <div
            key={usage.platform}
            className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex flex-wrap items-center gap-2">
              <UserPlatformBadges platforms={[usage]} />
              {usage.platform === "android" && (
                <span className="text-xs text-gray-500">
                  最近版本：{usage.appVersion || "未知"}
                </span>
              )}
            </div>
            <div className="space-y-1 text-xs text-gray-500">
              <p>最近使用：{formatDateTime(usage.lastSeenAt)}</p>
              <p>首次记录：{formatDateTime(usage.firstSeenAt)}</p>
            </div>
          </div>
        ))}
        {!platforms.length && <p className="py-3 text-sm text-gray-400">暂无平台使用记录</p>}
      </div>
    </div>
  );
}
