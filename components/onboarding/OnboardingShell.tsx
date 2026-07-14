'use client';

import Image from 'next/image';
import { Toaster } from 'react-hot-toast';

export function OnboardingShell({
  children,
  eyebrow,
  step,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  eyebrow: string;
  step: 1 | 2 | 3;
  subtitle: string;
  title: React.ReactNode;
}) {
  return (
    <main className="h-dvh bg-gray-100 p-2 dark:bg-black">
      <Toaster containerStyle={{ top: 24, zIndex: 99999 }} position="top-center" toastOptions={{ duration: 3000 }} />
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#111]">
        <header className="flex h-16 shrink-0 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Image alt="MarkAI" height={32} priority src="/images/markai.svg" width={32} />
            <span className="text-base font-semibold text-gray-950 dark:text-white">MarkAI</span>
          </div>
          <span className="text-xs text-gray-400">{step} / 3</span>
        </header>

        <section className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-10">
          <div className="w-full max-w-[600px] animate-[fade-up_420ms_cubic-bezier(0.22,1,0.36,1)]">
            <p className="mb-3 text-sm font-medium text-blue-600 dark:text-blue-400">{eyebrow}</p>
            <h1 className="text-[34px] font-bold leading-[1.25] tracking-[-0.025em] text-gray-950 dark:text-white sm:text-[40px]">{title}</h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-gray-500 dark:text-gray-400">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

export const onboardingButtonClass = 'flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-950 px-5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200';
