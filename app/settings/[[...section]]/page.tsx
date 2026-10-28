import { notFound, redirect } from "next/navigation";
import { SettingsWorkspace } from "@/components/chat/SettingsWorkspace";
import {
  SETTINGS_SECTION_IDS,
  type SettingsSection,
} from "@/components/chat/settings/settings-sections";
import { getCurrentUserId } from "@/lib/auth-helpers";
import { isCloudMode } from "@/lib/env";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  const selected = section?.[0] || "profile";
  if ((section?.length || 0) > 1 || !SETTINGS_SECTION_IDS.has(selected)) notFound();
  if (isCloudMode() && !(await getCurrentUserId())) {
    const callback = section?.length ? `/settings/${selected}` : "/settings";
    redirect(`/login?callbackUrl=${encodeURIComponent(callback)}`);
  }
  return <SettingsWorkspace section={selected as SettingsSection} />;
}
