"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  FileText,
  MessageSquare,
  Monitor,
  Globe,
  Smartphone,
  RefreshCw,
} from "lucide-react";
import styles from "./DownloadPage.module.css";
import { DeviceIllustration } from "./DeviceIllustration";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { AndroidUpdate } from "@/lib/mobile/android-update";

export function DownloadPage() {
  const [update, setUpdate] = useState<AndroidUpdate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/public/android-update", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("暂时无法获取版本，请重试或前往 GitHub 下载。");
        const data = await response.json();
        setUpdate(data.update);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);
  const github = update?.downloads.find((item) => item.id === "github");
  const mirror = update?.downloads.find((item) => item.id === "mirror");
  return (
    <div className="h-dvh overflow-y-auto bg-[var(--chat-app-bg)] text-gray-950 dark:text-gray-100">
      <AnnouncementBar />
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 font-brand text-lg font-bold">
          <Image src="/images/markai.svg" alt="" width={32} height={32} priority />
          MarkAI
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle persist={false} />
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm hover:bg-gray-100 dark:hover:bg-white/10"
          >
            打开网页版
            <ArrowRight size={15} />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        <section className="grid items-center gap-8 py-8 sm:py-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
          <div>
            <p className="mb-3 text-sm text-gray-500">下载 MarkAI</p>
            <h1 className="text-3xl font-semibold leading-snug tracking-tight sm:text-4xl">
              在你习惯的设备上，
              <br />
              继续对话。
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-gray-500 dark:text-gray-400">
              多模型对话、图片与文件处理。使用 Android 客户端，或直接打开网页版。
            </p>
          </div>
          <DeviceIllustration />
        </section>
        <section
          aria-label="选择下载平台"
          className="grid items-stretch gap-5 pb-12 md:grid-cols-3"
        >
          <div className={styles.card} id="android">
            <div className={styles.heading}>
              <Smartphone size={23} />
              <h2 className="text-2xl font-semibold">Android</h2>
            </div>
            <p className={styles.description}>
              把 MarkAI 装进口袋，随时继续对话、上传文件，或拍照提问。
            </p>
            <ul className={styles.features}>
              <li>多模型对话与流式回复</li>
              <li>图片、文件和相机附件</li>
              <li>应用内检查更新，自选下载渠道</li>
            </ul>
            {loading ? (
              <div
                aria-label="正在获取 Android 版本"
                className="h-28 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5"
              />
            ) : (
              <>
                {update && (
                  <p className="mb-5 text-sm text-gray-500">
                    v{update.versionName} <span className="mx-2">·</span>{" "}
                    {(update.size / 1_000_000).toFixed(1)} MB <span className="mx-2">·</span>{" "}
                    Android 7.0 及以上
                  </p>
                )}
                <div className="mt-2 grid gap-3">
                  {mirror && (
                    <a
                      href={mirror.url}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
                    >
                      <ArrowDownToLine size={17} />
                      加速下载 APK
                    </a>
                  )}
                  <a
                    href={github?.url ?? "https://github.com/markcxx/mark-ai/releases"}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-medium transition hover:bg-gray-50 dark:border-white/20 dark:hover:bg-white/5"
                  >
                    GitHub 下载
                    <ArrowRight size={16} />
                  </a>
                </div>
                <p className="mt-3 text-xs leading-6 text-gray-500">
                  国内网络建议选择加速下载；两个渠道提供同一版本安装包。
                </p>
                {error && (
                  <div role="status" className="mt-4 text-sm leading-6 text-gray-500">
                    <p>{error}</p>
                    <button
                      className="mt-1 inline-flex min-h-11 items-center gap-2 underline underline-offset-4"
                      onClick={() => setRetry((v) => v + 1)}
                    >
                      <RefreshCw size={14} />
                      重新获取版本
                    </button>
                  </div>
                )}
                {!error && !update && (
                  <p className="mt-4 text-sm text-gray-500">正式安装包正在准备中，请稍后查看。</p>
                )}
                {update && (
                  <details className="mt-5 text-sm text-gray-500">
                    <summary className="cursor-pointer py-2">查看更新内容</summary>
                    <p className="mt-2 whitespace-pre-wrap break-words leading-7">
                      {update.releaseNotes}
                    </p>
                  </details>
                )}
              </>
            )}
          </div>
          <article className={styles.card}>
            <div className={styles.heading}>
              <Smartphone size={23} />
              <h2 className="text-2xl font-semibold">iOS</h2>
            </div>
            <p className="text-sm leading-7 text-gray-500 dark:text-gray-400">
              iPhone 客户端正在筹备中，后续将在这里提供下载。
            </p>
            <ul className={styles.features}>
              <li>当前暂未开放安装</li>
              <li>发布后将在此提供官方下载入口</li>
              <li>现在可以先在 Safari 中使用网页版</li>
            </ul>
            <div className={styles.bottom}>
              <span className="inline-flex rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-500 dark:bg-white/5">
                敬请期待
              </span>
              <Link
                href="/"
                className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm hover:underline"
              >
                先体验网页版
                <ArrowRight size={15} />
              </Link>
            </div>
          </article>
          <article className={styles.card}>
            <div className={styles.heading}>
              <Monitor size={23} />
              <h2 className="text-2xl font-semibold">网页版</h2>
            </div>
            <p className="text-sm leading-7 text-gray-500 dark:text-gray-400">
              无需安装，在浏览器中打开 MarkAI，继续使用完整工作空间。
            </p>
            <ul className={styles.features}>
              <li>电脑、平板和手机浏览器均可访问</li>
              <li>集中管理对话、文件与生成内容</li>
              <li>页面功能持续更新，无需下载安装包</li>
            </ul>
            <Link
              href="/"
              className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50 dark:border-white/20 dark:hover:bg-white/5"
            >
              <Globe size={16} />
              打开网页版
              <ArrowRight size={15} />
            </Link>
          </article>
        </section>
        <section
          aria-label="移动端功能"
          className="grid gap-8 border-y border-gray-200 py-10 sm:grid-cols-3 dark:border-white/10"
        >
          {[
            {
              icon: MessageSquare,
              title: "熟悉的对话体验",
              text: "模型选择、思考过程与流式回复，保持熟悉的使用方式。",
            },
            {
              icon: FileText,
              title: "文件，随手处理",
              text: "上传图片和文件，也可以直接拍照，把问题交给 AI。",
            },
            {
              icon: RefreshCw,
              title: "持续更新",
              text: "在应用内检查新版本，自由选择下载渠道与更新时间。",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <Icon size={21} className="mb-4 text-gray-500" />
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-7 text-gray-500">{text}</p>
            </div>
          ))}
        </section>
        <section className="grid gap-8 py-14 sm:grid-cols-[1fr_2fr]">
          <h2 className="text-xl font-semibold">安装与更新</h2>
          <div className="space-y-6 text-sm leading-7 text-gray-500">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                如何安装 Android 版本？
              </h3>
              <p>下载 APK 后打开文件，按 Android 提示允许当前来源安装，再确认安装。</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                已有旧版本，需要卸载吗？
              </h3>
              <p>直接覆盖安装即可，无需卸载。也可以在 App 的「设置 → 应用更新」中检查新版本。</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">暂时不想安装？</h3>
              <p>
                你仍然可以在浏览器中使用{" "}
                <Link href="/" className="underline underline-offset-4">
                  MarkAI 网页版
                </Link>
                。
              </p>
            </div>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-6xl items-center justify-between border-t border-gray-200 px-5 py-7 text-xs text-gray-400 dark:border-white/10 sm:px-8">
        <span>MarkAI · 让思考继续</span>
        <Link href="/">返回工作空间</Link>
      </footer>
    </div>
  );
}
