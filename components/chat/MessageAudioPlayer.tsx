"use client";

import { AudioLines, LoaderCircle, Pause, Play, RotateCcw, X } from "lucide-react";

import type { SpeechPlaybackState } from "@/hooks/useSpeechPlayback";

const formatAudioTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
};

export function MessageAudioPlayer({
  chunkCount,
  chunkIndex,
  currentTime,
  duration,
  onPause,
  onReplay,
  onResume,
  onStop,
  state,
  voice,
}: {
  chunkCount: number;
  chunkIndex: number;
  currentTime: number;
  duration: number;
  onPause: () => void;
  onReplay: () => void;
  onResume: () => void;
  onStop: () => void;
  state: Exclude<SpeechPlaybackState, "idle">;
  voice: string;
}) {
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const loading = state === "loading";
  const ended = state === "ended";

  return (
    <div className="mt-4 flex max-w-xl items-center gap-3 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.04]">
      <button
        aria-label={
          loading ? "正在生成语音" : ended ? "重新播放" : state === "playing" ? "暂停" : "播放"
        }
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 md:h-9 md:w-9"
        data-markai-tooltip
        disabled={loading}
        onClick={ended ? onReplay : state === "playing" ? onPause : onResume}
        type="button"
      >
        {loading ? (
          <LoaderCircle className="animate-spin" size={16} />
        ) : ended ? (
          <RotateCcw size={15} />
        ) : state === "playing" ? (
          <Pause size={15} />
        ) : (
          <Play className="ml-0.5" size={15} />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex min-w-0 items-center justify-between gap-3 text-xs">
          <span className="flex min-w-0 items-center gap-1.5 font-medium text-gray-700 dark:text-gray-200">
            <AudioLines className="shrink-0 text-gray-400" size={14} />
            <span className="truncate">{loading ? "正在生成语音" : voice}</span>
          </span>
          <span className="shrink-0 tabular-nums text-gray-400">
            {chunkCount > 1 && `${chunkIndex}/${chunkCount} · `}
            {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
          </span>
        </div>
        <div
          aria-label="播放进度"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(progress)}
          className="h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-gray-700 transition-[width] duration-200 dark:bg-gray-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <button
        aria-label="关闭语音播放器"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-200/70 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200 md:h-8 md:w-8"
        data-markai-tooltip
        onClick={onStop}
        type="button"
      >
        <X size={15} />
      </button>
    </div>
  );
}
