import { describeGenerationError } from "./generation-error";

/** Presentation only: persisted provider diagnostics remain intact. */
export function getGenerationErrorDisplay(raw: string) {
  const details = describeGenerationError(raw);
  const code =
    details.match(/\bHTTP\s+(\d{3})\b/i)?.[1] ||
    details.match(/"(?:code|status)"\s*:\s*(\d{3})\b/)?.[1];
  let title = "回复生成失败";
  let message = "本次回复未能完成，可以重试或切换模型。";
  if (code === "429" || /rate.?limit|too many requests/i.test(details)) {
    title = "请求暂时受限";
    message = "当前请求过于频繁或可用额度不足，请稍后重试，或检查模型额度。";
  } else if (code === "503" || /high demand|overloaded|UNAVAILABLE/i.test(details)) {
    title = "模型服务暂时不可用";
    message = "服务商当前繁忙或暂时无法响应，请稍后重试，或切换其他模型。";
  } else if (code === "401" || code === "403") {
    title = "模型访问失败";
    message = "服务商拒绝了本次请求，请检查模型密钥和访问权限，或切换其他模型。";
  } else if (code === "402" || /insufficient.*(?:quota|balance)|quota.*exceeded/i.test(details)) {
    title = "模型额度不足";
    message = "请检查服务商余额或额度，或切换其他模型。";
  } else if (/context.{0,30}(?:length|window|limit)|maximum.*tokens/i.test(details)) {
    title = "对话超出模型限制";
    message = "请缩短输入内容、减少附件，或使用支持更长上下文的模型。";
  } else if (code === "504" || /timeout|timed out|超时/i.test(details)) {
    title = "模型响应超时";
    message = "等待服务商响应超时，请稍后重试或切换其他模型。";
  } else if (/fetch failed|failed to fetch|network|ECONN|连接/i.test(details)) {
    title = "模型连接中断";
    message = "请检查网络后重试，已收到的内容仍会保留。";
  } else if (code?.startsWith("5")) {
    title = "模型服务异常";
    message = "服务商未能完成本次请求，请稍后重试或切换其他模型。";
  }
  if (
    !code &&
    details.length <= 180 &&
    /[\u4e00-\u9fff]/.test(details) &&
    !/[{}<>]/.test(details)
  ) {
    message = details;
  }
  return { title, message, code, details };
}
