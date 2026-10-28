"use client";

import { Camera, UserRound, Pencil } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import AppImage from "@/components/ui/AppImage";
import { AppInput, AppTextArea } from "@/components/ui/AppInput";
import { IconButton } from "@/components/ui/IconButton";
import { AppSelect } from "@/components/ui/AppSelect";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { uploadFile } from "@/lib/client/file-upload";
import { useSession } from "@/lib/auth-client";
import { useSettingsStore } from "@/stores/useSettingsStore";
import {
  SettingsProfileRow,
  SettingsButton,
  SettingsError,
  SettingsGroup,
  SettingsSkeleton,
  SettingRow,
} from "./SettingsPrimitives";

export type UserProfile = {
  age?: number | null;
  avatar?: string | null;
  email?: string;
  fullName?: string | null;
  profileCompleted?: boolean;
  role?: string | null;
  username?: string | null;
};

export function ProfileSettings({
  initialProfile,
  fallbackName = "",
  fallbackAvatar,
  email,
  onSaved,
  onSavingChange,
  onSecurity,
}: {
  initialProfile?: UserProfile | null;
  fallbackName?: string;
  fallbackAvatar?: string | null;
  email?: string;
  onSaved?: (profile: UserProfile) => void;
  onSavingChange?: (saving: boolean) => void;
  onSecurity?: () => void;
}) {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile || null);
  const [name, setName] = useState(initialProfile?.fullName || fallbackName);
  const [age, setAge] = useState(initialProfile?.age ? String(initialProfile.age) : "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch("/api/profile", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "无法加载个人资料");
        return body.user as UserProfile;
      })
      .then((user) => {
        if (controller.signal.aborted) return;
        setProfile(user);
        setName(user.fullName || fallbackName);
        setAge(user.age ? String(user.age) : "");
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "无法加载个人资料");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry, fallbackName]);
  useEffect(() => {
    if (!avatarFile) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);
  const save = async () => {
    const fullName = name.trim();
    const years = age ? Number(age) : undefined;
    if (fullName.length < 2) return toast.error("昵称至少需要 2 个字符");
    if (years !== undefined && (!Number.isInteger(years) || years < 6 || years > 120))
      return toast.error("请输入 6～120 岁之间的有效年龄");
    setSaving(true);
    onSavingChange?.(true);
    try {
      if (avatarFile) await uploadFile(avatarFile, { kind: "avatar" });
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, ...(years !== undefined ? { age: years } : {}) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "保存失败");
      const refreshed = await fetch("/api/profile", { cache: "no-store" });
      const next = await refreshed.json();
      if (!refreshed.ok) throw new Error(next.error || "资料刷新失败");
      setProfile(next.user);
      setAvatarFile(null);
      window.dispatchEvent(new CustomEvent("markai:profile-updated", { detail: next.user }));
      toast.success("个人资料已更新");
      onSaved?.(next.user);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  };
  if (loading) return <SettingsSkeleton />;
  if (error)
    return <SettingsError message={error} onRetry={() => setRetry((value) => value + 1)} />;
  const avatar = preview || profile?.avatar || fallbackAvatar || session?.user.image;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <SettingsGroup title="账户资料">
        <SettingsProfileRow title="头像" description="支持 JPG、PNG 和 WebP 图片">
          <div className="flex w-full items-center justify-end gap-3">
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-gray-500 dark:bg-white/10">
              {avatar ? (
                <AppImage
                  native
                  src={avatar}
                  alt="用户头像"
                  width={56}
                  height={56}
                  className="object-cover"
                />
              ) : (
                <UserRound size={24} />
              )}
            </span>
            <SettingsButton onClick={() => input.current?.click()} disabled={saving}>
              <Camera size={15} />
              更换头像
            </SettingsButton>
            <input
              ref={input}
              className="hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
            />
          </div>
        </SettingsProfileRow>
        <SettingsProfileRow title="昵称">
          <ProfileValueEditor label="昵称" value={name} editingByDefault={Boolean(onSaved)}>
            <AppInput
              aria-label="昵称"
              value={name}
              maxLength={40}
              disabled={saving}
              onChange={(event) => setName(event.target.value)}
            />
          </ProfileValueEditor>
        </SettingsProfileRow>
        {profile?.username && (
          <SettingsProfileRow title="用户名">
            <span className="text-sm text-gray-500">{profile.username}</span>
          </SettingsProfileRow>
        )}
        {onSecurity && (
          <SettingsProfileRow title="密码">
            <span className="text-sm text-gray-500">••••••••</span>
            <SettingsButton onClick={onSecurity}>修改密码</SettingsButton>
          </SettingsProfileRow>
        )}
        <SettingsProfileRow title="邮箱">
          <span className="block break-all text-sm text-gray-500">
            {profile?.email || email || session?.user.email || "未绑定"}
          </span>
        </SettingsProfileRow>
        <SettingsProfileRow title="年龄">
          <ProfileValueEditor
            label="年龄"
            value={age || "未填写"}
            editingByDefault={Boolean(onSaved)}
          >
            <AppInput
              className="w-24"
              aria-label="年龄"
              type="number"
              min={6}
              max={120}
              value={age}
              disabled={saving}
              onChange={(event) => setAge(event.target.value)}
            />
          </ProfileValueEditor>
        </SettingsProfileRow>
        <SettingsProfileRow title="账户角色">
          <span className="text-sm text-gray-500">
            {profile?.role === "admin" ? "管理员" : "用户"}
          </span>
        </SettingsProfileRow>
      </SettingsGroup>
      <div className="flex justify-end">
        <SettingsButton
          type="submit"
          disabled={saving}
          className="bg-gray-950 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-950"
        >
          {saving ? "正在保存…" : "保存资料"}
        </SettingsButton>
      </div>
    </form>
  );
}

function ProfileValueEditor({
  label,
  value,
  children,
  editingByDefault = false,
}: {
  label: string;
  value: string;
  children: ReactNode;
  editingByDefault?: boolean;
}) {
  const [editing, setEditing] = useState(editingByDefault);
  return (
    <>
      <div className="min-w-0 flex-1">
        {editing ? (
          children
        ) : (
          <span className="block truncate text-sm text-gray-600 dark:text-gray-300">
            {value || "未填写"}
          </span>
        )}
      </div>
      <IconButton
        aria-label={`${editing ? "收起" : "编辑"}${label}`}
        data-markai-tooltip={`${editing ? "收起编辑" : "编辑"}${label}`}
        onClick={() => setEditing((v) => !v)}
        size="sm"
      >
        <Pencil size={15} />
      </IconButton>
    </>
  );
}

export function PersonalizationSettings() {
  const settings = useSettingsStore((state) => state.languageModel);
  const update = useSettingsStore((state) => state.updateLanguageModel);
  return (
    <>
      <SettingsGroup title="个人偏好" description="启用后，这些信息会用于后续对话的回复指导。">
        <SettingRow title="启用个性化">
          <ToggleSwitch
            checked={settings.personalizationEnabled}
            onChange={(personalizationEnabled) => update({ personalizationEnabled })}
          />
        </SettingRow>
        <SettingRow title="如何称呼你">
          <AppInput
            aria-label="如何称呼你"
            defaultValue={settings.preferredName}
            maxLength={60}
            onBlur={(e) => update({ preferredName: e.target.value })}
          />
        </SettingRow>
        <SettingRow title="职业">
          <AppInput
            aria-label="职业"
            defaultValue={settings.occupation}
            maxLength={120}
            onBlur={(e) => update({ occupation: e.target.value })}
          />
        </SettingRow>
        <SettingRow title="兴趣与背景" stacked>
          <AppTextArea
            aria-label="兴趣与背景"
            defaultValue={settings.interests}
            maxLength={500}
            onBlur={(e) => update({ interests: e.target.value })}
          />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="回复方式" description="启用个性化后应用于后续对话">
        <SettingRow title="回复语言">
          <AppSelect
            aria-label="回复语言"
            value={settings.responseLanguage}
            options={[
              { value: "auto", label: "跟随对话" },
              { value: "zh-CN", label: "简体中文" },
              { value: "en-US", label: "English" },
            ]}
            onChange={(value) =>
              update({ responseLanguage: value as typeof settings.responseLanguage })
            }
          />
        </SettingRow>
        <SettingRow title="回复长度">
          <AppSelect
            aria-label="回复长度"
            value={settings.responseLength}
            options={[
              { value: "concise", label: "简洁" },
              { value: "balanced", label: "适中" },
              { value: "detailed", label: "详细" },
            ]}
            onChange={(value) =>
              update({ responseLength: value as typeof settings.responseLength })
            }
          />
        </SettingRow>
        <SettingRow title="回复语气">
          <AppSelect
            aria-label="回复语气"
            value={settings.responseTone}
            options={[
              { value: "direct", label: "直接" },
              { value: "friendly", label: "友好" },
              { value: "professional", label: "专业" },
            ]}
            onChange={(value) => update({ responseTone: value as typeof settings.responseTone })}
          />
        </SettingRow>
        <SettingRow title="自定义指令" description="描述你希望模型遵循的表达习惯与工作要求" stacked>
          <AppTextArea
            aria-label="自定义指令"
            rows={6}
            defaultValue={settings.customInstructions}
            maxLength={4000}
            onBlur={(e) => update({ customInstructions: e.target.value })}
          />
        </SettingRow>
      </SettingsGroup>
    </>
  );
}
