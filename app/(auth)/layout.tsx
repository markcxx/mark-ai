'use client';

import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <Image src="/images/markai.svg" alt="MarkAI" width={48} height={48} className="mb-3" />
          <h1 className="text-xl font-semibold text-gray-950 dark:text-gray-50">MarkAI</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
