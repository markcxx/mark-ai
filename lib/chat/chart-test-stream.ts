import type { GeneratedFileState, Message, MessageSegment } from "./types";

export type ChartPreviewEvent =
  | { type: "content" | "reasoning" | "error"; text: string }
  | { type: "file"; generatedFile: GeneratedFileState }
  | { type: "usage"; inputTokens?: number; outputTokens?: number; totalTokens?: number };

export function applyChartPreviewEvent(message: Message, event: ChartPreviewEvent): Message {
  const segments: MessageSegment[] = [...(message.segments || [])];
  const closeThinking = () => {
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (segment.type === "thinking" && segment.isActive)
        segments[i] = { ...segment, isActive: false };
    }
  };
  if (event.type === "reasoning") {
    const last = segments.at(-1);
    if (last?.type === "thinking")
      segments[segments.length - 1] = {
        ...last,
        content: last.content + event.text,
        isActive: true,
      };
    else segments.push({ type: "thinking", content: event.text, isActive: true });
    return {
      ...message,
      reasoning: (message.reasoning || "") + event.text,
      isReasoning: true,
      segments,
    };
  }
  if (event.type === "content") {
    closeThinking();
    const last = segments.at(-1);
    if (last?.type === "content")
      segments[segments.length - 1] = { ...last, content: last.content + event.text };
    else segments.push({ type: "content", content: event.text });
    return { ...message, content: message.content + event.text, isReasoning: false, segments };
  }
  if (event.type === "file") {
    closeThinking();
    const index = segments.findIndex(
      (segment) =>
        segment.type === "generated-file" &&
        segment.generatedFile.callId === event.generatedFile.callId,
    );
    const segment: MessageSegment = { type: "generated-file", generatedFile: event.generatedFile };
    if (index >= 0) segments[index] = segment;
    else segments.push(segment);
    return { ...message, isReasoning: false, segments };
  }
  if (event.type === "error") {
    closeThinking();
    segments.push({ type: "error", content: event.text });
    return { ...message, interrupted: true, isStreaming: false, isReasoning: false, segments };
  }
  if (event.type !== "usage") return message;
  return {
    ...message,
    inputTokens: event.inputTokens,
    outputTokens: event.outputTokens,
    totalTokens: event.totalTokens,
  };
}

export function finishChartPreviewMessage(message: Message): Message {
  return {
    ...message,
    isStreaming: false,
    isReasoning: false,
    segments: message.segments?.map((segment) =>
      segment.type === "thinking"
        ? { ...segment, isActive: false }
        : segment.type === "generated-file" && segment.generatedFile.status === "running"
          ? {
              ...segment,
              generatedFile: {
                ...segment.generatedFile,
                status: "error",
                error: "请求已结束，工具未完成",
              },
            }
          : segment,
    ),
  };
}
