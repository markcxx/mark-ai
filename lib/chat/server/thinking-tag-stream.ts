export type ThinkingTagStreamEvent = {
  text: string;
  type: "content" | "reasoning";
};

const THINKING_TAGS = [
  { close: "</think>", open: "<think>" },
] as const;

const appendEvent = (
  events: ThinkingTagStreamEvent[],
  type: ThinkingTagStreamEvent["type"],
  text: string,
) => {
  if (!text) return;
  const previous = events[events.length - 1];
  if (previous?.type === type) {
    previous.text += text;
    return;
  }
  events.push({ text, type });
};

const getPendingPrefixLength = (value: string, candidates: readonly string[]) => {
  const maxLength = Math.min(
    value.length,
    candidates.reduce((max, candidate) => Math.max(max, candidate.length - 1), 0),
  );

  for (let length = maxLength; length > 0; length -= 1) {
    const suffix = value.slice(-length);
    if (candidates.some((candidate) => candidate.startsWith(suffix))) return length;
  }

  return 0;
};

export class ThinkingTagStreamParser {
  private activeCloseTag: string | undefined;
  private buffer = "";
  private mode: ThinkingTagStreamEvent["type"] = "content";

  push(chunk: string): ThinkingTagStreamEvent[] {
    if (!chunk) return [];
    this.buffer += chunk;
    return this.drain(false);
  }

  finish(): ThinkingTagStreamEvent[] {
    const events = this.drain(true);
    appendEvent(events, this.mode, this.buffer);
    this.buffer = "";
    return events;
  }

  private drain(finishing: boolean): ThinkingTagStreamEvent[] {
    const events: ThinkingTagStreamEvent[] = [];

    while (this.buffer) {
      if (this.mode === "content") {
        const nextTag = THINKING_TAGS.map((tag) => ({
          ...tag,
          index: this.buffer.indexOf(tag.open),
        }))
          .filter((tag) => tag.index >= 0)
          .sort((a, b) => a.index - b.index)[0];

        if (nextTag) {
          appendEvent(events, "content", this.buffer.slice(0, nextTag.index));
          this.buffer = this.buffer.slice(nextTag.index + nextTag.open.length);
          this.activeCloseTag = nextTag.close;
          this.mode = "reasoning";
          continue;
        }

        if (finishing) break;
        const pendingLength = getPendingPrefixLength(
          this.buffer,
          THINKING_TAGS.map((tag) => tag.open),
        );
        const readyLength = this.buffer.length - pendingLength;
        appendEvent(events, "content", this.buffer.slice(0, readyLength));
        this.buffer = this.buffer.slice(readyLength);
        break;
      }

      const closeTag = this.activeCloseTag;
      if (!closeTag) {
        this.mode = "content";
        continue;
      }

      const closeIndex = this.buffer.indexOf(closeTag);
      if (closeIndex >= 0) {
        appendEvent(events, "reasoning", this.buffer.slice(0, closeIndex));
        this.buffer = this.buffer.slice(closeIndex + closeTag.length);
        this.activeCloseTag = undefined;
        this.mode = "content";
        continue;
      }

      if (finishing) break;
      const pendingLength = getPendingPrefixLength(this.buffer, [closeTag]);
      const readyLength = this.buffer.length - pendingLength;
      appendEvent(events, "reasoning", this.buffer.slice(0, readyLength));
      this.buffer = this.buffer.slice(readyLength);
      break;
    }

    return events;
  }
}
