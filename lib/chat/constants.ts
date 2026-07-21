export const THINKING_TEXTS = [
  "正在把消息送到模型手里…",
  "模型正在整理思路…",
  "灵感正在排队进场…",
  "正在给答案找一个漂亮的开头…",
  "答案已经出发，请稍候…",
  "正在从上下文里寻找线索…",
  "模型正在认真读题…",
  "正在把想法拼成句子…",
  "稍等一下，思路正在加载…",
  "正在校准今天的脑回路…",
  "好答案值得多想半秒…",
  "正在翻找最合适的表达…",
  "别眨眼，答案正在赶来…",
  "正在三思，刚完成第一思…",
  "加载中，进度条也不知道自己在哪里...",
  "已经有感觉了，差一点点...",
];

export const getNextThinkingText = (current?: string) => {
  const candidates = THINKING_TEXTS.filter((text) => text !== current);
  return candidates[Math.floor(Math.random() * candidates.length)] || THINKING_TEXTS[0];
};

export const NOT_IMPLEMENTED_TOAST = "该功能暂未接入";
