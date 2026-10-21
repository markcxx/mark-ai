import { fetchWithDevelopmentProxy } from "@/lib/server/development-proxy";
import type { OpenAIChatMessage, OpenAIToolCall } from "./types";

type Block = { type: string; [key: string]: any };
export function toAnthropicMessagesEndpoint(baseUrl = "https://api.anthropic.com/v1") {
  const base = baseUrl.replace(/\/+$/, "").replace(/\/(chat\/completions|responses|messages)$/, "");
  return `${base}${/^https:\/\/api\.anthropic\.com$/.test(base) ? "/v1" : ""}/messages`;
}

const contentBlocks = (content: OpenAIChatMessage["content"]): Block[] => {
  if (typeof content === "string") return content ? [{ type: "text", text: content }] : [];
  return (content || []).map((part): Block => {
    if (part.type === "text") return { type: "text", text: part.text };
    const data = /^data:([^;]+);base64,([\s\S]+)$/.exec(part.image_url.url);
    return {
      type: "image",
      source: data
        ? { type: "base64", media_type: data[1], data: data[2] }
        : { type: "url", url: part.image_url.url },
    };
  });
};
const parsedInput = (source: string) => {
  try {
    return JSON.parse(source);
  } catch {
    return {};
  }
};

/** Per-generation transport: the existing chat loop still owns tools, retries and persistence. */
export function createAnthropicTransport({
  apiKey,
  baseUrl,
}: {
  apiKey: string;
  baseUrl?: string;
}): typeof fetchWithDevelopmentProxy {
  // Signed thinking must be replayed verbatim in the assistant's tool-use turn.
  const nativeTurns = new Map<string, Block[]>();
  return async (_endpoint, init) => {
    const request = JSON.parse(String(init?.body || "{}"));
    const messages: { role: "user" | "assistant"; content: Block[] }[] = [];
    const system: Block[] = [];
    const append = (role: "user" | "assistant", content: Block[]) => {
      if (!content.length) return;
      if (messages.at(-1)?.role === role) messages.at(-1)!.content.push(...content);
      else messages.push({ role, content });
    };
    for (const message of request.messages as OpenAIChatMessage[]) {
      if (message.role === "system") {
        system.push(...contentBlocks(message.content));
        continue;
      }
      if (message.role === "tool") {
        const result = parsedInput(String(message.content));
        append("user", [
          {
            type: "tool_result",
            tool_use_id: message.tool_call_id,
            content: String(message.content || ""),
            ...(result?.success === false || result?.error ? { is_error: true } : {}),
          },
        ]);
      } else if (message.role === "assistant" && message.tool_calls?.length) {
        const ids = new Set(message.tool_calls.map((call) => call.id));
        const cached = nativeTurns.get(message.tool_calls[0].id);
        append(
          "assistant",
          cached
            ? cached.filter((block) => block.type !== "tool_use" || ids.has(block.id))
            : [
                ...contentBlocks(message.content),
                ...message.tool_calls.map((call: OpenAIToolCall) => ({
                  type: "tool_use",
                  id: call.id,
                  name: call.function.name,
                  input: parsedInput(call.function.arguments),
                })),
              ],
        );
      } else
        append(message.role === "assistant" ? "assistant" : "user", contentBlocks(message.content));
    }
    const body = {
      model: request.model,
      messages,
      system,
      max_tokens: request.max_tokens || 8192,
      stream: request.stream !== false,
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(request.tools?.length
        ? {
            tools: request.tools.map((tool: any) => ({
              name: tool.function.name,
              description: tool.function.description,
              input_schema: tool.function.parameters,
            })),
            tool_choice:
              request.tool_choice?.type === "function"
                ? { type: "tool", name: request.tool_choice.function.name }
                : { type: request.tool_choice === "required" ? "any" : "auto" },
          }
        : {}),
    };
    const upstream = await fetchWithDevelopmentProxy(toAnthropicMessagesEndpoint(baseUrl), {
      ...init,
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
        ...(new URL(toAnthropicMessagesEndpoint(baseUrl)).hostname !== "api.anthropic.com"
          ? { Authorization: `Bearer ${apiKey}` }
          : {}),
      },
    });
    if (!upstream.ok) return upstream;
    if (!body.stream) {
      const response = await upstream.json();
      if (response.stop_reason === "max_tokens")
        throw new Error("Anthropic Messages 输出达到 max_tokens 上限，内容未完成");
      return Response.json({
        choices: [
          {
            message: {
              role: "assistant",
              content: (response.content || [])
                .filter((block: Block) => block.type === "text")
                .map((block: Block) => block.text)
                .join(""),
            },
          },
        ],
        usage: response.usage,
      });
    }
    if (!upstream.body) throw new Error("Anthropic Messages 未返回流式响应");
    const reader = upstream.body.getReader();
    const encoder = new TextEncoder();
    let cancelled = false;
    const stream = new ReadableStream({
      async start(controller) {
        const blocks = new Map<number, { block: Block; json: string }>();
        const usage: Record<string, number> = {};
        let stopped = false;
        const send = (data: object) => {
          if (!cancelled) controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };
        const delta = (value: object) => send({ choices: [{ index: 0, delta: value }] });
        const accept = (line: string) => {
          if (stopped) return;
          if (!line.startsWith("data:")) return;
          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") return;
          const event = JSON.parse(raw);
          if (event.type === "error") {
            send(event);
            stopped = true;
            return;
          }
          if (event.type === "message_start") Object.assign(usage, event.message?.usage);
          if (event.type === "content_block_start") {
            const block = { ...event.content_block };
            blocks.set(event.index, { block, json: "" });
            if (block.type === "tool_use")
              delta({
                tool_calls: [
                  {
                    index: event.index,
                    id: block.id,
                    type: "function",
                    function: {
                      name: block.name,
                      arguments: Object.keys(block.input || {}).length
                        ? JSON.stringify(block.input)
                        : "",
                    },
                  },
                ],
              });
            if (block.type === "text" && block.text) delta({ content: block.text });
            if (block.type === "thinking" && block.thinking)
              delta({ reasoning_content: block.thinking });
          }
          if (event.type === "content_block_delta") {
            const current = blocks.get(event.index);
            if (!current) throw new Error("Anthropic Messages 返回了未开始的内容块");
            const part = event.delta;
            if (part.type === "text_delta") {
              current.block.text = (current.block.text || "") + part.text;
              delta({ content: part.text });
            }
            if (part.type === "thinking_delta") {
              current.block.thinking = (current.block.thinking || "") + part.thinking;
              delta({ reasoning_content: part.thinking });
            }
            if (part.type === "signature_delta")
              current.block.signature = (current.block.signature || "") + part.signature;
            if (part.type === "input_json_delta") {
              current.json += part.partial_json;
              delta({
                tool_calls: [{ index: event.index, function: { arguments: part.partial_json } }],
              });
            }
          }
          if (event.type === "message_delta") {
            Object.assign(usage, event.usage);
            if (event.delta?.stop_reason === "max_tokens")
              throw new Error("Anthropic Messages 输出达到 max_tokens 上限，内容未完成");
          }
          if (event.type === "message_stop") {
            const content = [...blocks.values()].map(({ block, json }) =>
              block.type === "tool_use" && json ? { ...block, input: parsedInput(json) } : block,
            );
            for (const block of content)
              if (block.type === "tool_use") nativeTurns.set(block.id, content);
            const input =
              (usage.input_tokens || 0) +
              (usage.cache_read_input_tokens || 0) +
              (usage.cache_creation_input_tokens || 0);
            send({
              choices: [],
              usage: {
                prompt_tokens: input,
                completion_tokens: usage.output_tokens || 0,
                total_tokens: input + (usage.output_tokens || 0),
              },
            });
            stopped = true;
            if (!cancelled) controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          }
        };
        try {
          const decoder = new TextDecoder();
          let buffer = "";
          while (!stopped && !cancelled) {
            const { done, value } = await reader.read();
            buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || "";
            lines.forEach(accept);
            if (done) {
              if (buffer.trim()) accept(buffer);
              break;
            }
          }
          if (!stopped && !cancelled)
            throw new Error("Anthropic Messages 流意外中断，未收到 message_stop");
          if (!cancelled) controller.close();
        } catch (error) {
          if (!cancelled) {
            send({ error: { message: error instanceof Error ? error.message : String(error) } });
            controller.close();
          }
        } finally {
          await reader.cancel().catch(() => {});
          reader.releaseLock();
        }
      },
      async cancel(reason) {
        cancelled = true;
        await reader.cancel(reason).catch(() => {});
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
  };
}
