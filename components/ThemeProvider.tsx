'use client';

import { ConfigProvider } from '@lobehub/ui';
import { motion } from 'motion/react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ConfigProvider motion={motion}>{children}</ConfigProvider>
    </NextThemesProvider>
  );
}
