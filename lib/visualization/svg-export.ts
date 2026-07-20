const safeFileName = (value: string) =>
  value
    .replaceAll(/[/\\:*?"<>|]/g, "-")
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "MarkAI 图形";

const getSvgSize = (svg: SVGSVGElement) => {
  const viewBox = svg.viewBox.baseVal;
  const bounds = svg.getBoundingClientRect();
  const width = Math.max(1, viewBox.width || bounds.width || 1200);
  const height = Math.max(1, viewBox.height || bounds.height || 800);
  return { height, width };
};

const serializeSvg = (svg: SVGSVGElement) => {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const { height, width } = getSvgSize(svg);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  return { height, source: new XMLSerializer().serializeToString(clone), width };
};

const triggerDownload = (url: string, filename: string) => {
  const anchor = document.createElement("a");
  anchor.download = filename;
  anchor.href = url;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

export const downloadSvg = (svg: SVGSVGElement, title: string) => {
  const { source } = serializeSvg(svg);
  const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
  triggerDownload(url, `${safeFileName(title)}.svg`);
  URL.revokeObjectURL(url);
};

export const downloadSvgAsPng = async (
  svg: SVGSVGElement,
  title: string,
  backgroundColor: string,
) => {
  const { height, source, width } = serializeSvg(svg);
  const scale = Math.min(2, 4096 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器不支持图片导出");
  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("SVG 转换为 PNG 失败"));
      image.src = url;
    });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pngUrl = canvas.toDataURL("image/png");
    triggerDownload(pngUrl, `${safeFileName(title)}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
};
