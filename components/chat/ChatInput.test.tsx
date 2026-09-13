import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("./NewModelsBar", () => ({
  NewModelsBar: () => React.createElement("div", { "data-testid": "launch-tray" }, "上新模型"),
}));
vi.mock("./ModelSelectorDialog", () => ({ ModelSelectorDialog: () => null }));
vi.mock("./FilePreviewDialog", () => ({ FilePreviewDialog: () => null }));
vi.mock("./ToolMenu", () => ({ ToolMenu: () => null }));
vi.mock("./ComposerAttachments", () => ({ ComposerAttachments: () => null }));
import { ChatInput } from "./ChatInput";

// Vitest uses the classic JSX runtime for existing components.
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());

function render(placement: "center" | "bottom") {
  return renderToStaticMarkup(
    React.createElement(ChatInput, {
      placement,
      input: "保留的草稿",
      availableModels: [],
      attachments: [],
      uploads: [],
      attachmentUploading: false,
      isLoading: false,
      isLoadingModels: false,
      modelSearchKeyword: "",
      messages: [],
      providerNames: {},
      pendingQuote: null,
      queuedMessage: null,
      selectedModelKey: "",
      textareaRef: { current: null },
      webSearchEnabled: false,
      onDropFiles: async () => {},
      onCancelUpload: vi.fn(),
      onRetryUpload: vi.fn(),
      onAttachment: vi.fn(),
      onRemoveAttachment: vi.fn(),
      onInput: vi.fn(),
      onKeyDown: vi.fn(),
      onPaste: vi.fn(),
      onClearQuote: vi.fn(),
      onMic: vi.fn(),
      onCancelQueuedMessage: vi.fn(),
      onSendQueuedMessageNow: vi.fn(),
      onSend: vi.fn(),
      setModelSearchKeyword: vi.fn(),
      setSelectedModelKey: vi.fn(),
      onToggleWebSearch: vi.fn(),
    }),
  );
}
it("places the launch tray after the input controls and before the AI disclaimer", () => {
  const html = render("center");
  expect(html).toContain("launch-tray");
  expect(html.indexOf("launch-tray")).toBeGreaterThan(html.indexOf('aria-label="发送消息"'));
  expect(html.indexOf("launch-tray")).toBeLessThan(html.indexOf("内容由 AI 生成"));
  expect(html).toContain("保留的草稿");
});
it("keeps active-conversation composers free of the launch tray", () => {
  expect(render("bottom")).not.toContain("launch-tray");
});
