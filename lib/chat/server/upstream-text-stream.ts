// Some compatible gateways mix deltas, replayed blocks and full snapshots in
// delta.content. Normalize before thinking-tag parsing and token estimation.
// Never deduplicate words/lines globally: legitimate short repetitions matter.
export class UpstreamTextStream {
  private text = "";
  private replayAt: number | undefined;
  private replayDetected = false;

  push(chunk: string, snapshot = false): string {
    if (!chunk) return "";
    const previous = this.text;

    if (snapshot) {
      if (previous.startsWith(chunk)) return "";
      if (chunk.startsWith(previous)) return this.append(chunk.slice(previous.length));
      // An append-only client cannot safely apply a rewritten snapshot.
      throw new Error("上游返回了不一致的完整回复，请重新生成或切换模型线路");
    }

    if (previous.length >= 32 && chunk.length >= 32) {
      if (chunk.startsWith(previous) && (chunk.length > previous.length || this.replayDetected)) {
        this.replayDetected = true;
        this.replayAt = undefined;
        return this.append(chunk.slice(previous.length));
      }
      if (previous.startsWith(chunk) && previous.length > chunk.length) {
        this.replayDetected = true;
        this.replayAt = chunk.length;
        return "";
      }
    }

    if (this.replayAt !== undefined) {
      const remaining = previous.slice(this.replayAt);
      if (remaining.startsWith(chunk)) {
        this.replayAt += chunk.length;
        return "";
      }
      if (remaining && chunk.startsWith(remaining)) {
        this.replayAt = undefined;
        return this.append(chunk.slice(remaining.length));
      }
      this.replayAt = undefined;
    }

    // Only after observing a replay/snapshot, handle cumulative trailing blocks.
    // A meaningful overlap avoids stripping normal repeated punctuation/tokens.
    if (this.replayDetected) {
      if (chunk.length >= 16 && previous.endsWith(chunk)) return "";
      const overlap = trailingOverlap(previous, chunk);
      if (overlap >= 16) return this.append(chunk.slice(overlap));
    }
    return this.append(chunk);
  }

  private append(delta: string): string {
    this.text += delta;
    return delta;
  }
}

// Long model responses need linear overlap matching rather than comparing
// every possible suffix (which can become quadratic for repeated text).
function trailingOverlap(previous: string, chunk: string): number {
  const prefix = new Uint32Array(chunk.length);
  for (let i = 1, matched = 0; i < chunk.length; i++) {
    while (matched > 0 && chunk[i] !== chunk[matched]) matched = prefix[matched - 1];
    if (chunk[i] === chunk[matched]) matched++;
    prefix[i] = matched;
  }
  let matched = 0;
  for (const char of previous.slice(-chunk.length).split("")) {
    while (matched > 0 && (matched === chunk.length || char !== chunk[matched])) {
      matched = prefix[matched - 1];
    }
    if (char === chunk[matched]) matched++;
  }
  return matched;
}
