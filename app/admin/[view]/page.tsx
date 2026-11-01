import { notFound } from "next/navigation";
import { AdminConsole, type AdminView } from "@/components/admin/AdminConsole";
export default async function AdminSection({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  if (!["overview", "plans", "models", "users", "waitlist", "audit", "announcement"].includes(view))
    notFound();
  return <AdminConsole initialView={view as AdminView} />;
}
