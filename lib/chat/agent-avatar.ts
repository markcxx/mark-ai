import type { Message } from "@/lib/chat/types";
import type { ExpressionId } from "@/lib/agent-avatar/bloub/expressions";
import type { StateId } from "@/lib/agent-avatar/bloub/states";

export type AgentAvatarMode = {
  animate: boolean;
  ambient: boolean;
  expression?: ExpressionId;
  state: StateId;
};

const hasActiveThinking = (message: Message) =>
  Boolean(
    message.isReasoning ||
      message.segments?.some((segment) => segment.type === "thinking" && segment.isActive),
  );

const hasRunningFileTool = (message: Message) =>
  Boolean(
    message.segments?.some(
      (segment) =>
        segment.type === "generated-file" && segment.generatedFile.status === "running",
    ),
  );

const hasActiveSearch = (message: Message) =>
  Boolean(
    message.webSearch?.some((search) => search.status === "searching") ||
      message.segments?.some(
        (segment) => segment.type === "tool" && segment.webSearch.status === "searching",
      ),
  );

const hasVisibleOutput = (message: Message) =>
  Boolean(
    message.content?.trim() ||
      message.segments?.some(
        (segment) => segment.type === "content" && Boolean(segment.content.trim()),
      ),
  );

export function resolveAgentAvatarMode(
  message: Message,
  isConversationTail: boolean,
  waitingForImage = false,
  showInterruptedAlert = true,
): AgentAvatarMode {
  if (message.role !== "model") {
    return { ambient: false, animate: false, state: "idle" };
  }

  if (message.interrupted && showInterruptedAlert) {
    return { ambient: false, animate: isConversationTail, state: "alert" };
  }

  if (hasRunningFileTool(message)) {
    return { ambient: false, animate: true, state: "hexagon" };
  }

  if (hasActiveSearch(message)) {
    return { ambient: false, animate: true, state: "orbit" };
  }

  if (waitingForImage) {
    return { ambient: false, animate: true, state: "egg" };
  }

  if (hasActiveThinking(message) || (message.isStreaming && !hasVisibleOutput(message))) {
    return { ambient: false, animate: true, expression: "curieux", state: "idle" };
  }

  if (message.isStreaming) {
    return { ambient: false, animate: true, state: "idle" };
  }

  if (isConversationTail) {
    return { ambient: true, animate: true, state: "idle" };
  }

  return { ambient: false, animate: false, state: "idle" };
}
