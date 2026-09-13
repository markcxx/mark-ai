"use client";
import { useState } from "react";
import { AppSelect } from "@/components/ui/AppSelect";
import { MermaidPreviewBlock } from "../MermaidPreviewBlock";
const samples = {
  flow: "flowchart LR\n  A[提出想法] --> B{整理需求}\n  B --> C[开始创作]\n  B --> D[继续探索]\n  C --> E[完成作品]",
  sequence:
    "sequenceDiagram\n  participant A as 用户\n  participant B as MarkAI\n  A->>B: 帮我整理今天的灵感\n  B-->>A: 已整理为三个方向\n  A->>B: 开始第一个方案",
  mindmap:
    "mindmap\n  root((创作计划))\n    收集灵感\n      阅读\n      观察\n    整理思路\n    完成作品",
};
export default function DiagramThemePreview() {
  const [sample, setSample] = useState<keyof typeof samples>("sequence");
  return (
    <div className="space-y-3 pb-5">
      <div className="flex justify-end">
        <AppSelect
          aria-label="预览图表类型"
          value={sample}
          onChange={setSample}
          options={[
            { label: "流程图", value: "flow" },
            { label: "时序图", value: "sequence" },
            { label: "脑图", value: "mindmap" },
          ]}
        />
      </div>
      <MermaidPreviewBlock>{samples[sample]}</MermaidPreviewBlock>
    </div>
  );
}
