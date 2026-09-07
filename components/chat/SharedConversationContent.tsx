"use client";

import { useEffect, useState } from "react";
import type { Message } from "@/lib/chat/types";
import { ReadonlyConversation } from "./ReadonlyConversation";

export function SharedConversationContent({
  messages,
  token,
  expiresAt,
}: {
  messages: Message[];
  token: string;
  expiresAt: number;
}) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      clearTimeout(timer);
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) setExpired(true);
      else timer = setTimeout(check, Math.min(remaining, 2_147_483_647));
    };
    check();
    window.addEventListener("focus", check);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", check);
    };
  }, [expiresAt]);
  if (expired)
    return (
      <p className="px-6 py-24 text-center text-sm text-gray-500">
        分享链接已过期，请联系分享者获取新的链接。
      </p>
    );
  return <ReadonlyConversation messages={messages} shareToken={token} />;
}
