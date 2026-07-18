import { NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/admin/auth";

export const authorizeAdminApi = async (request: Request) => {
  const admin = await getCurrentAdmin(request.headers);
  if (!admin) {
    return {
      admin: undefined,
      response: NextResponse.json({ error: "需要管理员权限" }, { status: 403 }),
    };
  }
  return { admin, response: undefined };
};

export const getPagination = (request: Request, defaultLimit = 30) => {
  const { searchParams } = new URL(request.url);
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit")) || defaultLimit));
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  return { limit, offset: (page - 1) * limit, page, searchParams };
};
