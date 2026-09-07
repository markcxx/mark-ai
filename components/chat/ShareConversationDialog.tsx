"use client";

import { useEffect, useState } from "react";
import { Copy, Link2, Trash2 } from "lucide-react";
import { AppDialog } from "@/components/ui/AppDialog";
import { AppSelect } from "@/components/ui/AppSelect";
import { AppInput } from "@/components/ui/AppInput";
import { SHARE_DURATIONS } from "@/lib/chat/share-types";

import { readShareResponse, type ShareInfo } from "@/lib/chat/share-response";

export function ShareConversationDialog({
  sessionId,
  onClose,
  busy,
}: {
  sessionId: string;
  onClose: () => void;
  busy: boolean;
}) {
  const [duration, setDuration] = useState(604800);
  const [share, setShare] = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [origin, setOrigin] = useState("");
  const endpoint = `/api/sessions/${encodeURIComponent(sessionId)}/share`;
  useEffect(() => {
    const controller = new AbortController();
    setOrigin(window.location.origin);
    setLoading(true);
    setShare(null);
    setError("");
    setFeedback("");
    fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await readShareResponse(response);
        if (!controller.signal.aborted) setShare(data.share ?? null);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error && !(error instanceof TypeError)
              ? error.message
              : "分享信息加载失败，请检查网络后重试",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [endpoint]);
  async function update(method: "POST" | "DELETE") {
    setPending(true);
    setError("");
    setFeedback("");
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(method === "POST" ? { body: JSON.stringify({ duration }) } : {}),
      });
      const data = await readShareResponse(response);
      setShare(data.share || null);
      setFeedback(method === "DELETE" ? "链接已撤销" : "分享链接已生成");
    } catch (error) {
      setError(
        error instanceof Error && !(error instanceof TypeError)
          ? error.message
          : "操作失败，请检查网络后重试",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <AppDialog
      open
      onClose={onClose}
      closeDisabled={pending}
      title="分享会话"
      width="min(92vw, 480px)"
    >
      <div className="space-y-4 p-5">
        <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
          生成当前已保存对话的只读快照，包含思考过程和附件。持有链接的人无需登录即可查看；后续消息不会自动加入。
        </p>
        <label className="block space-y-2 text-sm">
          <span>有效期</span>
          <AppSelect
            className="min-h-11 md:min-h-8"
            value={duration}
            onChange={setDuration}
            options={SHARE_DURATIONS}
            disabled={pending || loading}
            style={{ width: "100%" }}
          />
        </label>
        {loading && (
          <div
            className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5"
            aria-label="正在加载分享信息"
          />
        )}
        {share && (
          <div className="space-y-2">
            <label className="block text-sm" htmlFor="conversation-share-url">
              分享链接
            </label>
            <div className="flex items-center gap-2">
              <AppInput
                id="conversation-share-url"
                readOnly
                value={`${origin}${share.path}`}
                className="min-w-0 flex-1"
              />
              <button
                className="flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-white/10"
                aria-label="复制分享链接"
                data-markai-tooltip="复制链接"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`${origin}${share.path}`);
                    setFeedback("链接已复制");
                  } catch {
                    setError("复制失败，请选中链接手动复制");
                  }
                }}
              >
                <Copy size={16} />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              有效至 {new Date(share.expiresAt).toLocaleString("zh-CN")}
            </p>
            <p className="text-xs text-gray-400">重新生成会更新快照，并使旧链接立即失效。</p>
          </div>
        )}
        {busy && <p className="text-sm text-gray-500">请等待回复完成并保存后再生成快照。</p>}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {feedback && (
          <p role="status" className="text-sm text-gray-500">
            {feedback}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {share && (
            <button
              disabled={pending}
              onClick={() => void update("DELETE")}
              className="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-500/10"
            >
              <Trash2 size={15} />
              撤销链接
            </button>
          )}
          <button
            disabled={pending || loading || busy}
            onClick={() => void update("POST")}
            className="flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm text-white disabled:opacity-50 dark:text-gray-950"
          >
            <Link2 size={15} />
            {pending ? "处理中…" : share ? "重新生成" : "生成链接"}
          </button>
        </div>
      </div>
    </AppDialog>
  );
}
