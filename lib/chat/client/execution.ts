import { GenerationError } from "@/lib/chat/generation-error";
import type { ChatStreamEvent, MessageSegment } from "@/lib/chat/types";
import { finishPendingWebTools } from "@/lib/chat/web-context";

export function finishPendingExecutionTools(
  segments: MessageSegment[],
  error: string,
): MessageSegment[] {
  return finishPendingWebTools(segments, error).map((segment) =>
    segment.type === "generated-file" && segment.generatedFile.status === "running"
      ? { ...segment, generatedFile: { ...segment.generatedFile, status: "error", error } }
      : segment,
  );
}

/** A step is provisional until the server declares tools or successful completion. */
export class ExecutionStreamState {
  stepId: string | undefined;
  toolStepId: string | undefined;
  private started = false;
  private completed = false;

  get contentPhase() {
    // Provisional display phase, never a successful completion signal. A later
    // tool event reclassifies this step as progress and reopens the trace.
    return this.stepId ? ("answering" as const) : undefined;
  }

  accept(event: ChatStreamEvent, segments: MessageSegment[]) {
    if (event.type !== "step" && event.type !== "complete") return false;
    if (!event.stepId) throw new GenerationError("任务状态缺失，请重新生成。");
    this.started = true;
    if (event.type === "step" && event.status === "started") {
      this.stepId = event.stepId;
      this.toolStepId = undefined;
      return true;
    }
    if (event.stepId !== this.stepId) {
      throw new GenerationError("任务步骤状态不一致，请重新生成。");
    }
    if (
      event.type === "complete" &&
      !segments.some(
        (segment) =>
          segment.type === "content" && segment.stepId === this.stepId && segment.content.trim(),
      )
    ) {
      throw new GenerationError("模型未返回回答正文，请重试或切换模型。");
    }
    const phase = event.type === "complete" ? "answer" : "progress";
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (segment.type === "content" && segment.stepId === this.stepId) {
        segments[i] = { ...segment, phase };
      }
    }
    this.completed = event.type === "complete";
    this.toolStepId = this.completed ? undefined : this.stepId;
    // Tool-generated artifacts/text must not inherit the model's progress phase.
    this.stepId = undefined;
    return true;
  }

  assertComplete() {
    if (this.started && !this.completed) {
      throw new GenerationError("任务连接已中断，尚未收到完成结果，请继续生成或重试。");
    }
  }
}
