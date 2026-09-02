import { describe, expect, it } from "vitest";

import type { Message } from "./types";
import { collectMessageFileIds } from "./message-file-references";

describe("message file references", () => {
  it("collects uploaded, generated, image, and variant file ids without duplicates", () => {
    const messages: Message[] = [
      {
        attachments: [
          { contentType: "text/plain", id: "upload-1", name: "notes.txt", size: 10 },
        ],
        content: "read this",
        id: "user-1",
        role: "user",
      },
      {
        content: "done",
        id: "model-1",
        role: "model",
        segments: [
          {
            generatedFile: {
              callId: "call-1",
              file: {
                contentType: "application/pdf",
                id: "generated-1",
                name: "report.pdf",
                size: 20,
                url: "/api/files/generated-1/download",
              },
              status: "done",
              toolId: "word",
              toolName: "Word",
            },
            type: "generated-file",
          },
          {
            generatedImage: {
              file: {
                contentType: "image/png",
                id: "image-1",
                name: "image.png",
                size: 30,
              },
              prompt: "image",
            },
            type: "generated-image",
          },
        ],
        variants: [
          {
            content: "variant",
            id: "variant-1",
            segments: [
              {
                generatedFile: {
                  callId: "call-2",
                  file: {
                    contentType: "application/pdf",
                    id: "generated-1",
                    name: "report.pdf",
                    size: 20,
                    url: "/api/files/generated-1/download",
                  },
                  status: "done",
                  toolId: "word",
                  toolName: "Word",
                },
                type: "generated-file",
              },
              {
                generatedImage: {
                  file: {
                    contentType: "image/png",
                    id: "variant-image-1",
                    name: "variant.png",
                    size: 40,
                  },
                  prompt: "variant image",
                },
                type: "generated-image",
              },
            ],
          },
        ],
      },
    ];

    expect([...collectMessageFileIds(messages)].sort()).toEqual([
      "generated-1",
      "image-1",
      "upload-1",
      "variant-image-1",
    ]);
  });
});
