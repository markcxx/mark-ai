import { expect, it } from "vitest";
import { parseAnnouncementConfig, isAnnouncementUrl } from "./announcement-config";

it("supports existing announcements and disabling without erasing content", () => {
  expect(parseAnnouncementConfig({ content: "公告" })).toMatchObject({ enabled: true, closable: true, actionEnabled: false });
  expect(parseAnnouncementConfig({ content: "保留内容", enabled: false, closable: false })).toMatchObject({ content: "保留内容", enabled: false, closable: false });
});
it("validates optional actions and refuses executable or ambiguous URLs", () => {
  for (const actionUrl of ["/download", "https://example.com/download", "http://localhost:3000/download"]) {
    expect(parseAnnouncementConfig({ content: "公告", actionEnabled: true, actionLabel: "下载", actionUrl })).not.toBeNull();
  }
  for (const actionUrl of ["javascript:alert(1)", "data:text/html,a", "//example.com", "/\\example.com", "https://a:b@example.com", "https://example.com/\n"]) {
    expect(isAnnouncementUrl(actionUrl)).toBe(false);
  }
  expect(parseAnnouncementConfig({ content: "公告", actionEnabled: true, actionUrl: "" })).toBeNull();
  expect(parseAnnouncementConfig({ content: "公告", enabled: "false" })).toBeNull();
  expect(parseAnnouncementConfig({ content: "公告", actionLabel: "x".repeat(25) })).toBeNull();
});
