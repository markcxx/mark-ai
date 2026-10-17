import { describe, expect, it } from "vitest";
import { UpstreamTextStream } from "./upstream-text-stream";

const intro = "我联网查了 LINUX DO 的官方网站和社区资料。这里是关于这个中文技术社区的介绍。";
const middle = "社区覆盖软件开发、人工智能和服务器运维等多种主题，也包含日常交流。";
const end = "注册要求和论坛规则应以官方网站的最新说明为准，请自行核实相关信息。";
const normalize = (chunks: string[]) => {
  const stream = new UpstreamTextStream();
  return chunks.map((chunk) => stream.push(chunk)).join("");
};

describe("UpstreamTextStream", () => {
  it("preserves normal deltas and intentional short repetitions", () => {
    expect(normalize(["哈哈", "哈哈", "，", "真的", "真的", "！"])).toBe("哈哈哈哈，真的真的！");
    expect(normalize([intro, middle, end])).toBe(intro + middle + end);
    expect(normalize([intro, intro])).toBe(intro + intro);
  });
  it("normalizes growing full snapshots", () => {
    expect(normalize([intro, intro + middle, intro + middle + end, intro + middle + end])).toBe(
      intro + middle + end,
    );
  });
  it("handles the gateway sequence: deltas, replays, stale snapshots and trailing blocks", () => {
    const shortBlock = "第二部分，下面继续介绍这个社区的具体使用方式。";
    const full = intro + middle;
    expect(
      normalize([
        intro,
        middle,
        intro,
        middle,
        end,
        full,
        end,
        full + end,
        shortBlock,
        full + end + shortBlock,
        shortBlock,
        full + end + shortBlock,
        shortBlock + "请遵守社区规则。",
        full + end + shortBlock + "请遵守社区规则。",
      ]),
    ).toBe(full + end + shortBlock + "请遵守社区规则。");
  });
  it("does not remove overlapping prose without evidence of an abnormal stream", () => {
    const repeated = "这段是正常文章中重复引用的完整句子，需要保留其原有含义。";
    expect(normalize([intro + repeated, repeated + middle])).toBe(
      intro + repeated + repeated + middle,
    );
  });
  it("keeps state isolated between replies", () => {
    expect(normalize([intro, middle])).toBe(intro + middle);
    expect(normalize([intro, middle])).toBe(intro + middle);
  });
  it("handles explicit message snapshots even when short", () => {
    const stream = new UpstreamTextStream();
    expect(
      stream.push("你好", true) + stream.push("你好世界", true) + stream.push("你好世界", true),
    ).toBe("你好世界");
    expect(() => stream.push("改写后的回答", true)).toThrow("上游返回了不一致");
  });
});
