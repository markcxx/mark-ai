import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request } from "node:https";

const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const)
  blocked.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const)
  blocked.addSubnet(network, prefix, "ipv6");
export const isPublicModelAddress = (address: string) => {
  const family = isIP(address);
  return Boolean(family) && !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
};

// Pin the validated DNS result to the TLS connection; never follow redirects with credentials.
async function readModels(url: URL, headers: Record<string, string>): Promise<any> {
  if (url.protocol !== "https:" || url.username || url.password || url.hash)
    throw new Error("请使用不含账号密码的 HTTPS API 地址");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicModelAddress(address)))
    throw new Error("不能连接本机或内网地址");
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        headers,
        lookup: (_hostname, options, callback) => {
          if (options.all) callback(null, addresses);
          else callback(null, addresses[0].address, addresses[0].family);
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(
            new Error(
              res.statusCode === 401 || res.statusCode === 403
                ? "认证失败，请检查 API Key 和模型访问权限"
                : res.statusCode === 404
                  ? "此地址不提供模型列表接口，请检查 API 地址或手动添加模型"
                  : `服务商暂时无法返回模型列表（${res.statusCode}）`,
            ),
          );
          return;
        }
        let bytes = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 2_000_000) req.destroy(new Error("模型列表过大，请手动配置"));
          else chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()));
          } catch {
            reject(new Error("服务商返回的模型列表格式无效"));
          }
        });
      },
    );
    const timer = setTimeout(() => req.destroy(new Error("获取模型超时，请稍后重试")), 15_000);
    req.on("close", () => clearTimeout(timer));
    req.on("error", () => reject(new Error("连接服务商失败，请检查 API 地址或稍后重试")));
    req.end();
  });
}

export function parseDiscoveredModels(data: any, gemini: boolean): string[] {
  const items = gemini ? data?.models : data?.data;
  if (!Array.isArray(items)) throw new Error("服务商返回的模型列表格式无效");
  return [
    ...new Set<string>(
      items
        .filter((item) => item && typeof item === "object")
        .filter((item) => !gemini || item.supportedGenerationMethods?.includes("generateContent"))
        .map((item) => (gemini ? item.name?.replace(/^models\//, "") : item.id))
        .filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 200),
    ),
  ].sort();
}

export async function discoverProviderModels(config: {
  apiKey: string;
  baseUrl?: string;
  runtime: string;
}) {
  const gemini = config.runtime === "gemini";
  const base = (
    config.baseUrl ||
    (gemini ? "https://generativelanguage.googleapis.com/v1beta" : "https://api.openai.com/v1")
  ).replace(/\/+$/, "");
  const endpoint = new URL(
    `${base}${gemini && !/\/v1(?:beta)?$/.test(base) ? "/v1beta" : ""}/models`,
  );
  const headers: Record<string, string> = gemini
    ? { "x-goog-api-key": config.apiKey }
    : { Authorization: `Bearer ${config.apiKey}` };
  const ids = new Set<string>();
  for (let page = 0; page < 20; page++) {
    const data = await readModels(endpoint, headers);
    parseDiscoveredModels(data, gemini).forEach((id) => ids.add(id));
    if (!gemini || !data.nextPageToken) return [...ids].sort();
    endpoint.searchParams.set("pageToken", data.nextPageToken);
  }
  throw new Error("模型分页过多，请手动配置所需模型");
}
