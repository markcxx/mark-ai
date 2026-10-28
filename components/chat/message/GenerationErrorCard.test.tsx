import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GenerationErrorCard } from "./GenerationErrorCard";
import { getGenerationErrorDisplay } from "@/lib/chat/generation-error-display";

it("renders a compact Chinese error summary with the complete diagnostics collapsed", () => {
  const error =
    'HTTP 503\n[{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}]';
  const html = renderToStaticMarkup(<GenerationErrorCard content={error} />);
  expect(html).toContain('role="alert"');
  expect(html).toContain("模型服务暂时不可用");
  expect(html).toContain("HTTP 503");
  expect(html).toContain("错误详情");
  expect(html).toContain("high demand");
  expect(html).not.toMatch(/<details[^>]*\bopen/);
});
it("keeps upstream HTML inert and redacts credential-like diagnostics", () => {
  const html = renderToStaticMarkup(
    <GenerationErrorCard content={"<script>alert(1)</script> Bearer private-token"} />,
  );
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("private-token");
  expect(html).toContain("已隐藏");
});
it.each([
  ["HTTP 429\nrate limit", "请求暂时受限"],
  ["HTTP 401\nauth failed", "模型访问失败"],
  ["HTTP 402\nbalance", "模型额度不足"],
  ["HTTP 504", "模型响应超时"],
  ["fetch failed", "模型连接中断"],
  ["maximum context length exceeded", "对话超出模型限制"],
  ["unrecognized provider failure", "回复生成失败"],
])("explains %s in Chinese", (content, title) =>
  expect(getGenerationErrorDisplay(content).title).toBe(title),
);
it("retains actionable application errors", () =>
  expect(getGenerationErrorDisplay("任务连接已中断，请继续生成。").message).toBe(
    "任务连接已中断，请继续生成。",
  ));
