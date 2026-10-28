import type { MessageSegment } from "./types";

/** Unknown/legacy prose and deliverables always remain outside the process fold. */
export function getExecutionTrace(segments: MessageSegment[]) {
  // A tool call does not make its preceding prose a progress report. Display
  // tools can be called after a complete answer (including in saved history).
  const presentationSteps = new Set(
    segments.flatMap((segment) => {
      const presentsOutput =
        (segment.type === "tool" && segment.webSearch.tool === "show_images") ||
        (segment.type === "generated-file" &&
          (segment.generatedFile.file ||
            segment.generatedFile.preview ||
            segment.generatedFile.toolName === "render_echarts_chart"));
      return presentsOutput && "stepId" in segment && segment.stepId ? [segment.stepId] : [];
    }),
  );
  const processIndexes = new Set<number>();
  let toolCount = 0;
  let hasAnswer = false;
  let answerStarted = false;
  let hasError = false;
  let hasPendingTools = false;
  segments.forEach((segment, index) => {
    if (segment.type === "content" && segment.phase === "answer" && segment.content.trim()) {
      hasAnswer = true;
    }
    if (
      segment.type === "content" &&
      segment.content.trim() &&
      presentationSteps.has(segment.stepId || "")
    ) {
      answerStarted = true;
    }
    if (segment.type === "error") hasError = true;
    if (segment.type === "content" && segment.phase === "answering" && segment.content.trim()) {
      answerStarted = true;
    }
    if (segment.type === "tool") {
      toolCount++;
      hasPendingTools ||= segment.webSearch.status === "searching";
      // Selected images are a result the user should see, even after completion.
      if (!(
        segment.webSearch.tool === "show_images" &&
        segment.webSearch.status === "done" &&
        segment.webSearch.images?.length
      ))
        processIndexes.add(index);
    }
    if (segment.type === "generated-file") {
      toolCount++;
      hasPendingTools ||= segment.generatedFile.status === "running";
      if (!segment.generatedFile.file && !segment.generatedFile.preview) processIndexes.add(index);
    }
    if (
      segment.type === "thinking" ||
      (segment.type === "content" &&
        segment.phase === "progress" &&
        !presentationSteps.has(segment.stepId || "") &&
        !/```|~~~|!\[[^\]]*\]\(/.test(segment.content))
    ) {
      processIndexes.add(index);
    }
  });
  const hasExecutionMetadata = segments.some(
    (segment) =>
      ("stepId" in segment && Boolean(segment.stepId)) ||
      (segment.type === "content" && Boolean(segment.phase)),
  );
  // Legacy messages have no reliable completion signal: keep their original presentation.
  if (!toolCount || !hasExecutionMetadata) processIndexes.clear();
  return {
    processIndexes,
    toolCount,
    answerStarted: answerStarted && !hasError && !hasPendingTools,
    canCollapse: hasAnswer && !hasError && !hasPendingTools,
  };
}
