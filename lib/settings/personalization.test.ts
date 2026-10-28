import { expect, it } from "vitest";
import { getPersonalizationPrompt } from "./personalization";
import { toOpenAIMessages } from "@/lib/chat/server/openai-helpers";
import { getRuntimeSystemPrompt } from "@/lib/chat/server/runtime-prompt";
it("keeps personalization opt-in and tolerates older clients", () => {
  expect(getPersonalizationPrompt(undefined)).toBe("");
  expect(getPersonalizationPrompt({ customInstructions: "secret preference" })).toBe("");
});
it("sanitizes preferences and uses the same instruction in both runtime paths", () => {
  const personalization = {
    personalizationEnabled: true,
    preferredName: "小王",
    responseLanguage: "en-US",
    customInstructions: "a".repeat(6000),
  };
  const prompt = getPersonalizationPrompt(personalization);
  expect(prompt).toContain("小王");
  expect(prompt).toContain("英语");
  expect(prompt).not.toContain("a".repeat(4001));
  expect(getRuntimeSystemPrompt({ webSearchEnabled: true, personalization })).toContain(prompt);
  expect(
    toOpenAIMessages({
      messages: [{ role: "user", content: "你好" }],
      webSearchEnabled: false,
      personalization,
    })[0].content,
  ).toContain(prompt);
});
