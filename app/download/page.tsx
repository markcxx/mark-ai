import type { Metadata } from "next";
import { DownloadPage } from "@/components/download/DownloadPage";

export const metadata: Metadata = {
  title: "下载 MarkAI · 随时继续你的思考",
  description: "下载 MarkAI Android 应用，在手机上继续对话、处理文件与探索想法。iOS 版本敬请期待。",
};

export default function Page() {
  return <DownloadPage />;
}
