"use client";

import { motion } from "motion/react";
import { CakeSlice, Camera, LoaderCircle, Mail, ShieldCheck, UserRound, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";

import { IconButton } from "@/components/ui/IconButton";

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
  const previewUrl = useMemo(() => avatarFile ? URL.createObjectURL(avatarFile) : "", [avatarFile]);
  const displayAvatar = previewUrl || avatarUrl;
  const initials = (name.trim() || fallbackName).slice(0, 2).toUpperCase();

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  const uploadAvatar = async (file: File) => {
    const presign = await fetch("/api/files/presign", {
      body: JSON.stringify({ contentType: file.type, kind: "avatar", name: file.name, size: file.size }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const task = await presign.json();
    if (!presign.ok) throw new Error(task.error || "头像上传准备失败");

    const upload = await fetch(task.uploadUrl, {
      body: file,
      headers: { "Content-Type": file.type },
      method: "PUT",
    });
    if (!upload.ok) {
      await fetch(`/api/files/${task.file.id}`, { method: "DELETE" }).catch(() => undefined);
      throw new Error("头像上传失败");
    }

    const complete = await fetch("/api/files/complete", {
      body: JSON.stringify({ id: task.file.id }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = await complete.json();
    if (!complete.ok) throw new Error(result.error || "头像校验失败");
    return result.file.url as string;
  };

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
        const nextAvatar = await uploadAvatar(avatarFile);
        setAvatarUrl(nextAvatar);
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

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      animate={{ opacity: 1 }}
      aria-label="个人资料"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 px-4 py-6 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
      role="dialog"
    >
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative max-h-full w-full max-w-md overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.2)] dark:border-white/10 dark:bg-[#17181a]"
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className="flex h-16 items-center border-b border-gray-100 px-5 dark:border-white/[0.07]">
          <h2 className="text-base font-semibold text-gray-950 dark:text-gray-50">个人资料</h2>
          <IconButton
            className="absolute right-3 top-3.5 bg-transparent hover:bg-gray-100 dark:bg-transparent dark:hover:bg-white/[0.08]"
            disabled={saving}
            onClick={onClose}
            size="sm"
            title="关闭个人资料"
          >
            <X size={17} />
          </IconButton>
        </header>

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
                <Image alt="用户头像" className="h-full w-full object-cover" fill sizes="96px" src={displayAvatar} unoptimized />
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
                <span className="min-w-0 flex-1 truncate text-sm">{currentProfile?.email || email}</span>
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
                  <span className="truncate text-sm">{currentProfile?.role === "admin" ? "管理员" : "普通用户"}</span>
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
      </motion.div>
    </motion.div>,
    document.body,
  );
}
