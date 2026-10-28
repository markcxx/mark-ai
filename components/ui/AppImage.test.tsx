import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import AppImage from "./AppImage";
import { SourceFavicon } from "../chat/message/MessageSources";
const state = vi.hoisted(() => ({ status: "loading" }));
vi.mock("@/hooks/useImageLoading", () => ({
  useImageLoading: () => ({ status: state.status, ref: () => {} }),
}));
beforeEach(() => {
  state.status = "loading";
});
it.each(["loading", "ready", "error"])(
  "constrains a favicon to its declared size even for a huge source (%s)",
  (status) => {
    state.status = status;
    const html = renderToStaticMarkup(
      <SourceFavicon
        size={20}
        citation={{
          citationId: 1,
          title: "来源",
          url: "https://example.com",
          favicon: "https://example.com/huge.png",
          structured: true,
        }}
      />,
    );
    expect(html).toContain("width:20px;height:20px;flex-shrink:0");
    expect(html).toContain("h-full w-full");
    expect(html.includes('role="status"')).toBe(status === "loading");
  },
);
it("reserves space for unknown dimensions and keeps preview disabled while loading", () => {
  const html = renderToStaticMarkup(
    <AppImage native src="https://example.com/a.jpg" alt="图片" onPreview={() => {}} />,
  );
  expect(html).toContain("aspect-ratio:3 / 2");
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain('disabled=""');
  expect(html).toContain("正在加载图片");
});
it("keeps failures retryable without adding a nested button or visible image captions", () => {
  state.status = "error";
  const html = renderToStaticMarkup(
    <AppImage native src="https://example.com/a.jpg" alt="图片" onPreview={() => {}} />,
  );
  expect(html).toContain("图片加载失败，点击重试");
  expect(html).not.toContain('disabled=""');
  expect(html.match(/<button/g)).toHaveLength(1);
  expect(html).not.toContain("figcaption");
});
it("lets responsive screenshots use their container width instead of a fixed intrinsic size", () => {
  const html = renderToStaticMarkup(
    <AppImage
      native
      responsive
      src="/screen.png"
      alt="截图"
      width={1920}
      height={838}
      className="h-auto w-full"
    />,
  );
  expect(html).toContain('style="width:100%"');
  expect(html).not.toContain("height:838px");
});
