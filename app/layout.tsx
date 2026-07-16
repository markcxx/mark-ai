import type {Metadata} from 'next';
import { AppBootSplash } from '@/components/AppBootSplash';
import { ThemeProvider } from '@/components/ThemeProvider';
import '@fontsource-variable/noto-sans-sc';
import '@fontsource-variable/plus-jakarta-sans';
import './globals.css';

export const metadata: Metadata = {
  title: 'MarkAI - 个人AI效能工具，给自己一个更聪明的大脑',
  description: '个人AI效能工具，给自己一个更聪明的大脑',
  icons: {
    icon: '/images/markai.svg',
    shortcut: '/images/markai.svg',
    apple: '/images/markai.svg',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning className="font-sans antialiased text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-950 h-screen w-screen overflow-hidden">
        <ThemeProvider>
          <AppBootSplash />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
