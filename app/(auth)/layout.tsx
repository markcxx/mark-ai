'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isRegister = pathname === '/register';

  if (isRegister) {
    return (
      <div className="h-dvh bg-gray-100 p-2 dark:bg-black">
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#111]">
          <header className="flex h-16 shrink-0 items-center px-4">
            <div className="flex items-center gap-2.5">
              <Image src="/images/markai.svg" alt="MarkAI" width={34} height={34} />
              <span className="text-lg font-semibold text-gray-950 dark:text-gray-50">MarkAI</span>
            </div>
          </header>
          <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-8">
            <div className="w-full max-w-[440px]">{children}</div>
          </div>
          <footer className="h-12 shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm py-8">
        <div className="mb-8 flex flex-col items-center">
          <Image src="/images/markai.svg" alt="MarkAI" width={48} height={48} className="mb-3" />
          <h1 className="text-xl font-semibold text-gray-950 dark:text-gray-50">MarkAI</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
