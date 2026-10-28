"use client";
import { Check, CreditCard, Gift, Wallet } from "lucide-react";
import { SettingsButton, SettingsEmpty, SettingsGroup, SettingRow } from "./SettingsPrimitives";

// Billing has no ledger/provider in MarkAI yet. Never infer balances or pricing from token estimates.
export function SubscriptionSettings({
  section,
}: {
  section: "plans" | "credits" | "billing" | "referral";
}) {
  if (section === "plans")
    return (
      <>
        <SettingsGroup title="当前服务">
          <SettingRow title="账户状态" description="当前使用由站点提供的模型或你配置的个人模型服务">
            <span className="rounded-md bg-gray-200/50 px-2 py-1 text-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">
              未启用订阅计费
            </span>
          </SettingRow>
          <SettingRow title="支付服务">
            <span className="text-sm text-gray-500">尚未开放</span>
          </SettingRow>
        </SettingsGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 p-5 dark:border-white/10">
            <p className="text-sm font-semibold">当前工作空间</p>
            <p className="mt-2 text-xs leading-6 text-gray-500">继续使用现有账户权限与模型配置。</p>
            <ul className="my-5 space-y-3 text-sm text-gray-600 dark:text-gray-300">
              {["对话与历史记录", "个人模型服务配置", "文件与技能工具", "外观与个性化设置"].map(
                (text) => (
                  <li className="flex items-center gap-2" key={text}>
                    <Check size={14} />
                    {text}
                  </li>
                ),
              )}
            </ul>
            <SettingsButton disabled className="w-full">
              当前服务
            </SettingsButton>
          </div>
          <div className="rounded-xl border border-gray-200 p-5 dark:border-white/10">
            <p className="text-sm font-semibold">付费订阅</p>
            <p className="mt-2 text-xs leading-6 text-gray-500">
              套餐、价格与权益尚未公布。开放后可在此查看并升级。
            </p>
            <div className="flex min-h-36 items-center justify-center text-gray-300 dark:text-gray-600">
              <CreditCard size={36} strokeWidth={1.3} />
            </div>
            <SettingsButton disabled className="w-full">
              暂未开放
            </SettingsButton>
          </div>
        </div>
      </>
    );
  if (section === "credits")
    return (
      <>
        <SettingsGroup title="积分账户">
          <SettingRow title="可用余额" description="积分服务尚未启用">
            <span className="font-jakarta text-2xl text-gray-400">—</span>
          </SettingRow>
          <SettingRow title="充值">
            <SettingsButton disabled>
              <Wallet size={15} />
              暂未开放
            </SettingsButton>
          </SettingRow>
        </SettingsGroup>
        <SettingsGroup title="积分明细">
          <SettingsEmpty
            title="暂无积分账本"
            description="积分服务开放后，这里将记录充值、赠送与消耗明细。"
          />
        </SettingsGroup>
      </>
    );
  if (section === "billing")
    return (
      <>
        <SettingsGroup title="付款方式">
          <SettingRow title="支付服务" description="当前没有绑定付款方式，也不会从这里自动扣款">
            <SettingsButton disabled>暂未开放</SettingsButton>
          </SettingRow>
        </SettingsGroup>
        <SettingsGroup title="账单与发票">
          <SettingsEmpty
            title="暂无账单"
            description="订阅支付开放后，可在这里查看付款记录与账单详情。"
          />
        </SettingsGroup>
      </>
    );
  return (
    <SettingsGroup title="邀请奖励">
      <SettingsEmpty
        title="邀请奖励计划尚未开放"
        description="开放后，你可以在这里获取邀请链接并查看奖励记录。"
      >
        <SettingsButton disabled>
          <Gift size={15} />
          暂未开放
        </SettingsButton>
      </SettingsEmpty>
    </SettingsGroup>
  );
}
