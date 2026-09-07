export type ShareInfo = { path: string; expiresAt: string; createdAt: string };

export async function readShareResponse(
  response: Response,
): Promise<{ share?: ShareInfo | null; ok?: true }> {
  const fallback =
    response.status === 401 ? "登录已过期，请重新登录后重试" : "分享服务响应异常，请稍后重试";
  const data: unknown = await response.json().catch(() => null);
  if (!data || typeof data !== "object") throw new Error(fallback);
  if (!response.ok) {
    throw new Error(
      "error" in data && typeof data.error === "string" && /[\u4e00-\u9fff]/.test(data.error)
        ? data.error
        : fallback,
    );
  }
  if ("ok" in data && data.ok === true) return { ok: true };
  if ("share" in data) {
    const share = data.share;
    if (share === null) return { share: null };
    if (
      share &&
      typeof share === "object" &&
      "path" in share &&
      typeof share.path === "string" &&
      /^\/share\/[A-Za-z0-9_-]{43}$/.test(share.path) &&
      "expiresAt" in share &&
      typeof share.expiresAt === "string" &&
      Number.isFinite(Date.parse(share.expiresAt)) &&
      "createdAt" in share &&
      typeof share.createdAt === "string" &&
      Number.isFinite(Date.parse(share.createdAt))
    ) {
      return { share: share as ShareInfo };
    }
  }
  throw new Error(fallback);
}
