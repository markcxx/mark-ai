'use client';

import { useEffect, useState } from 'react';

import { MarkAILoadingScreen } from './MarkAILoadingScreen';

export function AppBootSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 850);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <MarkAILoadingScreen className="fixed inset-0 z-[9999] transition-opacity duration-300" />
  );
}
