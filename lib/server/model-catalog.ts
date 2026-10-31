import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import bundledCatalog from "../../data/model-catalog.json";
import overrides from "../../data/model-overrides.json";
import {
  parseArtificialAnalysis,
  parseModelsDev,
  resolveCatalogMetadata,
  type ModelCatalog,
} from "../model-catalog";
import { fetchWithDevelopmentProxy } from "./development-proxy";

const CACHE_PATH = path.join(process.cwd(), ".data", "model-catalog.json");
const TTL = 24 * 60 * 60 * 1000;
let catalog: ModelCatalog = bundledCatalog as ModelCatalog;
let initialized: Promise<void> | undefined;
let refreshing: Promise<ModelCatalog> | undefined;
let nextAttempt = 0;

export function readModelCatalog(): Promise<ModelCatalog> {
  initialized ||= (async () => {
    try {
      const cached = JSON.parse(await readFile(CACHE_PATH, "utf8"));
      if (
        cached.version === 1 &&
        Array.isArray(cached.evaluations) &&
        Array.isArray(cached.specifications) &&
        Date.parse(cached.updatedAt) > Date.parse(catalog.updatedAt)
      ) {
        catalog = cached;
      }
    } catch {
      // The bundled public snapshot works on read-only and first-run installs.
    }
  })();
  return initialized.then(() => catalog);
}

async function fetchJson(url: string, authenticated = false) {
  const response = await fetchWithDevelopmentProxy(url, {
    headers: authenticated ? { "x-api-key": process.env.ARTIFICIAL_ANALYSIS_API_KEY!.trim() } : {},
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  // Never include response bodies or credentials in exceptions/logs.
  if (!response.ok) throw new Error(`模型资料源返回 HTTP ${response.status}`);
  return response.json();
}

export async function refreshModelCatalog(): Promise<ModelCatalog> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    await readModelCatalog();
    const next = { ...catalog };
    const results = await Promise.allSettled([
      (async () => {
        const payload = await fetchJson("https://models.dev/api.json");
        const specifications = parseModelsDev(payload);
        if (!specifications.length) throw new Error("模型规格数据为空");
        next.specifications = specifications;
        next.specificationsUpdatedAt = new Date().toISOString();
      })(),
      (async () => {
        if (!process.env.ARTIFICIAL_ANALYSIS_API_KEY?.trim()) return;
        const rows: unknown[] = [];
        let indexVersion = "";
        for (let page = 1; page <= 20; page += 1) {
          const payload = await fetchJson(
            `https://artificialanalysis.ai/api/v2/language/models/free?page=${page}`,
            true,
          );
          if (!Array.isArray(payload.data)) throw new Error("评测数据格式无效");
          const version = String(payload.intelligence_index_version ?? "");
          if (indexVersion && version !== indexVersion)
            throw new Error("评测版本在分页期间变化，请稍后重试");
          indexVersion = version;
          rows.push(...payload.data);
          if (!payload.pagination?.has_more) break;
          if (page === 20) throw new Error("评测分页数量超出限制");
        }
        const evaluations = parseArtificialAnalysis(rows);
        if (!evaluations.length) throw new Error("评测数据为空");
        next.evaluations = evaluations;
        next.indexVersion = indexVersion;
        next.evaluationsUpdatedAt = new Date().toISOString();
      })(),
    ]);
    if (results.some((result) => result.status === "rejected")) {
      console.warn("部分模型资料更新失败，继续使用已有数据。");
    }
    if (
      next.specifications !== catalog.specifications ||
      next.evaluations !== catalog.evaluations
    ) {
      next.updatedAt = new Date().toISOString();
      catalog = next;
      try {
        await mkdir(path.dirname(CACHE_PATH), { recursive: true });
        const temporary = `${CACHE_PATH}.${process.pid}.tmp`;
        await writeFile(temporary, JSON.stringify(next));
        await rename(temporary, CACHE_PATH);
      } catch {
        console.warn("模型资料磁盘缓存不可写，已保留内存缓存。");
      }
    }
    return catalog;
  })().finally(() => {
    refreshing = undefined;
  });
  return refreshing;
}

export async function withModelCatalog<T extends { id: string; provider: string }>(models: T[]) {
  const snapshot = await readModelCatalog();
  const stale = Date.now() - Date.parse(snapshot.updatedAt) > TTL;
  if (stale && Date.now() >= nextAttempt && !process.env.VITEST) {
    nextAttempt = Date.now() + TTL;
    // Serve the last usable snapshot immediately. Optional data never blocks chat.
    void refreshModelCatalog().catch(() => console.warn("模型资料暂时不可用，继续使用已有数据。"));
  }
  return models.map((model) => ({
    ...model,
    metadata: resolveCatalogMetadata(model, snapshot, overrides),
  }));
}

export async function getServerModelMetadata(model: { id: string; provider: string }) {
  return resolveCatalogMetadata(model, await readModelCatalog(), overrides);
}

// Evaluation freshness is independent of specification freshness: a successful
// models.dev refresh must not hide a failed AA refresh. Share the fetch lock.
let nextRankingAttempt = 0;
export async function readRankingCatalog(): Promise<ModelCatalog> {
  const snapshot = await readModelCatalog();
  const updated = Date.parse(snapshot.evaluationsUpdatedAt || "");
  if (
    (!Number.isFinite(updated) || Date.now() - updated > TTL) &&
    Date.now() >= nextRankingAttempt &&
    process.env.ARTIFICIAL_ANALYSIS_API_KEY?.trim()
  ) {
    nextRankingAttempt = Date.now() + TTL;
    try {
      return await refreshModelCatalog();
    } catch {
      console.warn("排行榜更新失败，继续使用已有评测快照。");
    }
  }
  return refreshing ? refreshing.catch(() => snapshot) : snapshot;
}
