import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { build } from "esbuild";
import ts from "typescript";
import { resolve } from "node:path";
const dir = "mobile/tool/generated";
await mkdir(dir, { recursive: true });
async function extract(file, name, names, exports, imports = "") {
  const source = await readFile(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const statements = ast.statements.filter(
    (s) =>
      ts.isVariableStatement(s) &&
      s.declarationList.declarations.some((d) => names.includes(d.name.getText(ast))),
  );
  await writeFile(
    `${dir}/${name}.ts`,
    imports +
      "\n" +
      statements.map((s) => s.getText(ast)).join("\n") +
      `\nexport {${exports.join(",")}};\n`,
  );
}
await extract(
  "components/chat/EChartsPreviewBlock.tsx",
  "chart",
  [
    "MAX_CONFIG_CHARS",
    "MAX_NODES",
    "MAX_SERIES",
    "BLOCKED_KEYS",
    "isRecord",
    "sanitizeOption",
    "getChartTitle",
    "parseOption",
    "SERIES_COLOR_KEYS",
    "stripSeriesColors",
    "applyOfficialTheme",
    "getThemeBackground",
    "resolveTheme",
    "chartThemeOptions",
  ],
  ["parseOption", "applyOfficialTheme", "getThemeBackground", "resolveTheme", "chartThemeOptions"],
  `import {ECHARTS_THEME_PALETTES} from '../../../lib/visualization/echarts-theme-palettes';`,
);
await extract(
  "components/chat/MermaidPreviewBlock.tsx",
  "diagram",
  ["MAX_SOURCE_LENGTH", "BLOCKED_SOURCE", "validateSource"],
  ["validateSource"],
);
await extract(
  "components/chat/MarkmapPreviewBlock.tsx",
  "mindmap",
  [
    "MAX_SOURCE_LENGTH",
    "MAX_NODES",
    "BLOCKED_SOURCE",
    "validateSource",
    "countNodes",
    "getTitle",
    "getMarkmapOptions",
    "syncFoldIndicators",
    "setAllFolded",
  ],
  [
    "validateSource",
    "countNodes",
    "getTitle",
    "getMarkmapOptions",
    "syncFoldIndicators",
    "setAllFolded",
  ],
);
await build({
  entryPoints: ["mobile/tool/artifact-runtime.ts"],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  outfile: "mobile/assets/web/artifact-runtime.js",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "echarts-extension-imports",
      setup(b) {
        b.onResolve({ filter: /^(echarts|zrender)\/lib\// }, (args) =>
          args.path.endsWith(".js")
            ? undefined
            : { path: resolve("node_modules", args.path + ".js") },
        );
      },
    },
  ],
});
for (const name of ["markmap-lib", "markmap-view", "echarts-gl"]) {
  await copyFile(`node_modules/${name}/LICENSE`, `mobile/assets/web/${name}-LICENSE.txt`).catch(
    () => {},
  );
}
