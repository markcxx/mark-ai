"use client";
import { Pre } from "@/components/CodeBlock";
export default function CodeThemePreview() {
  return (
    <Pre language="typescript">{`// 创建一个新的会话
interface Conversation {
  title: string;
  messages: string[];
}
const session: Conversation = {
  title: "灵感工作台",
  messages: ["你好，MarkAI！"],
};
console.log(session.messages.length > 0 ? "已就绪" : "等待输入");`}</Pre>
  );
}
