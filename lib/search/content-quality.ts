/** Conservative, extractive cleanup: never paraphrase evidence, tables or code. */
export function cleanWebContent(input: string) {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  let fenced = false;
  const cleaned: string[] = [];
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (
      !fenced &&
      /^\s*(?:accept all cookies|reject all cookies|manage cookie preferences|接受所有 Cookie|拒绝所有 Cookie)\s*$/i.test(
        line,
      )
    )
      continue;
    cleaned.push(line);
  }
  // Strip a navigation prefix only when a real article heading follows it.
  // Link directories, reference sections, lists, and navigation-only pages stay intact.
  fenced = false;
  const heading = cleaned.findIndex((line) => {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    return !fenced && /^#{1,2}\s+\S/.test(line);
  });
  if (heading >= 5 && heading < 200) {
    const prefix = cleaned.slice(0, heading).filter((line) => line.trim());
    const links = prefix.filter((line) => /\[[^\]]+\]\(https?:\/\//.test(line)).length;
    if (links >= 5 && links / prefix.length >= 0.65) cleaned.splice(0, heading);
  }
  return cleaned.join("\n").trim();
}

export function assessWebContent(content: string, title = "") {
  const text = content.trim();
  const lines = text.split("\n").filter((line) => line.trim());
  const visible = text.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").trim();
  const blocked =
    /^(?:access denied|forbidden|just a moment|安全验证|请登录)[.!…\s]*$/i.test(title) ||
    (visible.length < 1500 &&
      /verify you are human|checking your browser|enable javascript and cookies|captcha verification|请完成安全验证|访问验证/.test(
        visible.toLowerCase(),
      ));
  const linkLines = lines.filter((line) =>
    /^\s*(?:[-*]\s*)?(?:\[[^\]]{1,30}\]\([^)]*\)\s*)+$/.test(line),
  );
  const navigation = linkLines.filter((line) =>
    /\[(?:首页|登录|注册|新闻|体育|财经|娱乐|科技|博客|汽车|房产|教育|时尚|更多|Home|Login|Sign in|Register|Privacy|Subscribe)\]/i.test(
      line,
    ),
  ).length;
  const noisy = lines.length > 12 && navigation >= 6 && linkLines.length / lines.length > 0.7;
  return { usable: Boolean(visible) && !blocked && !noisy, noisy, blocked };
}
