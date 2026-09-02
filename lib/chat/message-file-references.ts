import type { FileAttachment, Message, MessageSegment, MessageVariant } from "./types";

type FileReferenceContainer = Pick<Message, "attachments" | "segments" | "variants">;

const addAttachmentIds = (target: Set<string>, attachments: FileAttachment[] | undefined) => {
  for (const attachment of attachments || []) {
    if (attachment.id) target.add(attachment.id);
  }
};

const addSegmentIds = (target: Set<string>, segments: MessageSegment[] | undefined) => {
  for (const segment of segments || []) {
    if (segment.type === "generated-file" && segment.generatedFile.file?.id) {
      target.add(segment.generatedFile.file.id);
    }
    if (segment.type === "generated-image" && segment.generatedImage.file.id) {
      target.add(segment.generatedImage.file.id);
    }
  }
};

const addVariantIds = (target: Set<string>, variants: MessageVariant[] | undefined) => {
  for (const variant of variants || []) addSegmentIds(target, variant.segments);
};

export const collectMessageFileIds = (messages: FileReferenceContainer[]) => {
  const fileIds = new Set<string>();
  for (const message of messages) {
    addAttachmentIds(fileIds, message.attachments);
    addSegmentIds(fileIds, message.segments);
    addVariantIds(fileIds, message.variants);
  }
  return fileIds;
};
