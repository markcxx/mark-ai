"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AppDialog } from "@/components/ui/AppDialog";
import { HtmlPreviewContext } from "./HtmlPreviewContext";
import type { HtmlPreviewPayload } from "./htmlPreviewUtils";
import { MessageItem } from "./MessageItem";
import { FileAccessContext, type FileUrlResolver } from "./FileAccessContext";
import { toReadonlyMessages } from "@/lib/chat/share-types";
import type { Message } from "@/lib/chat/types";

const HtmlPreviewPanel = dynamic(
  () => import("./HtmlPreviewPanel").then((module) => module.HtmlPreviewPanel),
  { ssr: false },
);

const noop = () => {};
const asyncNoop = async () => {};

export function ReadonlyConversation({
  messages,
  shareToken,
  adminUserId,
}: {
  messages: Message[];
  shareToken?: string;
  adminUserId?: string;
}) {
  const [preview, setPreview] = useState<HtmlPreviewPayload | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const previewContext = useMemo(
    () => ({
      activePreview: preview,
      openPreview: setPreview,
      closePreview: () => setPreview(null),
    }),
    [preview],
  );
  const visibleMessages = useMemo(() => toReadonlyMessages(messages), [messages]);
  const fileUrl: FileUrlResolver = useMemo(
    () => (id, action) => {
      if (shareToken)
        return `/api/public/shares/${encodeURIComponent(shareToken)}/files/${encodeURIComponent(id)}?action=${action}`;
      if (adminUserId)
        return `/api/admin/users/${encodeURIComponent(adminUserId)}/files/${encodeURIComponent(id)}?action=${action === "preview" ? "content" : "download-content"}`;
      return `/api/files/${encodeURIComponent(id)}/${action}`;
    },
    [shareToken, adminUserId],
  );

  return (
    <HtmlPreviewContext.Provider value={previewContext}>
      <FileAccessContext.Provider value={fileUrl}>
        <div className="mx-auto w-full max-w-[840px] space-y-8 px-4 py-6 md:px-6 md:py-8">
          {visibleMessages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              readOnly
              collapsed={false}
              cancelEditingMessage={noop}
              continueMessage={asyncNoop}
              copyMessage={noop}
              deleteMessage={noop}
              editingContent=""
              editingMessageId={null}
              enableMultiSelect={noop}
              getMessageModel={() => undefined}
              isConversationTail={false}
              isSelected={false}
              loadingText=""
              menuUnavailable={noop}
              multiSelectMode={false}
              openMenuMessageId={null}
              regenerateMessage={asyncNoop}
              saveEditingMessage={noop}
              selectMessageVariant={asyncNoop}
              selectionLayoutMode={false}
              setEditingContent={noop}
              setOpenMenuMessageId={noop}
              startEditingMessage={noop}
              toggleCollapseMessage={noop}
              toggleSelectedMessage={noop}
              translateMessage={asyncNoop}
            />
          ))}
          {!visibleMessages.length && (
            <p className="py-12 text-center text-sm text-gray-400">暂无对话内容</p>
          )}
        </div>
        {preview && (
          <AppDialog
            open
            onClose={() => setPreview(null)}
            title={false}
            closable={false}
            width={fullscreen ? "100vw" : "min(94vw, 1100px)"}
            height={fullscreen ? "100dvh" : "88dvh"}
            bodyClassName="h-full [&>aside]:h-full"
          >
            <HtmlPreviewPanel
              preview={preview}
              fullscreen={fullscreen}
              onFullscreenChange={setFullscreen}
              onClose={() => setPreview(null)}
              onResizePointerDown={noop}
              resizing={false}
            />
          </AppDialog>
        )}
      </FileAccessContext.Provider>
    </HtmlPreviewContext.Provider>
  );
}
