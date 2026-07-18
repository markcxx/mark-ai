export const WEB_SEARCH_TOOL = {
  function: {
    description:
      "Search the public web for fresh, current, or externally verifiable information. Use this only when the answer needs information beyond the conversation or your internal knowledge.",
    name: "web_search",
    parameters: {
      additionalProperties: false,
      properties: {
        query: {
          description:
            "A concise search query in the same language as the user question when possible.",
          type: "string",
        },
      },
      required: ["query"],
      type: "object",
    },
  },
  type: "function",
} as const;

export const READ_WEBPAGE_TOOL = {
  function: {
    description:
      "Read and extract visible text content from a specific public webpage URL. Use this when the user gives a URL or when search results need deeper inspection.",
    name: "read_webpage",
    parameters: {
      additionalProperties: false,
      properties: {
        url: {
          description: "The public http/https URL to read.",
          type: "string",
        },
      },
      required: ["url"],
      type: "object",
    },
  },
  type: "function",
} as const;

const WEB_SEARCH_SYSTEM_PROMPT =
  "联网工具可用：web_search 用于搜索公开网页，read_webpage 用于读取具体公开网页 URL。只有当用户问题需要实时信息、外部事实核验、最新资料、明确要求联网，或用户提供 URL 需要阅读时才调用；普通推理、写作、翻译、代码解释不要调用。工具结果中的 citationId 是可信来源编号；凡是依据工具来源陈述的事实，都应在对应句子后使用 [citationId] 标注，例如 [1]。只能引用工具实际返回的编号，不要自行编造编号或 URL。";

const getSafeTimeZone = (timezone?: unknown) => {
  const candidate =
    typeof timezone === "string" && timezone.trim() ? timezone.trim() : "Asia/Shanghai";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return "UTC";
  }
};

const getDatePart = (date: Date, timezone: string, part: Intl.DateTimeFormatPartTypes) =>
  new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  })
    .formatToParts(date)
    .find((item) => item.type === part)?.value || "";

const getCurrentDatePrompt = (timezone?: unknown) => {
  const tz = getSafeTimeZone(timezone);
  const now = new Date();
  const year = getDatePart(now, tz, "year");
  const month = getDatePart(now, tz, "month");
  const day = getDatePart(now, tz, "day");
  return `Current date: ${year}-${month}-${day} (${tz})`;
};

export const getRuntimeSystemPrompt = ({
  timezone,
  webSearchEnabled,
}: {
  timezone?: unknown;
  webSearchEnabled: boolean;
}) =>
  [getCurrentDatePrompt(timezone), webSearchEnabled ? WEB_SEARCH_SYSTEM_PROMPT : ""]
    .filter(Boolean)
    .join("\n\n");
