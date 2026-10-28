"use client";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { AppPasswordInput } from "@/components/ui/AppInput";
import { authClient } from "@/lib/auth-client";
import { SettingsButton, SettingsGroup, SettingRow } from "./SettingsPrimitives";
export function SecuritySettings() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next))
      return toast.error("新密码至少 8 位，需包含字母与数字");
    if (next !== confirm) return toast.error("两次输入的新密码不一致");
    setSaving(true);
    try {
      const result = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (result.error) {
        toast.error("密码修改失败，请检查当前密码后重试");
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("密码已更新，其他登录会话已退出");
    } catch {
      toast.error("暂时无法修改密码，请稍后重试");
    } finally {
      setSaving(false);
    }
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <SettingsGroup title="登录密码" description="修改后保留当前登录，其他登录会话将退出。">
        <SettingRow title="当前密码">
          <AppPasswordInput
            aria-label="当前密码"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            disabled={saving}
          />
        </SettingRow>
        <SettingRow title="新密码" description="至少 8 位，包含字母与数字">
          <AppPasswordInput
            aria-label="新密码"
            autoComplete="new-password"
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
            disabled={saving}
          />
        </SettingRow>
        <SettingRow title="确认新密码">
          <AppPasswordInput
            aria-label="确认新密码"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={saving}
          />
        </SettingRow>
      </SettingsGroup>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/reset-password" className="text-xs text-gray-500 underline underline-offset-4">
          忘记密码或尚未设置密码？
        </Link>
        <SettingsButton type="submit" disabled={saving || !current || !next || !confirm}>
          {saving ? "正在更新…" : "更新密码"}
        </SettingsButton>
      </div>
    </form>
  );
}
