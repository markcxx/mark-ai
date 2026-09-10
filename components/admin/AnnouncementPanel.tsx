"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AdminButton, AdminError, AdminLoading } from "./AdminPrimitives";
import { AppInput, AppTextArea } from "@/components/ui/AppInput";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { AnnouncementSurface } from "@/components/AnnouncementSurface";
import { DEFAULT_ANNOUNCEMENT, isAnnouncementUrl } from "@/lib/announcement-config";
import type { AnnouncementConfig } from "@/lib/announcement-config";

export function AnnouncementPanel() {
  const [form, setForm] = useState<AnnouncementConfig>(DEFAULT_ANNOUNCEMENT);
  const [saved, setSaved] = useState<AnnouncementConfig>(DEFAULT_ANNOUNCEMENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [previewHidden, setPreviewHidden] = useState(false);
  function change(patch: Partial<AnnouncementConfig>) {
    setForm((current) => ({ ...current, ...patch }));
    setPreviewHidden(false);
  }
  function config(value: AnnouncementConfig): AnnouncementConfig {
    return Object.fromEntries(
      Object.keys(DEFAULT_ANNOUNCEMENT).map((key) => [
        key,
        value[key as keyof AnnouncementConfig] ??
          DEFAULT_ANNOUNCEMENT[key as keyof AnnouncementConfig],
      ]),
    ) as AnnouncementConfig;
  }
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/admin/announcement", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("公告加载失败，请重试");
        const { announcement } = await response.json();
        const data = config(announcement);
        setForm(data);
        setSaved(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);
  async function save() {
    if (
      form.actionEnabled &&
      (!form.actionLabel.trim() || !isAnnouncementUrl(form.actionUrl.trim()))
    ) {
      toast.error("请填写按钮文字及有效的站内路径或 HTTP/HTTPS 跳转地址");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/announcement", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "公告保存失败");
      const next = config(data.announcement);
      setForm(next);
      setSaved(next);
      toast.success(next.enabled && next.content ? "公告已发布" : "公告已关闭，内容已保留");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }
  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={() => setRetry((v) => v + 1)} />;
  return (
    <section className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">站点公告</h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          配置聊天页和下载页顶部的彩色公告栏。关闭显示后保留内容，方便下次启用。
        </p>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-white/10">
        {(
          [
            ["enabled", "显示站点公告", "控制公告是否对访客和用户显示"],
            [
              "closable",
              "允许用户关闭公告",
              "开启后显示关闭按钮；用户关闭后在当前浏览器持续隐藏，发布新公告后再次显示",
            ],
            ["actionEnabled", "显示跳转按钮", "在公告右侧显示可跳转的操作按钮"],
          ] as const
        ).map(([key, label, description]) => (
          <label
            key={key}
            className="flex min-h-16 cursor-pointer items-center justify-between gap-4 py-3"
          >
            <span>
              <span className="block text-sm font-medium">{label}</span>
              <span className="mt-1 block text-xs leading-5 text-gray-500">{description}</span>
            </span>
            <button
              role="switch"
              type="button"
              aria-label={label}
              aria-checked={form[key]}
              disabled={saving}
              onClick={() => change({ [key]: !form[key] })}
              className="flex h-11 w-11 shrink-0 items-center justify-center"
            >
              <ToggleSwitch checked={form[key]} disabled={saving} />
            </button>
          </label>
        ))}
      </div>
      <div>
        <label htmlFor="announcement-content" className="mb-2 block text-sm font-medium">
          公告内容
        </label>
        <AppTextArea
          id="announcement-content"
          rows={4}
          maxLength={1000}
          value={form.content}
          disabled={saving}
          onChange={(e) => change({ content: e.target.value })}
          placeholder="输入要展示的公告文字"
        />
        <p className="mt-2 text-right text-xs text-gray-400">{form.content.length} / 1000</p>
      </div>
      {form.actionEnabled && (
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <div>
            <label htmlFor="announcement-action-label" className="mb-2 block text-sm font-medium">
              按钮文字
            </label>
            <AppInput
              id="announcement-action-label"
              maxLength={24}
              disabled={saving}
              value={form.actionLabel}
              onChange={(e) => change({ actionLabel: e.target.value })}
              placeholder="立即下载"
            />
          </div>
          <div>
            <label htmlFor="announcement-action-url" className="mb-2 block text-sm font-medium">
              跳转地址
            </label>
            <AppInput
              id="announcement-action-url"
              maxLength={2048}
              disabled={saving}
              value={form.actionUrl}
              onChange={(e) => change({ actionUrl: e.target.value })}
              placeholder="/download 或 https://example.com"
            />
          </div>
        </div>
      )}
      {form.content.trim() && (
        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
            <span>显示预览{!form.enabled && " · 公告当前已关闭"}</span>
            {previewHidden && (
              <button
                type="button"
                className="min-h-10 underline"
                onClick={() => setPreviewHidden(false)}
              >
                重新预览
              </button>
            )}
          </div>
          {!previewHidden && (
            <AnnouncementSurface
              announcement={form}
              preview
              onClose={() => setPreviewHidden(true)}
            />
          )}
        </div>
      )}
      <AdminButton
        primary
        disabled={saving || JSON.stringify(form) === JSON.stringify(saved)}
        onClick={() => void save()}
      >
        {saving ? "正在保存…" : "保存公告设置"}
      </AdminButton>
    </section>
  );
}
