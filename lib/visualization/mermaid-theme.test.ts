import { expect, it } from "vitest";
import { getMermaidTheme, queueMermaidRender } from "./mermaid-theme";
import { sanitizeGeneralSettings, DEFAULT_SETTINGS } from "../settings";
it("persists supported themes and rejects unknown values", () => {
  expect(
    sanitizeGeneralSettings({ codeTheme: "tokyo-night", mermaidTheme: "tokyo-night-light" }),
  ).toMatchObject({ codeTheme: "tokyo-night", mermaidTheme: "tokyo-night-light" });
  expect(sanitizeGeneralSettings({ mermaidTheme: "broken" }).mermaidTheme).toBe(
    DEFAULT_SETTINGS.general.mermaidTheme,
  );
});
it("uses the same background for diagrams and exports", () => {
  const light = getMermaidTheme("tokyo-night-light", true);
  expect(light.background).toBe("#d5d6db");
  expect(light.config.themeVariables.background).toBe(light.background);
  expect(getMermaidTheme("auto", true).background).not.toBe(
    getMermaidTheme("auto", false).background,
  );
});
it("serializes renders and recovers after failed diagrams", async () => {
  const calls: string[] = [];
  const first = queueMermaidRender(async () => {
    calls.push("first");
    throw new Error("invalid");
  });
  const second = queueMermaidRender(async () => {
    calls.push("second");
    return "svg";
  });
  await expect(first).rejects.toThrow("invalid");
  await expect(second).resolves.toBe("svg");
  expect(calls).toEqual(["first", "second"]);
});
