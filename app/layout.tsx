import type {Metadata} from 'next';
import { Noto_Sans_SC, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const notoSansSC = Noto_Sans_SC({ subsets: ['latin'], variable: '--font-noto-sans-sc' });
const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-plus-jakarta-sans' });

export const metadata: Metadata = {
  title: 'MarkAI - Intelligent Clarity',
  description: 'AI Chat Assistant',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${notoSansSC.variable} ${plusJakartaSans.variable} font-sans antialiased text-gray-900 bg-gray-50 h-screen w-screen overflow-hidden`}>
        {children}
      </body>
    </html>
  );
}
