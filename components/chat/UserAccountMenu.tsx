"use client";

import type { PlanId } from "@/lib/plans";
import { useCreditStore } from "@/stores/useCreditStore";
import { CreditMeter, MembershipBadge } from "./MembershipBadge";
import dynamic from "next/dynamic";
const PlansDialog = dynamic(() => import("./PlansDialog").then((m) => m.PlansDialog));

import { useOpenSettings } from "@/hooks/useOpenSettings";

import {
  ChevronUp,
  CircleUserRound,
  FolderOpen,
  LogOut,
  Settings,
  ShieldCheck,
  Download,
} from "lucide-react";
import Image from "@/components/ui/AppImage";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { signOut, useSession } from "@/lib/auth-client";
import { useUIStore } from "@/stores/useUIStore";

import { FileManagerDrawer } from "./FileManagerDrawer";
import { ProfileDialog } from "./ProfileDialog";
import type { UserProfile } from "./ProfileDialog";

export function UserAccountMenu() {
  const { data } = useSession();
  const fileManagerOpen = useUIStore((state) => state.fileManagerOpen);
  const openSettings = useOpenSettings();
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const credits = useCreditStore((state) => state.summary);
  const tier = (credits?.tier || "free") as PlanId;
  const userId = data?.user?.id;
  // Refresh on sign-in, when the menu opens and after the plans dialog closes
  // (a purchase may have changed the tier).
  useEffect(() => {
    if (!userId) return;
    void useCreditStore.getState().load(open || !plansOpen);
  }, [userId, open, plansOpen]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const user = data?.user;
  const name = profile?.fullName || user?.name || user?.email?.split("@")[0] || "MarkAI 用户";
  const initials = name.slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (!user) return;
    void Promise.all([
      fetch("/api/profile")
        .then((response) => response.json())
        .then((data) => setProfile(data.user || null)),
      fetch("/api/admin/me")
        .then((response) => (response.ok ? response.json() : undefined))
        .then((data) => setIsAdmin(!!data?.admin)),
    ]).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    const refreshProfile = (event: Event) => setProfile((event as CustomEvent<UserProfile>).detail);
    window.addEventListener("markai:profile-updated", refreshProfile);
    return () => window.removeEventListener("markai:profile-updated", refreshProfile);
  }, []);

  if (!user) return null;

  return (
    <>
      <div className="relative" ref={rootRef}>
        {open && (
          <div className="absolute bottom-[calc(100%+10px)] left-0 right-0 origin-bottom animate-[menu-in_180ms_cubic-bezier(0.22,1,0.36,1)] overflow-hidden rounded-lg border border-black/[0.06] bg-white/95 p-1.5 shadow-[0_18px_55px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[#171717]/95">
            <div className="border-b border-gray-100 px-3 py-2.5 dark:border-white/[0.07]">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                {name}
              </p>
              <p className="mt-0.5 truncate text-xs text-gray-400">{user.email}</p>
            </div>
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setPlansOpen(true);
                }}
                className="mb-1 block w-full rounded-lg bg-gray-100/80 px-3 py-2.5 text-left transition-colors hover:bg-gray-100 dark:bg-white/[0.06] dark:hover:bg-white/10"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <MembershipBadge tier={tier} />
                    {tier === "free" ? "升级会员" : tier === "lifetime" ? "永久会员" : "我的套餐"}
                  </span>
                  <span className="shrink-0 text-xs text-gray-500">
                    {tier === "free" ? "查看套餐 →" : tier === "lifetime" ? "" : "续费 / 升级 →"}
                  </span>
                </span>
                {credits && (
                  <span className="mt-2.5 block">
                    <CreditMeter
                      periodEnd={credits.unlimited ? undefined : credits.periodEnd}
                      remaining={credits.remaining}
                      total={credits.total}
                      unit={credits.unit}
                      unlimited={credits.unlimited}
                    />
                  </span>
                )}
              </button>
              <Link
                href="/download"
                onClick={() => setOpen(false)}
                className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/[0.07]"
              >
                <Download className="text-gray-400" size={17} />
                下载 App
              </Link>
              <button
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 transition-all hover:bg-gray-100 active:scale-[0.98] dark:text-gray-200 dark:hover:bg-white/[0.07]"
                onClick={() => {
                  setOpen(false);
                  useUIStore.getState().setFileManagerOpen(true);
                }}
                type="button"
              >
                <FolderOpen className="text-gray-400" size={17} />
                文件管理
              </button>
              <button
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 transition-all hover:bg-gray-100 active:scale-[0.98] dark:text-gray-200 dark:hover:bg-white/[0.07]"
                onClick={() => {
                  setOpen(false);
                  setProfileOpen(true);
                }}
                type="button"
              >
                <CircleUserRound className="text-gray-400" size={17} />
                个人资料
              </button>
              <button
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 transition-all hover:bg-gray-100 active:scale-[0.98] dark:text-gray-200 dark:hover:bg-white/[0.07]"
                onClick={() => {
                  setOpen(false);
                  openSettings();
                }}
                type="button"
              >
                <Settings className="text-gray-400" size={17} />
                设置
              </button>
              {isAdmin && (
                <button
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 transition-all hover:bg-gray-100 active:scale-[0.98] dark:text-gray-200 dark:hover:bg-white/[0.07]"
                  onClick={() => {
                    setOpen(false);
                    window.location.href = "/admin";
                  }}
                  type="button"
                >
                  <ShieldCheck className="text-gray-400" size={17} />
                  管理后台
                </button>
              )}
            </div>
            <div className="border-t border-gray-100 pt-1 dark:border-white/[0.07]">
              <button
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-red-600 transition-all hover:bg-red-50 active:scale-[0.98] dark:text-red-400 dark:hover:bg-red-500/10"
                onClick={async () => {
                  setOpen(false);
                  await signOut();
                  window.location.href = "/login";
                }}
                type="button"
              >
                <LogOut size={17} />
                退出登录
              </button>
            </div>
          </div>
        )}

        <button
          aria-expanded={open}
          className="group flex w-full items-center gap-3 rounded-lg p-2 text-left transition-all hover:bg-black/[0.045] active:scale-[0.985] dark:hover:bg-white/[0.07]"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-400 text-sm font-bold text-white shadow-sm ring-2 ${
              {
                free: "ring-white dark:ring-black",
                starter: "ring-sky-300 dark:ring-sky-500/60",
                plus: "ring-violet-400 dark:ring-violet-500/70",
                pro: "ring-fuchsia-400 dark:ring-fuchsia-500/70",
                lifetime: "ring-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.45)]",
              }[tier] || "ring-white dark:ring-black"
            }`}
          >
            {profile?.avatar || user.image ? (
              <Image
                alt={name}
                className="h-full w-full object-cover"
                height={40}
                src={profile?.avatar || user.image || ""}
                unoptimized
                width={40}
              />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                {name}
              </span>
              <MembershipBadge tier={tier} />
            </p>
            <p className="truncate text-xs text-gray-400">{user.email}</p>
          </div>
          <ChevronUp
            className={`text-gray-400 transition-transform duration-200 ${open ? "" : "rotate-180"}`}
            size={16}
          />
        </button>
      </div>
      {plansOpen && <PlansDialog onClose={() => setPlansOpen(false)} />}
      <FileManagerDrawer
        onClose={() => useUIStore.getState().setFileManagerOpen(false)}
        open={fileManagerOpen}
      />
      {profileOpen && (
        <ProfileDialog
          email={user.email}
          fallbackAvatar={user.image}
          fallbackName={name}
          onClose={() => setProfileOpen(false)}
          onProfileUpdated={setProfile}
          profile={profile}
        />
      )}
    </>
  );
}
