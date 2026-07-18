import { NextResponse } from "next/server";

import { authorizeAdminApi } from "@/lib/admin/api";

export async function GET(request: Request) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response) return response;
  return NextResponse.json({ admin });
}
