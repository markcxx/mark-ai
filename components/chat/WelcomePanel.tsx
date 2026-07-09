'use client';

import { FluentEmoji } from '@lobehub/fluent-emoji';
import { useEffect, useState, type ReactNode } from 'react';

const WELCOME_EMOJIS = ['🙂', '😊', '😄', '😁', '🤗', '🤩', '😎', '🫡', '😉'];

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

export function WelcomePanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full max-w-[840px] flex-col items-center px-4">
      <div className="mb-8 flex items-center gap-4">
        <AnimatedEmojiLogo />
        <div className="min-w-0">
          <h1 className="font-jakarta text-3xl font-semibold text-gray-950 dark:text-gray-50">MARKAI</h1>
          <p className="mt-2 text-[15px] text-gray-500 dark:text-gray-400">你好，我是 MarkAI。今天想聊点什么？</p>
        </div>
      </div>
      {children}
    </div>
  );
}
