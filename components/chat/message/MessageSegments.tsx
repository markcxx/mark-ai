import type { ComponentProps } from "react";
import type { Message, MessageSegment } from "@/lib/chat/types";
import { getExecutionTrace } from "@/lib/chat/execution-trace";
import { MarkdownContent } from "../MarkdownContent";
import { ThinkingPanel } from "../ThinkingPanel";
import { ExecutionTrace } from "./ExecutionTrace";
import { GeneratedFileToolBlock } from "./GeneratedFileToolBlock";
import { GeneratedImageBlock } from "./GeneratedImageBlock";
import { WebSearchToolBlockItem } from "./WebSearchToolBlock";

export function MessageSegments({
  animation,
  citations,
  message,
  onPreview,
  segments,
}: {
  animation: ComponentProps<typeof MarkdownContent>["animation"];
  citations: ComponentProps<typeof MarkdownContent>["citations"];
  message: Message;
  onPreview: ComponentProps<typeof GeneratedImageBlock>["onPreview"];
  segments: MessageSegment[];
}) {
  const trace = getExecutionTrace(segments);
  const renderSegment = (segment: MessageSegment, index: number) => {
    const key = `seg-${index}`;
    if (
      segment.type === "translation" ||
      segment.type === "error" ||
      segment.type === "context-boundary"
    )
      return null;
    if (segment.type === "thinking") {
      return (
        <ThinkingPanel
          content={segment.content}
          duration={segment.duration}
          key={key}
          thinking={segment.isActive}
        />
      );
    }
    if (segment.type === "tool") {
      return <WebSearchToolBlockItem key={key} webSearch={segment.webSearch} />;
    }
    if (segment.type === "generated-file") {
      return (
        <GeneratedFileToolBlock
          generatedFile={segment.generatedFile}
          key={key}
          onPreview={onPreview}
        />
      );
    }
    if (segment.type === "generated-image") {
      return (
        <GeneratedImageBlock
          generatedImage={segment.generatedImage}
          key={key}
          onPreview={onPreview}
        />
      );
    }
    const streaming = message.isStreaming && index === segments.length - 1;
    return segment.content ? (
      <div key={key}>
        <MarkdownContent animation={animation} citations={citations} streaming={streaming}>
          {segment.content}
        </MarkdownContent>
        {streaming && (
          <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-full bg-primary align-middle" />
        )}
      </div>
    ) : null;
  };
  return (
    <>
      {trace.processIndexes.size > 0 && (
        <ExecutionTrace
          complete={
            (trace.canCollapse || (Boolean(message.isStreaming) && trace.answerStarted)) &&
            !message.interrupted &&
            !message.isReasoning
          }
          duration={message.generationDuration}
          key={message.activeVariantId || message.id}
          streaming={message.isStreaming}
          toolCount={trace.toolCount}
        >
          {segments.map((segment, index) =>
            trace.processIndexes.has(index) ? renderSegment(segment, index) : null,
          )}
        </ExecutionTrace>
      )}
      {segments.map((segment, index) =>
        trace.processIndexes.has(index) ? null : renderSegment(segment, index),
      )}
    </>
  );
}
