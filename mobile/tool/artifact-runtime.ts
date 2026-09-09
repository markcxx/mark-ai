import { echarts, ensureEChartsTheme } from "../../lib/visualization/echarts-client";
import mermaid from "mermaid";
import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";
import {
  parseOption,
  applyOfficialTheme,
  getThemeBackground,
  resolveTheme,
  chartThemeOptions,
} from "./generated/chart";
import { validateSource as validateDiagram } from "./generated/diagram";
import {
  validateSource as validateMap,
  countNodes,
  getTitle,
  getMarkmapOptions,
  syncFoldIndicators,
  setAllFolded,
} from "./generated/mindmap";

let revision = 0,
  chart: any,
  map: any,
  kind = "",
  source = "",
  dark = false,
  background = "#fff",
  baseBox: number[] | null = null,
  box: number[] | null = null;
let resize: ResizeObserver | undefined;
const view = () => document.getElementById("view")!;
const report = (data: any) =>
  (window as any).MarkAIArtifactStatus?.postMessage(JSON.stringify(data));
function reset() {
  chart?.dispose();
  map?.destroy();
  chart = map = null;
  resize?.disconnect();
  view().replaceChildren();
  baseBox = box = null;
}
function svgBox() {
  const svg = view().querySelector("svg");
  if (svg && box) svg.setAttribute("viewBox", box.join(" "));
}
async function render(type: string, text: string, options: any = {}) {
  const generation = ++revision;
  reset();
  kind = type;
  source = text;
  dark = !!options.dark;
  background = dark ? "#171717" : "#ffffff";
  document.body.style.background = background;
  try {
    let title = "";
    if (type === "echarts") {
      const parsed = parseOption(text);
      if (!parsed.ok) throw new Error(parsed.error);
      const theme = options.theme ?? "auto";
      background = getThemeBackground(theme, dark);
      document.body.style.background = background;
      await ensureEChartsTheme(resolveTheme(theme, dark));
      if (generation !== revision) return;
      chart = echarts.init(view(), resolveTheme(theme, dark), { renderer: "canvas" });
      chart.setOption(theme === "auto" ? parsed.option : applyOfficialTheme(parsed.option, theme), {
        notMerge: true,
      });
      resize = new ResizeObserver(() => chart?.resize());
      resize.observe(view());
      title = parsed.title;
    } else if (type === "mermaid") {
      const error = validateDiagram(text);
      if (error) throw new Error(error);
      mermaid.initialize({
        flowchart: { htmlLabels: false },
        maxTextSize: 50000,
        securityLevel: "strict",
        startOnLoad: false,
        suppressErrorRendering: true,
        theme: dark ? "dark" : "default",
      });
      const result = await mermaid.render(`markai-${generation}`, text.trim());
      if (generation !== revision) return;
      view().innerHTML = result.svg;
      const svg = view().querySelector("svg")!;
      baseBox = (svg.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
      if (baseBox.length !== 4 || baseBox.some((n) => !Number.isFinite(n)))
        throw new Error("流程图缺少有效视图");
      box = [...baseBox];
      svg.style.cssText = "width:100%;height:100%;max-width:none;touch-action:none";
      title = "Mermaid 流程图";
      let last: { x: number; y: number } | null = null;
      svg.onpointerdown = (e) => {
        last = { x: e.clientX, y: e.clientY };
        svg.setPointerCapture(e.pointerId);
      };
      svg.onpointermove = (e) => {
        if (last && box) {
          box[0] -= ((e.clientX - last.x) * box[2]) / svg.clientWidth;
          box[1] -= ((e.clientY - last.y) * box[3]) / svg.clientHeight;
          last = { x: e.clientX, y: e.clientY };
          svgBox();
        }
      };
      svg.onpointerup = () => (last = null);
      svg.onpointercancel = () => (last = null);
    } else if (type === "markmap") {
      const error = validateMap(text);
      if (error) throw new Error(error);
      const { root } = new Transformer().transform(text.trim());
      countNodes(root);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.style.cssText = "width:100%;height:100%";
      view().appendChild(svg);
      map = Markmap.create(svg, getMarkmapOptions(dark), root);
      await map.fit();
      if (generation !== revision) return;
      syncFoldIndicators(map);
      svg.addEventListener("click", () =>
        requestAnimationFrame(() => map && syncFoldIndicators(map)),
      );
      resize = new ResizeObserver(() => map?.fit());
      resize.observe(view());
      title = getTitle(text);
    } else throw new Error("不支持的生成物");
    report({
      type: "ready",
      title,
      generation,
      themes: kind === "echarts" ? chartThemeOptions : [],
    });
  } catch (error) {
    if (generation === revision)
      report({
        type: "error",
        message: error instanceof Error ? error.message : "内容暂时无法展示",
      });
  }
}
async function command(action: string) {
  if (action === "fit") {
    if (map) await map.fit();
    if (chart) chart.resize();
    if (baseBox) {
      box = [...baseBox];
      svgBox();
    }
  }
  if (action === "collapse" || action === "expand") {
    if (map) await setAllFolded(map, action === "collapse");
  }
  if (action === "zoomIn" || action === "zoomOut") {
    const factor = action === "zoomIn" ? 1.25 : 0.8;
    if (map) await map.rescale(factor);
    if (box && baseBox) {
      const scale = (baseBox[2] / box[2]) * factor;
      if (scale >= 0.25 && scale <= 8) {
        const w = box[2] / factor,
          h = box[3] / factor;
        box = [box[0] + (box[2] - w) / 2, box[1] + (box[3] - h) / 2, w, h];
        svgBox();
      }
    }
  }
}
async function exportImage(format: "png" | "svg") {
  if (chart) {
    if (format !== "png") throw new Error("图表支持 PNG 导出");
    return chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: background });
  }
  let host: HTMLDivElement | undefined, exportMap: any;
  try {
    let original = view().querySelector("svg");
    if (!original) throw new Error("请等待预览完成");
    let width = baseBox?.[2] ?? 1200,
      height = baseBox?.[3] ?? 800;
    if (map) {
      // Match Web export: use the complete tree, independent of viewport folds.
      const { root } = new Transformer().transform(source.trim());
      countNodes(root);
      host = document.createElement("div");
      Object.assign(host.style, {
        height: "1000px",
        width: "1600px",
        left: "-10000px",
        position: "fixed",
        top: "0",
      });
      original = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      original.style.cssText = "height:100%;width:100%";
      host.appendChild(original);
      document.body.appendChild(host);
      exportMap = new Markmap(original, getMarkmapOptions(dark));
      await exportMap.setData(root);
      const { x1, x2, y1, y2 } = exportMap.state.rect;
      width = Math.min(4096, Math.max(1200, Math.ceil((x2 - x1) * 1.15)));
      height = Math.min(4096, Math.max(800, Math.ceil((y2 - y1) * 1.15)));
      host.style.width = `${width}px`;
      host.style.height = `${height}px`;
      original.setAttribute("width", String(width));
      original.setAttribute("height", String(height));
      await exportMap.fit(1.5);
      syncFoldIndicators(exportMap);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    const svg = original.cloneNode(true) as SVGSVGElement;
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("viewBox", (baseBox ?? [0, 0, width, height]).join(" "));
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.style.cssText = `background:${background};color:${dark ? "#e5e7eb" : "#374151"};font-family:sans-serif`;
    const originals = original.querySelectorAll("*"),
      clones = svg.querySelectorAll("*");
    originals.forEach((node, index) => {
      const style = getComputedStyle(node);
      for (const property of [
        "font-family",
        "font-size",
        "font-weight",
        "color",
        "fill",
        "stroke",
        "line-height",
      ])
        (clones[index] as HTMLElement).style.setProperty(
          property,
          style.getPropertyValue(property),
        );
    });
    const data =
      "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(svg))));
    if (format === "svg") return data;
    const image = new Image();
    image.src = data;
    await image.decode();
    const scale = Math.min(2, 4096 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    exportMap?.destroy();
    host?.remove();
  }
}

(window as any).MarkAIArtifact = { render, command, exportImage };
