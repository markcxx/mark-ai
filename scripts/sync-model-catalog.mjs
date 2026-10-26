import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { build } from "esbuild";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const compiled = await build({
  entryPoints: ["lib/server/model-catalog.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  packages: "external",
  logLevel: "silent",
});
const module = { exports: {} };
new Function("require", "module", "exports", compiled.outputFiles[0].text)(
  createRequire(import.meta.url),
  module,
  module.exports,
);
const startedAt = Date.now();
const catalog = await module.exports.refreshModelCatalog();
if (
  !catalog.specifications.length ||
  Date.parse(catalog.specificationsUpdatedAt || "") < startedAt ||
  (process.env.ARTIFICIAL_ANALYSIS_API_KEY?.trim() &&
    (!catalog.evaluations.length || Date.parse(catalog.evaluationsUpdatedAt || "") < startedAt))
) {
  throw new Error("模型资料未完整取得，保留原有快照，请检查服务端配置后重试。");
}
await writeFile("data/model-catalog.json", JSON.stringify(catalog, null, 2) + "\n");
console.log(
  `已保存公开模型资料：${catalog.specifications.length} 条规格、${catalog.evaluations.length} 条评测。快照不包含 API Key。`,
);
