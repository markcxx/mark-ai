import type {Metadata} from 'next';
import { Noto_Sans_SC, Plus_Jakarta_Sans } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css';

const notoSansSC = Noto_Sans_SC({ subsets: ['latin'], variable: '--font-noto-sans-sc' });
const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-plus-jakarta-sans' });

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
      <body suppressHydrationWarning className={`${notoSansSC.variable} ${plusJakartaSans.variable} font-sans antialiased text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-950 h-screen w-screen overflow-hidden`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
