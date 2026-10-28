"use client";

import AppImage from "@/components/ui/AppImage";

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
  return (
    <AppImage
      native
      alt={emoji}
      width={size}
      height={size}
      loading="lazy"
      src={`${FLUENT_EMOJI_CDN}/${emojiToUnicode(emoji)}.webp`}
      containerClassName={cn("shrink-0", className)}
      fallback={
        <span aria-label={emoji} role="img" style={{ fontSize: size }}>
          {emoji}
        </span>
      }
    />
  );
}
