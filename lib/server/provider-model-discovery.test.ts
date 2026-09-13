import { expect, it } from "vitest";
import { isPublicModelAddress, parseDiscoveredModels } from "./provider-model-discovery";
it("rejects private, loopback and mapped IPv6 destinations", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "::1",
    "fc00::1",
    "::ffff:127.0.0.1",
    "::ffff:192.168.1.1",
  ])
    expect(isPublicModelAddress(address), address).toBe(false);
  expect(isPublicModelAddress("8.8.8.8")).toBe(true);
  expect(isPublicModelAddress("2606:4700:4700::1111")).toBe(true);
});
it("normalizes OpenAI model catalogs without accepting malformed IDs", () => {
  expect(
    parseDiscoveredModels(
      { data: [{ id: "new-model" }, { id: "new-model" }, { id: 1 }, {}] },
      false,
    ),
  ).toEqual(["new-model"]);
  expect(() => parseDiscoveredModels({ error: "bad" }, false)).toThrow();
});
it("includes only generative Gemini models", () => {
  expect(
    parseDiscoveredModels(
      {
        models: [
          { name: "models/gemini-new", supportedGenerationMethods: ["generateContent"] },
          { name: "models/embedding", supportedGenerationMethods: ["embedContent"] },
        ],
      },
      true,
    ),
  ).toEqual(["gemini-new"]);
});
