import dns from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import { normalizeWebImageUrl } from "../chat/web-image-url";
import { fetchWithDevelopmentProxy } from "./development-proxy";

export function isPublicImageAddress(address: string) {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

async function publicAddresses(hostname: string) {
  let addresses = await dns.lookup(hostname, { all: true, family: 4 });
  // TUN proxies can return synthetic IPs locally. Resolve the public destination
  // over HTTPS instead; never connect to those synthetic/private addresses.
  if (
    process.env.NODE_ENV === "development" &&
    addresses.length &&
    addresses.every(({ address }) => /^198\.(18|19)\./.test(address))
  ) {
    const response = await fetchWithDevelopmentProxy(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
      { headers: { Accept: "application/dns-json" }, signal: AbortSignal.timeout(4000) },
    );
    if (!response.ok) throw new Error("无法解析图片地址");
    const payload = await response.json();
    addresses = (payload.Answer || [])
      .filter((item: { type: number }) => item.type === 1)
      .map((item: { data: string }) => ({ address: item.data, family: 4 }));
  }
  if (!addresses.length || addresses.some(({ address }) => !isPublicImageAddress(address))) {
    throw new Error("不允许读取本机或内网图片");
  }
  return addresses;
}

// Validate DNS when connecting and give these exact addresses to the socket.
// Preflight lookup + ordinary fetch would leave a DNS-rebinding window.
const agent = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      void publicAddresses(hostname).then(
        (addresses) => {
          if (options.all) callback(null, addresses);
          else callback(null, addresses[0].address, addresses[0].family);
        },
        (error: Error) => callback(error, "", 4),
      );
    },
  },
});

export async function fetchPublicImage(url: string, init: RequestInit): Promise<Response> {
  const normalized = normalizeWebImageUrl(url);
  if (!normalized) throw new Error("图片地址不受支持");
  // IP literals skip the socket lookup callback.
  const host = new URL(normalized).hostname;
  if (isIP(host) && !isPublicImageAddress(host)) throw new Error("不允许读取本机或内网图片");
  return undiciFetch(normalized, { ...init, dispatcher: agent } as Parameters<
    typeof undiciFetch
  >[1]) as unknown as Promise<Response>;
}
