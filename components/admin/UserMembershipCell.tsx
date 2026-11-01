"use client";
import { Popover } from "@base-ui/react/popover";
import { useState } from "react";
import toast from "react-hot-toast";
import { ChevronDown, Infinity as InfinityIcon } from "lucide-react";
import { AppSelect } from "@/components/ui/AppSelect";
import { AppInput } from "@/components/ui/AppInput";
import { PLAN_IDS, PLAN_NAMES, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { AdminButton } from "./AdminPrimitives";

const toLocalInput = (value: string | Date) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const tierClass: Record<string, string> = {
  free: "bg-gray-100 text-gray-600 dark:bg-white/[0.07] dark:text-gray-400",
  lifetime: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
};

/** Membership summary; clicking opens an inline editor with explicit save/cancel. */
export function UserMembershipCell({
  userId,
  membership,
}: {
  userId: string;
  membership?: { tier: string; expiresAt: string | null };
}) {
  const initial = {
    tier: membership?.tier ?? "free",
    date: membership?.expiresAt ? toLocalInput(membership.expiresAt) : "",
  };
  const [saved, setSaved] = useState(initial);
  const [tier, setTier] = useState(initial.tier);
  const [date, setDate] = useState(initial.date);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const permanent = tier === "lifetime";
  const paid = tier !== "free" && !permanent;
  const dirty = tier !== saved.tier || (paid && date !== saved.date);
  const expired =
    saved.date &&
    saved.tier !== "free" &&
    saved.tier !== "lifetime" &&
    Date.parse(saved.date) <= Date.now();
  const daysLeft =
    saved.date && !expired ? Math.ceil((Date.parse(saved.date) - Date.now()) / 86400000) : null;

  async function save() {
    if (paid && (!date || Date.parse(date) <= Date.now()))
      return toast.error("请选择未来的到期时间");
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/membership`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, expiresAt: paid ? new Date(date).toISOString() : null }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "会员保存失败");
      setSaved({ tier, date: paid ? date : "" });
      setEditing(false);
      toast.success("会员已更新");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setBusy(false);
    }
  }

  const reset = () => {
    setTier(saved.tier);
    setDate(saved.date);
  };

  return (
    <Popover.Root
      open={editing}
      onOpenChange={(open) => {
        if (busy) return;
        if (!open) reset();
        setEditing(open);
      }}
    >
      <Popover.Trigger
        aria-label={`编辑会员：${PLAN_NAMES[saved.tier as PlanId] || saved.tier}`}
        className="group inline-flex min-h-10 items-center gap-2 rounded-md px-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/25 md:min-h-8"
        type="button"
      >
        <span
          className={cn(
            "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium",
            tierClass[saved.tier] ||
              "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
          )}
        >
          {saved.tier === "lifetime" && <InfinityIcon size={12} />}
          {PLAN_NAMES[saved.tier as PlanId] || saved.tier}
        </span>
        {saved.tier !== "free" && saved.tier !== "lifetime" && (
          <span
            className={cn(
              "whitespace-nowrap text-[11px]",
              expired ? "text-red-500" : "text-gray-400",
            )}
          >
            {expired ? "已过期" : `剩 ${daysLeft} 天`}
          </span>
        )}
        <ChevronDown
          className="text-gray-300 transition-colors group-hover:text-gray-500 dark:text-gray-600"
          size={13}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="start" className="z-[80]" collisionPadding={12} sideOffset={6}>
          <Popover.Popup className="w-[280px] max-w-[calc(100vw-24px)] rounded-xl border border-gray-200 bg-[var(--chat-popover-bg)] p-3 shadow-[0_12px_36px_rgba(0,0,0,0.14)] outline-none dark:border-white/10">
            <p className="mb-3 text-sm font-semibold">调整会员</p>
            <label className="block">
              <span className="mb-1.5 block text-xs text-gray-500">会员等级</span>
              <AppSelect
                aria-label="会员等级"
                disabled={busy}
                onChange={(value) => {
                  setTier(value);
                  if (!date && value !== "free" && value !== "lifetime")
                    setDate(toLocalInput(new Date(Date.now() + 30 * 86400000)));
                }}
                options={PLAN_IDS.map((value) => ({ value, label: PLAN_NAMES[value] }))}
                style={{ width: "100%" }}
                value={tier}
              />
            </label>
            {paid && (
              <label className="mt-3 block">
                <span className="mb-1.5 block text-xs text-gray-500">到期时间</span>
                <AppInput
                  aria-label="会员到期时间"
                  className="!h-9 !text-sm"
                  disabled={busy}
                  onChange={(event) => setDate(event.target.value)}
                  type="datetime-local"
                  value={date}
                />
                <span className="mt-1.5 flex gap-1">
                  {[30, 90, 365].map((days) => (
                    <button
                      className="min-h-7 rounded-md bg-gray-100 px-2 text-[11px] text-gray-600 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/10"
                      key={days}
                      onClick={() => setDate(toLocalInput(new Date(Date.now() + days * 86400000)))}
                      type="button"
                    >
                      {days === 365 ? "1 年" : `${days} 天`}
                    </button>
                  ))}
                </span>
              </label>
            )}
            {permanent && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
                <InfinityIcon size={13} /> 永久有效，不限额度
              </p>
            )}
            {tier === "free" && (
              <p className="mt-3 text-xs text-gray-500">恢复为免费版，立即生效</p>
            )}
            <div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-3 dark:border-white/[0.06]">
              <AdminButton
                disabled={busy}
                onClick={() => {
                  reset();
                  setEditing(false);
                }}
              >
                取消
              </AdminButton>
              <AdminButton disabled={!dirty} loading={busy} onClick={() => void save()} primary>
                保存
              </AdminButton>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
