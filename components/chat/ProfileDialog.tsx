"use client";

import { CakeSlice, Camera, LoaderCircle, Mail, ShieldCheck, UserRound } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import { AppDialog } from "@/components/ui/AppDialog";
import { uploadFile } from "@/lib/client/file-upload";

export type UserProfile = {
  age?: number | null;
  avatar?: string | null;
  email?: string;
  fullName?: string | null;
  profileCompleted?: boolean;
  role?: string | null;
};

export function ProfileDialog({
  email,
  fallbackAvatar,
  fallbackName,
  onClose,
  onProfileUpdated,
  profile,
}: {
  email: string;
  fallbackAvatar?: string | null;
  fallbackName: string;
  onClose: () => void;
  onProfileUpdated: (profile: UserProfile) => void;
  profile: UserProfile | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [age, setAge] = useState(profile?.age ? String(profile.age) : "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar || fallbackAvatar || "");
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(profile);
  const [name, setName] = useState(profile?.fullName || fallbackName);
  const [saving, setSaving] = useState(false);
  const previewUrl = useMemo(
    () => (avatarFile ? URL.createObjectURL(avatarFile) : ""),
    [avatarFile],
  );
  const displayAvatar = previewUrl || avatarUrl;
  const initials = (name.trim() || fallbackName).slice(0, 2).toUpperCase();

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  useEffect(() => {
    let active = true;
    void fetch("/api/profile", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "无法加载个人资料");
        return body.user as UserProfile;
      })
      .then((nextProfile) => {
        if (!active) return;
        setCurrentProfile(nextProfile);
        setName(nextProfile.fullName || fallbackName);
        setAge(nextProfile.age ? String(nextProfile.age) : "");
        setAvatarUrl(nextProfile.avatar || fallbackAvatar || "");
        onProfileUpdated(nextProfile);
      })
      .catch((error) => {
        if (active) toast.error(error instanceof Error ? error.message : "无法加载个人资料");
      });

    return () => {
      active = false;
    };
  }, [fallbackAvatar, fallbackName, onProfileUpdated]);

  const save = async () => {
    const fullName = name.trim();
    const ageValue = age ? Number(age) : undefined;
    if (fullName.length < 2) return toast.error("昵称至少需要 2 个字符");
    if (ageValue !== undefined && (!Number.isInteger(ageValue) || ageValue < 6 || ageValue > 120)) {
      return toast.error("请输入 6～120 岁之间的有效年龄");
    }

    setSaving(true);
    try {
      if (avatarFile) {
        const uploadedAvatar = await uploadFile(avatarFile, { kind: "avatar" });
        if (!uploadedAvatar.url) throw new Error("头像地址无效");
        setAvatarUrl(uploadedAvatar.url);
      }

      const response = await fetch("/api/profile", {
        body: JSON.stringify({
          ...(ageValue !== undefined ? { age: ageValue } : {}),
          fullName,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "个人资料保存失败");

      const refreshed = await fetch("/api/profile", { cache: "no-store" });
      const refreshedBody = await refreshed.json();
      if (!refreshed.ok) throw new Error(refreshedBody.error || "个人资料刷新失败");
      onProfileUpdated(refreshedBody.user);
      toast.success("个人资料已更新");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppDialog
      bodyClassName="min-h-0 overflow-y-auto"
      closeDisabled={saving}
      onClose={onClose}
      open
      title="个人资料"
      width={448}
      zIndex={80}
    >
      <div className="px-5 py-6">
        <input
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
          ref={inputRef}
          type="file"
        />

        <div className="flex flex-col items-center">
          <button
            className="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-lg font-semibold text-gray-500 ring-1 ring-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:ring-white/10"
            disabled={saving}
            onClick={() => inputRef.current?.click()}
            title="更换头像"
            type="button"
          >
            {displayAvatar ? (
              <Image
                alt="用户头像"
                className="h-full w-full object-cover"
                fill
                sizes="96px"
                src={displayAvatar}
                unoptimized
              />
            ) : (
              initials || <UserRound size={32} />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <Camera size={20} />
            </span>
          </button>
          <button
            className="mt-2 rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
            disabled={saving}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            更换头像
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">昵称</span>
            <div className="mt-1.5 flex h-10 items-center rounded-lg border border-gray-200 bg-white px-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10 dark:border-white/10 dark:bg-white/[0.03]">
              <UserRound className="mr-2.5 shrink-0 text-gray-400" size={17} />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                disabled={saving}
                maxLength={40}
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">邮箱</span>
            <div className="mt-1.5 flex h-10 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-gray-500 dark:border-white/10 dark:bg-white/[0.025] dark:text-gray-400">
              <Mail className="mr-2.5 shrink-0" size={17} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {currentProfile?.email || email}
              </span>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">年龄</span>
              <div className="mt-1.5 flex h-10 items-center rounded-lg border border-gray-200 bg-white px-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10 dark:border-white/10 dark:bg-white/[0.03]">
                <CakeSlice className="mr-2.5 shrink-0 text-gray-400" size={17} />
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  disabled={saving}
                  inputMode="numeric"
                  maxLength={3}
                  onChange={(event) => setAge(event.target.value.replace(/\D/g, "").slice(0, 3))}
                  placeholder="未设置"
                  value={age}
                />
              </div>
            </label>

            <div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">账户类型</span>
              <div className="mt-1.5 flex h-10 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-gray-500 dark:border-white/10 dark:bg-white/[0.025] dark:text-gray-400">
                <ShieldCheck className="mr-2.5 shrink-0" size={17} />
                <span className="truncate text-sm">
                  {currentProfile?.role === "admin" ? "管理员" : "普通用户"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-white/[0.07]">
        <button
          className="h-9 rounded-lg px-3 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-white/[0.06]"
          disabled={saving}
          onClick={onClose}
          type="button"
        >
          取消
        </button>
        <button
          className="inline-flex h-9 min-w-[88px] items-center justify-center gap-2 rounded-lg bg-gray-950 px-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
          disabled={saving}
          onClick={() => void save()}
          type="button"
        >
          {saving && <LoaderCircle className="animate-spin" size={15} />}
          保存更改
        </button>
      </footer>
    </AppDialog>
  );
}
