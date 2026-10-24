import ChatApp from "@/components/chat/ChatApp";
import { getCurrentUserId } from "@/lib/auth-helpers";
import { isCloudMode } from "@/lib/env";

export default async function Page() {
  const guest = isCloudMode() && !(await getCurrentUserId());
  return <ChatApp guest={guest} />;
}
