'use client';

import { FluentEmoji } from '@lobehub/fluent-emoji';
import { useEffect, useState, type ReactNode } from 'react';

const WELCOME_EMOJIS = ['🙂', '😊', '😄', '😁', '🤗', '🤩', '😎', '🫡', '😉'];
const WELCOME_TEXT = '你好，我是 MarkAI。今天想聊点什么？';

const pickWelcomeEmoji = () => WELCOME_EMOJIS[Math.floor(Math.random() * WELCOME_EMOJIS.length)];

function AnimatedEmojiLogo() {
  const [emoji, setEmoji] = useState('🙂');

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEmoji(pickWelcomeEmoji()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="markai-logo-face flex h-20 w-20 shrink-0 items-center justify-center">
      <FluentEmoji cdn="aliyun" emoji={emoji} size={76} type="3d" unoptimized />
      <style>{`
        @keyframes markai-logo-float {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-5px) rotate(2deg); }
        }

        .markai-logo-face {
          animation: markai-logo-float 4.2s ease-in-out infinite;
          transform-origin: center bottom;
        }
      `}</style>
    </div>
  );
}

function TypewriterText({ text }: { text: string }) {
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setVisibleLength((length) => {
        if (length >= text.length) {
          window.clearInterval(interval);
          return length;
        }

        return length + 1;
      });
    }, 58);

    return () => window.clearInterval(interval);
  }, [text]);

  return (
    <p
      aria-label={text}
      className="mt-2 min-h-6 text-[15px] text-gray-500 dark:text-gray-400"
    >
      <span aria-hidden="true">{text.slice(0, visibleLength)}</span>
      <span
        aria-hidden="true"
        className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-gray-400 dark:bg-gray-500"
      />
    </p>
  );
}

export function WelcomePanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full max-w-[840px] flex-col items-center px-4">
      <div className="mb-8 flex items-center gap-4">
        <AnimatedEmojiLogo />
        <div className="min-w-0">
          <h1 className="font-jakarta text-3xl font-semibold text-gray-950 dark:text-gray-50">MARKAI</h1>
          <TypewriterText text={WELCOME_TEXT} />
        </div>
      </div>
      {children}
    </div>
  );
}
