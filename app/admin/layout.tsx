import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/lib/admin/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");
  return children;
}
