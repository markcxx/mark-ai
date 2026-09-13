import { MERMAID_PALETTES, type MermaidTheme } from "./theme-catalog";

export function getMermaidTheme(theme: MermaidTheme, dark: boolean) {
  const palette = MERMAID_PALETTES[theme === "auto" ? (dark ? "zinc-dark" : "zinc-light") : theme];
  const accent = "accent" in palette ? palette.accent : palette.fg;
  const line = "line" in palette ? palette.line : palette.fg;
  const branchColor =
    "#" +
    [1, 3, 5]
      .map((offset) =>
        Math.round(
          parseInt(palette.bg.slice(offset, offset + 2), 16) * 0.78 +
            parseInt(palette.fg.slice(offset, offset + 2), 16) * 0.22,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  return {
    background: palette.bg,
    config: {
      theme: "base" as const,
      themeVariables: {
        darkMode: theme === "auto" ? dark : !/(light|latte)$/.test(theme),
        background: palette.bg,
        primaryColor: palette.bg,
        primaryTextColor: palette.fg,
        primaryBorderColor: accent,
        secondaryColor: palette.bg,
        secondaryTextColor: palette.fg,
        secondaryBorderColor: line,
        tertiaryColor: palette.bg,
        tertiaryTextColor: palette.fg,
        tertiaryBorderColor: accent,
        lineColor: line,
        textColor: palette.fg,
        mainBkg: palette.bg,
        nodeBorder: accent,
        clusterBkg: palette.bg,
        clusterBorder: line,
        titleColor: palette.fg,
        actorBkg: palette.bg,
        actorBorder: line,
        actorTextColor: palette.fg,
        signalColor: accent,
        signalTextColor: palette.fg,
        labelBoxBkgColor: palette.bg,
        labelBoxBorderColor: line,
        labelTextColor: palette.fg,
        loopTextColor: palette.fg,
        noteBkgColor: palette.bg,
        noteTextColor: palette.fg,
        noteBorderColor: accent,
        edgeLabelBackground: palette.bg,
        cScale0: palette.bg,
        cScaleLabel0: palette.fg,
        ...Object.fromEntries(
          Array.from({ length: 12 }, (_, index) => [`cScale${index}`, branchColor]),
        ),
        ...Object.fromEntries(
          Array.from({ length: 12 }, (_, index) => [`cScaleLabel${index}`, palette.fg]),
        ),
      },
    },
  };
}

// Mermaid is a singleton: serialize initialize + render to avoid cross-theme races.
let pending: Promise<unknown> = Promise.resolve();
export function queueMermaidRender<T>(render: () => Promise<T>): Promise<T> {
  const next = pending.then(render, render);
  pending = next.catch(() => undefined);
  return next;
}
