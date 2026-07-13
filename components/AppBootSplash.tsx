'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/useUIStore';
import { MarkAILoadingScreen } from './MarkAILoadingScreen';

const PUBLIC_AUTH_PATHS = ['/login', '/register', '/reset-password'];

export function AppBootSplash() {
  const pathname = usePathname();
  const isAppReady = useUIStore((s) => s.isAppReady);
  const bootMessage = useUIStore((s) => s.bootMessage);
  const bootProgress = useUIStore((s) => s.bootProgress);
  const [minimumDurationElapsed, setMinimumDurationElapsed] = useState(false);
  const [visible, setVisible] = useState(true);
  const requiresChatInitialization = !PUBLIC_AUTH_PATHS.some((path) => pathname.startsWith(path));
  const routeReady = !requiresChatInitialization || isAppReady;
  const exiting = minimumDurationElapsed && routeReady;

  useEffect(() => {
    const timer = window.setTimeout(() => setMinimumDurationElapsed(true), 850);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!exiting) return;

    const timer = window.setTimeout(() => setVisible(false), 300);
    return () => window.clearTimeout(timer);
  }, [exiting]);

  if (!visible) return null;

  return (
    <MarkAILoadingScreen
      className={cn(
        'fixed inset-0 z-[9999] transition-opacity duration-300',
        exiting && 'opacity-0',
      )}
      progress={requiresChatInitialization ? bootProgress : 100}
      status={requiresChatInitialization ? bootMessage : '正在准备页面…'}
    />
  );
}
