import ChatApp from "@/components/chat/ChatApp";
import { GuestChatApp } from "@/components/guest/GuestChatApp";
import { getCurrentUserId } from "@/lib/auth-helpers";
import { isCloudMode } from "@/lib/env";

export default async function Page() {
  if (isCloudMode() && !(await getCurrentUserId())) return <GuestChatApp />;
  return <ChatApp />;
}
