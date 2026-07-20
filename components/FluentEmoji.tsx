"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const FLUENT_EMOJI_CDN =
  "https://registry.npmmirror.com/@lobehub/fluent-emoji-3d/latest/files/assets";

const emojiToUnicode = (emoji: string) =>
  Array.from(emoji)
    .map((character) => character.codePointAt(0)?.toString(16))
    .filter(Boolean)
    .join("-");

export function FluentEmoji({
  className,
  emoji,
  size = 40,
}: {
  className?: string;
  emoji: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [emoji]);

  if (failed) {
    return (
      <span
        aria-label={emoji}
        className={cn("inline-flex items-center justify-center align-middle", className)}
        role="img"
        style={{ fontSize: size, height: size, width: size }}
      >
        {emoji}
      </span>
    );
  }

  return (
    // The source is the same static asset CDN previously used by @lobehub/fluent-emoji.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={emoji}
      className={cn("shrink-0", className)}
      decoding="async"
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      src={`${FLUENT_EMOJI_CDN}/${emojiToUnicode(emoji)}.webp`}
      width={size}
    />
  );
}
